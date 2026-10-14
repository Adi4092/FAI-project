import { Router } from 'express';
import {
  getSummary,
  getFefoPreview,
  receive,
  dispense,
  returnItem,
  adjust,
  writeOff,
  reconcile
} from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  receiveStockSchema,
  dispenseStockSchema,
  returnStockSchema,
  adjustStockSchema,
  writeOffStockSchema,
  fefoPreviewSchema
} from '../validators/inventoryValidator.js';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/fefo-preview', validate(fefoPreviewSchema), getFefoPreview);
router.post('/receive', authorize('admin', 'inventory_manager'), validate(receiveStockSchema), receive);
router.post('/dispense', authorize('admin', 'inventory_manager', 'staff'), validate(dispenseStockSchema), dispense);
router.post('/return', authorize('admin', 'inventory_manager', 'staff'), validate(returnStockSchema), returnItem);
router.post('/adjust', authorize('admin', 'inventory_manager'), validate(adjustStockSchema), adjust);
router.post('/write-off', authorize('admin', 'inventory_manager'), validate(writeOffStockSchema), writeOff);
router.get('/reconcile', authorize('admin'), reconcile);

export default router;
