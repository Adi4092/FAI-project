import { Router } from 'express';
import {
  getSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  updateSupplierStatus,
  getSupplierBatches,
  getSupplierPurchaseOrders
} from '../controllers/supplierController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema
} from '../validators/supplierValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', getSuppliers);
router.post('/', authorize('admin', 'inventory_manager'), validate(createSupplierSchema), createSupplier);
router.get('/:id', getSupplierById);
router.put('/:id', authorize('admin', 'inventory_manager'), validate(updateSupplierSchema), updateSupplier);
router.patch(
  '/:id/status',
  authorize('admin', 'inventory_manager'),
  validate(updateSupplierStatusSchema),
  updateSupplierStatus
);
router.get('/:id/batches', getSupplierBatches);
router.get('/:id/purchase-orders', authorize('admin', 'inventory_manager'), getSupplierPurchaseOrders);

export default router;
