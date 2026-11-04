import { Router } from 'express';
import multer from 'multer';
import { mediaController } from '../controllers/media.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { presignMediaSchema } from '../validators/media.validator.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận định dạng ảnh JPG, JPEG, PNG, WEBP'));
    }
  },
});

const router = Router();

router.post('/presign', authenticate, validateBody(presignMediaSchema), (req, res, next) => mediaController.presign(req, res, next));
router.post('/complete', authenticate, (req, res, next) => mediaController.complete(req, res, next));
router.post('/upload-direct', authenticate, upload.single('file'), (req, res, next) => mediaController.uploadDirect(req, res, next));
router.get('/', authenticate, (req, res, next) => mediaController.getMedia(req, res, next));
router.get('/:id', authenticate, (req, res, next) => mediaController.getMediaById(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => mediaController.deleteMedia(req, res, next));
router.post('/bulk-delete', authenticate, (req, res, next) => mediaController.bulkDelete(req, res, next));

export default router;

