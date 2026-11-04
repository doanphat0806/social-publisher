import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validateBody(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validateBody(loginSchema), (req, res, next) => authController.login(req, res, next));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
router.post('/refresh', authenticate, (req, res) => authController.refresh(req, res));

export default router;

