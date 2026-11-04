import { Router } from 'express';
import { facebookController } from '../controllers/facebook.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// OAuth initiation & callback
router.get('/oauth/start', authenticate, (req, res, next) => facebookController.startOAuth(req, res, next));
router.get('/oauth/callback', (req, res, next) => facebookController.handleOAuthCallback(req, res, next));

// Accounts & Pages
router.post('/import-token', authenticate, (req, res, next) => facebookController.importToken(req, res, next));
router.get('/accounts', authenticate, (req, res, next) => facebookController.getAccounts(req, res, next));
router.delete('/accounts/:id', authenticate, (req, res, next) => facebookController.disconnectAccount(req, res, next));

router.get('/pages', authenticate, (req, res, next) => facebookController.getPages(req, res, next));
router.get('/pages/:id', authenticate, (req, res, next) => facebookController.getPageById(req, res, next));
router.post('/sync-pages', authenticate, (req, res, next) => facebookController.syncPages(req, res, next));
router.post('/pages/:id/check-permissions', authenticate, (req, res, next) => facebookController.checkPermissions(req, res, next));

export default router;

