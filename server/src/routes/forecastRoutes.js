import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import {
  generate,
  list,
  getById,
  getUsage,
  refreshUsage,
  retrain,
  getModelInfo,
  getHealth
} from '../controllers/forecastController.js';

const router = Router();

router.use(authenticate);

router.post('/generate', authorize('admin', 'inventory_manager'), generate);
router.get('/', list);
router.post('/refresh-usage', authorize('admin', 'inventory_manager'), refreshUsage);
router.post('/retrain', authorize('admin'), retrain);
router.get('/model-info', getModelInfo);
router.get('/health', getHealth);
router.get('/usage/:medicineId', getUsage);
router.get('/:id', getById);

export default router;
