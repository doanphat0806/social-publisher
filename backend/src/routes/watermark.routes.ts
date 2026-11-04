import { Router } from 'express';
import multer from 'multer';
import { watermarkController } from '../controllers/watermark.controller.js';
import { authenticate } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB per image
    files: 500, // up to 500 images at once
  },
});

const router = Router();

router.post('/preview-single', authenticate, upload.single('file'), (req, res, next) =>
  watermarkController.previewSingle(req, res, next)
);

router.post('/batch-process', authenticate, upload.array('files', 500), (req, res, next) =>
  watermarkController.batchProcess(req, res, next)
);

router.get('/templates', authenticate, (req, res, next) =>
  watermarkController.getTemplates(req, res, next)
);

router.post('/templates', authenticate, (req, res, next) =>
  watermarkController.saveTemplate(req, res, next)
);

router.delete('/templates/:id', authenticate, (req, res, next) =>
  watermarkController.deleteTemplate(req, res, next)
);

export default router;

