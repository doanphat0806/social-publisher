import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCampaignSchema, updateCampaignSchema, previewCampaignSchema } from '../validators/campaign.validator.js';

const router = Router();

router.post('/preview', authenticate, validateBody(previewCampaignSchema), (req, res, next) => campaignController.preview(req, res, next));
router.post('/', authenticate, validateBody(createCampaignSchema), (req, res, next) => campaignController.create(req, res, next));
router.get('/', authenticate, (req, res, next) => campaignController.list(req, res, next));
router.get('/:id', authenticate, (req, res, next) => campaignController.getById(req, res, next));
router.patch('/:id', authenticate, validateBody(updateCampaignSchema), (req, res, next) => campaignController.update(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => campaignController.delete(req, res, next));

router.post('/:id/start', authenticate, (req, res, next) => campaignController.start(req, res, next));
router.post('/:id/pause', authenticate, (req, res, next) => campaignController.pause(req, res, next));
router.post('/:id/resume', authenticate, (req, res, next) => campaignController.resume(req, res, next));
router.post('/:id/cancel', authenticate, (req, res, next) => campaignController.cancel(req, res, next));

export default router;

