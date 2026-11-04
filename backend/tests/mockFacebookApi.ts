import { vi } from 'vitest';
import axios from 'axios';

export interface MockGraphBehavior {
  photoUploadFails?: boolean;
  feedPostFails?: boolean;
  rateLimit?: boolean;
  tokenExpired?: boolean;
  permissionDenied?: boolean;
  networkTimeout?: boolean;
}

export function setupMockFacebookApi(behavior: MockGraphBehavior = {}) {
  let photoUploadCount = 0;
  let feedPostCount = 0;

  const spyPost = vi.spyOn(axios, 'post').mockImplementation(async (url: string, data?: any, config?: any) => {
    // 1. Photo upload endpoint: /{page-id}/photos
    if (url.includes('/photos')) {
      if (behavior.tokenExpired) {
        const err: any = new Error('Session has expired');
        err.isAxiosError = true;
        err.response = { status: 400, data: { error: { code: 190, message: 'Error validating access token' } } };
        throw err;
      }

      if (behavior.permissionDenied) {
        const err: any = new Error('Permission denied');
        err.isAxiosError = true;
        err.response = { status: 403, data: { error: { code: 200, message: 'Permissions error' } } };
        throw err;
      }

      if (behavior.rateLimit) {
        const err: any = new Error('Rate limit hit');
        err.isAxiosError = true;
        err.response = {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { error: { code: 32, message: 'Application request limit reached' } },
        };
        throw err;
      }

      if (behavior.photoUploadFails) {
        const err: any = new Error('Invalid image file');
        err.isAxiosError = true;
        err.response = { status: 400, data: { error: { code: 100, message: 'Invalid image format' } } };
        throw err;
      }

      photoUploadCount++;
      return {
        status: 200,
        data: { id: `fb_photo_${Date.now()}_${photoUploadCount}` },
      };
    }

    // 2. Feed post endpoint: /{page-id}/feed
    if (url.includes('/feed')) {
      if (behavior.networkTimeout) {
        const err: any = new Error('timeout of 45000ms exceeded');
        err.isAxiosError = true;
        err.code = 'ECONNABORTED';
        throw err;
      }

      if (behavior.feedPostFails) {
        const err: any = new Error('Facebook server error');
        err.isAxiosError = true;
        err.response = { status: 500, data: { error: { code: 2, message: 'Service temporarily unavailable' } } };
        throw err;
      }

      feedPostCount++;
      const postId = `123456789_${Date.now()}_${feedPostCount}`;
      return {
        status: 200,
        data: { id: postId },
      };
    }

    return { status: 200, data: {} };
  });

  const spyGet = vi.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
    // me/accounts endpoint
    if (url.includes('/me/accounts')) {
      return {
        status: 200,
        data: {
          data: [
            {
              id: 'page_1',
              name: 'Fanpage Thời Trang',
              access_token: 'page_token_1',
              tasks: ['MANAGE', 'CREATE_CONTENT'],
            },
            {
              id: 'page_2',
              name: 'Fanpage Mỹ Phẩm',
              access_token: 'page_token_2',
              tasks: ['MANAGE', 'CREATE_CONTENT'],
            },
            {
              id: 'page_3',
              name: 'Fanpage Phụ Kiện',
              access_token: 'page_token_3',
              tasks: ['MANAGE', 'CREATE_CONTENT'],
            },
          ],
        },
      };
    }

    // oauth token endpoint
    if (url.includes('/oauth/access_token')) {
      return {
        status: 200,
        data: {
          access_token: 'mock_user_access_token_long_lived',
          expires_in: 5184000, // 60 days
        },
      };
    }

    // me profile endpoint
    if (url.includes('/me')) {
      return {
        status: 200,
        data: {
          id: 'fb_user_123456',
          name: 'Xeko Nguyễn',
        },
      };
    }

    // check post existence
    return {
      status: 200,
      data: { id: 'mock_existing_id', created_time: new Date().toISOString() },
    };
  });

  return {
    spyPost,
    spyGet,
    getPhotoUploadCount: () => photoUploadCount,
    getFeedPostCount: () => feedPostCount,
    restore: () => {
      spyPost.mockRestore();
      spyGet.mockRestore();
    },
  };
}

