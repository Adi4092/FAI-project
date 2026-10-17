import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import {
  list,
  generate,
  approve,
  reject,
  adjust
} from '../controllers/reorderController.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'inventory_manager'));

router.get('/', list);
router.post('/generate', generate);
router.post('/:id/approve', approve);
router.post('/:id/reject', reject);
router.post('/:id/adjust', adjust);

export default router;
