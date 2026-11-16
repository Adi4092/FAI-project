import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getTemplate,
  previewImport,
  commitImport
} from '../controllers/settingController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

// Templates download (all authenticated roles)
router.get('/templates/:name', getTemplate);

// CSV import (Admin and Inventory Manager)
router.post('/import/preview', authorize('admin', 'inventory_manager'), previewImport);
router.post('/import/commit', authorize('admin', 'inventory_manager'), commitImport);

// System Settings document (Admin only)
router.get('/', authorize('admin'), getSettings);
router.put('/', authorize('admin'), updateSettings);

export default router;
