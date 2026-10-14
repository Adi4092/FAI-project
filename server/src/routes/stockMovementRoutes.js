import { Router } from 'express';
import {
  getStockMovements,
  exportStockMovements,
  correct
} from '../controllers/stockMovementController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { correctMovementSchema } from '../validators/inventoryValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', getStockMovements);
router.get('/export', authorize('admin', 'inventory_manager'), exportStockMovements);
router.post(
  '/:id/correct',
  authorize('admin', 'inventory_manager'),
  validate(correctMovementSchema),
  correct
);

export default router;
