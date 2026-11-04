import { Router } from 'express';
import { postController } from '../controllers/post.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/campaigns/:id/posts', authenticate, (req, res, next) => postController.getCampaignPosts(req, res, next));
router.get('/:id', authenticate, (req, res, next) => postController.getById(req, res, next));
router.patch('/:id/caption', authenticate, (req, res, next) => postController.updateCaption(req, res, next));
router.patch('/:id/images', authenticate, (req, res, next) => postController.updateImages(req, res, next));

export default router;

