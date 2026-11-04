import { Router } from 'express';
import authRoutes from './auth.routes.js';
import facebookRoutes from './facebook.routes.js';
import mediaRoutes from './media.routes.js';
import campaignRoutes from './campaign.routes.js';
import postRoutes from './post.routes.js';
import publishRoutes from './publish.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import watermarkRoutes from './watermark.routes.js';
import skuPostingRoutes from './skuPosting.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/facebook', facebookRoutes);
router.use('/media', mediaRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/posts', postRoutes);
router.use('/publish', publishRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/watermark', watermarkRoutes);
router.use('/sku-posting', skuPostingRoutes);

export default router;
