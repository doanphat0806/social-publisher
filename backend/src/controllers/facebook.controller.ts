import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { FacebookAccount, FacebookPage } from '../models/index.js';
import { facebookGraphService } from '../services/facebookGraph.service.js';
import { encryptToken, decryptToken } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Cache OAuth states in memory with 10-minute expiry
const oauthStateCache = new Map<string, { userId: string; timestamp: number }>();

export class FacebookController {
  /**
   * GET /facebook/oauth/start
   */
  async startOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const state = crypto.randomBytes(24).toString('hex');

      oauthStateCache.set(state, {
        userId,
        timestamp: Date.now(),
      });

      // Clean up old states (> 10 mins)
      const now = Date.now();
      for (const [key, val] of oauthStateCache.entries()) {
        if (now - val.timestamp > 10 * 60 * 1000) {
          oauthStateCache.delete(key);
        }
      }

      const authUrl = facebookGraphService.getOAuthUrl(state);
      res.json({ success: true, data: { authUrl } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /facebook/oauth/callback
   */
  async handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.error('Facebook OAuth rejected by user:', error_description);
        res.redirect(`${env.CLIENT_URL}/fanpages?error=${encodeURIComponent(String(error_description || 'OAuth Cancelled'))}`);
        return;
      }

      if (!code || !state) {
        res.status(400).send('Missing code or state parameter');
        return;
      }

      const stateData = oauthStateCache.get(String(state));
      if (!stateData) {
        res.status(400).send('Invalid or expired OAuth state');
        return;
      }
      oauthStateCache.delete(String(state));

      const userId = stateData.userId;

      // 1. Exchange code for short-lived token
      const shortTokenData = await facebookGraphService.exchangeCodeForToken(String(code));

      // 2. Exchange for long-lived token (60 days)
      const longTokenData = await facebookGraphService.getLongLivedToken(shortTokenData.access_token);
      const userAccessToken = longTokenData.access_token;
      const expiresInSec = longTokenData.expires_in || 60 * 24 * 3600;
      const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

      // 3. Get Facebook user profile
      const fbProfile = await facebookGraphService.getUserProfile(userAccessToken);

      // 4. Save or update FacebookAccount
      const encryptedUserToken = encryptToken(userAccessToken);
      const fbAccount = await FacebookAccount.findOneAndUpdate(
        { userId, facebookUserId: fbProfile.id },
        {
          userId,
          facebookUserId: fbProfile.id,
          facebookName: fbProfile.name,
          accessTokenEncrypted: encryptedUserToken,
          tokenExpiresAt,
          status: 'active',
          lastSyncAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // 5. Fetch managed Pages
      const pages = await facebookGraphService.getUserPages(userAccessToken);

      // 6. Save or update each FacebookPage
      for (const page of pages) {
        const encryptedPageToken = encryptToken(page.access_token);
        await FacebookPage.findOneAndUpdate(
          { userId, pageId: page.id },
          {
            userId,
            facebookAccountId: fbAccount._id,
            pageId: page.id,
            pageName: page.name,
            pageCategory: page.category || 'General',
            avatarUrl: page.picture?.data?.url || '',
            pageAccessTokenEncrypted: encryptedPageToken,
            permissions: page.tasks || [],
            status: 'active',
            lastSyncAt: new Date(),
          },
          { upsert: true }
        );
      }

      logger.info(`Synced ${pages.length} pages for Facebook user ${fbProfile.name}`);
      res.redirect(`${env.CLIENT_URL}/fanpages?connected=true&count=${pages.length}`);
    } catch (error) {
      logger.error('Error in Facebook OAuth callback:', error);
      res.redirect(`${env.CLIENT_URL}/fanpages?error=${encodeURIComponent('Có lỗi khi kết nối Facebook')}`);
    }
  }

  /**
   * POST /facebook/import-token
   * Imports Facebook Access Token directly, verifies via Meta Graph API,
   * encrypts token with AES-256-GCM, and saves FacebookAccount + FacebookPages to database.
   */
  async importToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { accessToken } = req.body;

      if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập Access Token hợp lệ' });
        return;
      }

      const cleanToken = accessToken.trim();

