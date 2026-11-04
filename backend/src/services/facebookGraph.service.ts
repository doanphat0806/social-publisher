import axios, { AxiosError } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface MetaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaFacebookProfile {
  id: string;
  name: string;
}

export interface MetaFacebookPageItem {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  tasks?: string[];
  picture?: {
    data?: {
      url?: string;
    };
  };
}

export interface GraphApiErrorDetails {
  type: 'TOKEN_EXPIRED' | 'PERMISSION_DENIED' | 'RATE_LIMIT' | 'NETWORK_TIMEOUT' | 'INVALID_PARAM' | 'UNKNOWN';
  message: string;
  code?: number;
  subcode?: number;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export class FacebookGraphService {
  private baseUrl = `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`;

  /**
   * Generates Facebook OAuth URL with required scopes
   */
  getOAuthUrl(state: string): string {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
    ].join(',');

    const params = new URLSearchParams({
      client_id: env.FACEBOOK_APP_ID,
      redirect_uri: env.FACEBOOK_REDIRECT_URI,
      state: state,
      scope: scopes,
      response_type: 'code',
    });

    return `https://www.facebook.com/${env.FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange OAuth authorization code for short-lived access token
   */
  async exchangeCodeForToken(code: string): Promise<MetaOAuthTokenResponse> {
    try {
      const response = await axios.get<MetaOAuthTokenResponse>(`${this.baseUrl}/oauth/access_token`, {
        params: {
          client_id: env.FACEBOOK_APP_ID,
          client_secret: env.FACEBOOK_APP_SECRET,
          redirect_uri: env.FACEBOOK_REDIRECT_URI,
          code: code,
        },
      });
      return response.data;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Exchange short-lived token for long-lived (60 days) token
   */
  async getLongLivedToken(shortLivedToken: string): Promise<MetaOAuthTokenResponse> {
    try {
      const response = await axios.get<MetaOAuthTokenResponse>(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: env.FACEBOOK_APP_ID,
          client_secret: env.FACEBOOK_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
      });
      return response.data;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Get user profile (id, name)
   */
  async getUserProfile(userAccessToken: string): Promise<MetaFacebookProfile> {
    try {
      const response = await axios.get<MetaFacebookProfile>(`${this.baseUrl}/me`, {
        params: {
          fields: 'id,name',
          access_token: userAccessToken,
        },
      });
      return response.data;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Fetch user's managed Facebook Pages with their Page Access Tokens
   */
  async getUserPages(userAccessToken: string): Promise<MetaFacebookPageItem[]> {
    try {
      const pages: MetaFacebookPageItem[] = [];
      let nextUrl: string | null = `${this.baseUrl}/me/accounts?fields=id,name,category,access_token,tasks,picture&limit=100&access_token=${userAccessToken}`;

      while (nextUrl) {
        const response: any = await axios.get(nextUrl);
        if (response.data?.data) {
          pages.push(...response.data.data);
        }
        nextUrl = response.data?.paging?.next || null;
      }

      return pages;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Upload an unpublished photo to a Page (published=false)
   * Returns Photo ID (media_fbid) to be attached to feed post
   */
  async uploadUnpublishedPhoto(
    pageId: string,
    pageAccessToken: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ id: string }> {
    try {
      const response = await axios.post<{ id: string }>(
        `${this.baseUrl}/${pageId}/photos`,
        null,
        {
          params: {
            url: imageUrl,
            published: false,
            caption: caption || '',
            access_token: pageAccessToken,
          },
          timeout: 60000, // 60s timeout for photo upload
        }
      );
      return response.data;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Publish multi-photo post to Page Feed using attached_media
   * POST /{page-id}/feed with message & attached_media: [{media_fbid: 'photo_id'}, ...]
   */
  async createMultiPhotoPost(
    pageId: string,
    pageAccessToken: string,
    message: string,
    photoIds: string[]
  ): Promise<{ id: string; postUrl: string }> {
    try {
      const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));

      const response = await axios.post<{ id: string }>(
        `${this.baseUrl}/${pageId}/feed`,
        {
          message: message,
          attached_media: attachedMedia,
          access_token: pageAccessToken,
        },
        {
          timeout: 45000, // 45s timeout for feed creation
        }
      );

      const postId = response.data.id;
      // Format Facebook URL: https://facebook.com/{postId}
      const postUrl = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;

      return {
        id: postId,
        postUrl: postUrl,
      };
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Reconcile/verify if a feed post was created (for timeout/unknown state recovery)
   */
  async verifyPostExists(
    postId: string,
    pageAccessToken: string
  ): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/${postId}`, {
        params: {
          fields: 'id,created_time',
          access_token: pageAccessToken,
        },
      });
      return !!response.data?.id;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      return false;
    }
  }

  /**
   * Parse Graph API errors and categorize them
   */
  parseError(err: any): GraphApiErrorDetails {
    // If already parsed
    if (err && err.type && err.message) {
      return err as GraphApiErrorDetails;
    }

    if (axios.isAxiosError(err)) {
      const axiosError = err as AxiosError<any>;

      // Check for timeout
      if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        return {
          type: 'NETWORK_TIMEOUT',
          message: 'Timeout khi kết nối tới Meta Graph API',
          retryable: true,
        };
      }

      const fbError = axiosError.response?.data?.error;
      if (fbError) {
        const code = fbError.code;
        const subcode = fbError.error_subcode;
        const message = fbError.message || 'Lỗi từ Meta Graph API';

        // Token expired / revoked (Codes 190, 102)
        if (code === 190 || code === 102) {
          return {
            type: 'TOKEN_EXPIRED',
            message: `Facebook Token đã hết hạn hoặc bị thu hồi (${message})`,
            code,
            subcode,
            retryable: false,
          };
        }

        // Permission denied (Codes 200, 10, 283)
        if (code === 200 || code === 10 || code === 283) {
          return {
            type: 'PERMISSION_DENIED',
            message: `Không có quyền đăng bài trên Fanpage này (${message})`,
            code,
            subcode,
            retryable: false,
          };
        }

        // Rate limit (Codes 4, 17, 32, 613)
        if (code === 4 || code === 17 || code === 32 || code === 613) {
          // Check retry-after header
          const retryAfter = axiosError.response?.headers['retry-after'];
          const seconds = retryAfter ? parseInt(retryAfter, 10) : 300; // default 5m
          return {
            type: 'RATE_LIMIT',
            message: `Bị giới hạn tần suất gọi API từ Facebook (${message})`,
            code,
            subcode,
            retryable: true,
            retryAfterSeconds: seconds,
          };
        }

        return {
          type: 'UNKNOWN',
          message: `Lỗi Meta Graph API [${code}]: ${message}`,
          code,
          subcode,
          retryable: false,
        };
      }

      // Network / 5xx error
      if (!axiosError.response || axiosError.response.status >= 500) {
        return {
          type: 'NETWORK_TIMEOUT',
          message: 'Máy chủ Facebook trả về lỗi 5xx hoặc mạng gián đoạn',
          retryable: true,
        };
      }
    }

    return {
      type: 'UNKNOWN',
      message: err?.message || 'Lỗi không xác định khi gọi Facebook API',
      retryable: false,
    };
  }
}

export const facebookGraphService = new FacebookGraphService();
