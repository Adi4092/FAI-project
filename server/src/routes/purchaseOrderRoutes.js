import { Router } from 'express';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder
} from '../controllers/purchaseOrderController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'inventory_manager'));

router.get('/', listPurchaseOrders);
router.post('/', createPurchaseOrder);
router.get('/:id', getPurchaseOrder);
router.put('/:id', updatePurchaseOrder);
router.post('/:id/submit', submitPurchaseOrder);
router.post('/:id/approve', approvePurchaseOrder);
router.post('/:id/reject', rejectPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);
router.post('/:id/cancel', cancelPurchaseOrder);

export default router;