      // 1. Verify token by fetching Facebook user/page profile
      let profile;
      try {
        profile = await facebookGraphService.getUserProfile(cleanToken);
      } catch (err: any) {
        res.status(400).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn: ' + (err.message || 'Lỗi xác thực Facebook'),
        });
        return;
      }

      // Try exchanging for long-lived token (60 days) if App ID & Secret are set
      let finalUserToken = cleanToken;
      if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
        try {
          const longLived = await facebookGraphService.getLongLivedToken(cleanToken);
          if (longLived?.access_token) {
            finalUserToken = longLived.access_token;
          }
        } catch {
          // If exchange is not applicable (e.g. page token), keep current token
        }
      }

      const encryptedUserToken = encryptToken(finalUserToken);

      // Save or update FacebookAccount
      const fbAccount = await FacebookAccount.findOneAndUpdate(
        { userId, facebookUserId: profile.id },
        {
          userId,
          facebookUserId: profile.id,
          facebookName: profile.name,
          accessTokenEncrypted: encryptedUserToken,
          status: 'active',
          lastSyncAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // 2. Fetch pages managed by this token (/me/accounts)
      let pages: any[] = [];
      try {
        pages = await facebookGraphService.getUserPages(finalUserToken);
      } catch (pageErr: any) {
        logger.warn('Could not fetch /me/accounts with token:', pageErr.message);
      }

      const savedPages: any[] = [];

      if (pages && pages.length > 0) {
        // User Token with multiple managed pages
        for (const page of pages) {
          const encryptedPageToken = encryptToken(page.access_token);
          const savedPage = await FacebookPage.findOneAndUpdate(
            { userId, pageId: page.id },
            {
              userId,
              facebookAccountId: fbAccount._id,
              pageId: page.id,
              pageName: page.name,
              pageCategory: page.category || 'General',
              avatarUrl: page.picture?.data?.url || '',
              pageAccessTokenEncrypted: encryptedPageToken,
              permissions: page.tasks || ['MANAGE', 'CREATE_CONTENT'],
              status: 'active',
              lastSyncAt: new Date(),
            },
            { upsert: true, new: true }
          );
          savedPages.push(savedPage);
        }
      } else {
        // If /me/accounts returned empty, check if token itself is directly a Page Access Token
        const encryptedPageToken = encryptToken(finalUserToken);
        const savedPage = await FacebookPage.findOneAndUpdate(
          { userId, pageId: profile.id },
          {
            userId,
            facebookAccountId: fbAccount._id,
            pageId: profile.id,
            pageName: profile.name,
            pageCategory: 'Page',
            pageAccessTokenEncrypted: encryptedPageToken,
            permissions: ['MANAGE', 'CREATE_CONTENT'],
            status: 'active',
            lastSyncAt: new Date(),
          },
          { upsert: true, new: true }
        );
        savedPages.push(savedPage);
      }

      if (savedPages.length === 0) {
        res.status(400).json({
          success: false,
          message: `Xác thực thành công tài khoản "${profile.name}", nhưng chưa tìm thấy Fanpage nào được cấp quyền.`,
        });
        return;
      }

      res.json({
        success: true,
        message: `Đã kết nối thành công và lưu ${savedPages.length} Fanpage vào cơ sở dữ liệu!`,
        data: {
          account: {
            id: fbAccount._id,
            name: fbAccount.facebookName,
            userId: fbAccount.facebookUserId,
          },
          savedCount: savedPages.length,
          pages: savedPages.map((p) => ({
            id: p._id,
            pageId: p.pageId,
            pageName: p.pageName,
            avatarUrl: p.avatarUrl,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /facebook/accounts
   */
  async getAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const accounts = await FacebookAccount.find({ userId })
        .select('-accessTokenEncrypted')
        .sort({ createdAt: -1 });

      res.json({ success: true, data: { accounts } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /facebook/pages
   */
  async getPages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const { status, search } = req.query;

      const query: any = { userId };
      if (status) query.status = status;
      if (search) query.pageName = { $regex: String(search), $options: 'i' };

      const pages = await FacebookPage.find(query)
        .select('-pageAccessTokenEncrypted')
        .populate('facebookAccountId', 'facebookName')
        .sort({ pageName: 1 });

      res.json({
        success: true,
        data: {
          total: pages.length,
          pages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /facebook/sync-pages
   */
  async syncPages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const accounts = await FacebookAccount.find({ userId, status: 'active' });

      let totalSynced = 0;
      for (const account of accounts) {
        try {
          const userAccessToken = decryptToken(account.accessTokenEncrypted);
          const pages = await facebookGraphService.getUserPages(userAccessToken);

          for (const page of pages) {
            const encryptedPageToken = encryptToken(page.access_token);
            await FacebookPage.findOneAndUpdate(
              { userId, pageId: page.id },
              {
                userId,
                facebookAccountId: account._id,
                pageId: page.id,
                pageName: page.name,
                pageCategory: page.category || 'General',
                avatarUrl: page.picture?.data?.url || '',
                pageAccessTokenEncrypted: encryptedPageToken,
                permissions: page.tasks || [],
                status: 'active',
                lastSyncAt: new Date(),
              },
              { upsert: true }
            );
            totalSynced++;
          }
          account.lastSyncAt = new Date();
          await account.save();
        } catch (err: any) {
          logger.warn(`Failed to sync pages for account ${account.facebookName}:`, err.message);
        }
      }

      res.json({
        success: true,
        message: `Đồng bộ thành công ${totalSynced} Fanpage`,
        data: { syncedCount: totalSynced },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /facebook/pages/:id
   */
  async getPageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = await FacebookPage.findOne({ _id: req.params.id, userId })
        .select('-pageAccessTokenEncrypted');

      if (!page) {
        res.status(404).json({ success: false, message: 'Fanpage không tồn tại' });
        return;
      }

      res.json({ success: true, data: { page } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /facebook/accounts/:id
   */
  async disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const account = await FacebookAccount.findOne({ _id: req.params.id, userId });

      if (!account) {
        res.status(404).json({ success: false, message: 'Tài khoản Facebook không tồn tại' });
        return;
      }

      // Delete associated pages
      await FacebookPage.deleteMany({ facebookAccountId: account._id, userId });
      await account.deleteOne();

      res.json({ success: true, message: 'Đã ngắt kết nối tài khoản Facebook thành công' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /facebook/pages/:id/check-permissions
   */
  async checkPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = await FacebookPage.findOne({ _id: req.params.id, userId });

      if (!page) {
        res.status(404).json({ success: false, message: 'Fanpage không tồn tại' });
        return;
      }

      const token = decryptToken(page.pageAccessTokenEncrypted);
      const isAlive = await facebookGraphService.verifyPostExists(page.pageId, token);

      res.json({
        success: true,
        data: {
          pageId: page.pageId,
          pageName: page.pageName,
          status: page.status,
          permissions: page.permissions,
          valid: true,
        },
      });
    } catch (error: any) {
      const parsed = facebookGraphService.parseError(error);
      res.json({
        success: false,
        message: parsed.message,
        data: { valid: false, error: parsed },
      });
    }
  }
}

export const facebookController = new FacebookController();

