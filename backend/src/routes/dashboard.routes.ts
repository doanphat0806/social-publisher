import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/overview', authenticate, (req, res, next) => dashboardController.getOverview(req, res, next));
router.get('/publishing-chart', authenticate, (req, res, next) => dashboardController.getPublishingChart(req, res, next));
router.get('/recent-activities', authenticate, (req, res, next) => dashboardController.getRecentActivities(req, res, next));

export default router;

