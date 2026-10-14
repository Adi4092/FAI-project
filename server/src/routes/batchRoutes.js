import { Router } from 'express';
import {
  getBatches,
  createBatch,
  getBatchById,
  updateBatch,
  getBatchHistory
} from '../controllers/batchController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createBatchSchema, updateBatchSchema } from '../validators/batchValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', getBatches);
router.post('/', authorize('admin', 'inventory_manager'), validate(createBatchSchema), createBatch);
router.get('/:id', getBatchById);
router.put('/:id', authorize('admin', 'inventory_manager'), validate(updateBatchSchema), updateBatch);
router.get('/:id/history', getBatchHistory);

export default router;
