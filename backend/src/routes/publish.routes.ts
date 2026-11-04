import { Router } from 'express';
import { publishController } from '../controllers/publish.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/tasks', authenticate, (req, res, next) => publishController.getTasks(req, res, next));
router.get('/tasks/:id', authenticate, (req, res, next) => publishController.getTaskById(req, res, next));
router.post('/tasks/:id/retry', authenticate, (req, res, next) => publishController.retryTask(req, res, next));
router.post('/tasks/:id/cancel', authenticate, (req, res, next) => publishController.cancelTask(req, res, next));

router.get('/campaigns/:id/stats', authenticate, (req, res, next) => publishController.getCampaignStats(req, res, next));
router.get('/campaigns/:id/logs', authenticate, (req, res, next) => publishController.getCampaignLogs(req, res, next));

export default router;

