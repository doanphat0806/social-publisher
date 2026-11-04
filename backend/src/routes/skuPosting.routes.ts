import { Router } from 'express';
import multer from 'multer';
import { skuPostingController } from '../controllers/skuPosting.controller.js';
import { authenticate } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh định dạng JPG, JPEG, PNG, WEBP'));
    }
  },
});

const router = Router();

// 1. Scan images & Group by SKU
router.post('/scan-images', authenticate, upload.array('files', 500), (req, res, next) =>
  skuPostingController.scanImages(req, res, next)
);

// 2. Import Excel/CSV SKU price data
router.post('/import-products', authenticate, (req, res, next) =>
  skuPostingController.importProducts(req, res, next)
);

// 3. Preview Campaign
router.post('/preview', authenticate, (req, res, next) =>
  skuPostingController.previewCampaign(req, res, next)
);

// 4. Campaign CRUD
router.post('/campaigns', authenticate, (req, res, next) =>
  skuPostingController.createCampaign(req, res, next)
);

router.get('/campaigns', authenticate, (req, res, next) =>
  skuPostingController.getCampaigns(req, res, next)
);

router.get('/campaigns/:id', authenticate, (req, res, next) =>
  skuPostingController.getCampaignById(req, res, next)
);

router.post('/campaigns/:id/start', authenticate, (req, res, next) =>
  skuPostingController.startCampaign(req, res, next)
);

router.post('/campaigns/:id/pause', authenticate, (req, res, next) =>
  skuPostingController.pauseCampaign(req, res, next)
);

router.post('/campaigns/:id/resume', authenticate, (req, res, next) =>
  skuPostingController.resumeCampaign(req, res, next)
);

router.post('/campaigns/:id/cancel', authenticate, (req, res, next) =>
  skuPostingController.cancelCampaign(req, res, next)
);

// 5. Tasks, Retry & Logs
router.get('/campaigns/:id/tasks', authenticate, (req, res, next) =>
  skuPostingController.getCampaignTasks(req, res, next)
);

router.post('/tasks/:id/retry', authenticate, (req, res, next) =>
  skuPostingController.retryTask(req, res, next)
);

router.get('/campaigns/:id/logs', authenticate, (req, res, next) =>
  skuPostingController.getCampaignLogs(req, res, next)
);

// 6. Export Results
router.get('/campaigns/:id/export', authenticate, (req, res, next) =>
  skuPostingController.exportCampaignExcel(req, res, next)
);

export default router;

