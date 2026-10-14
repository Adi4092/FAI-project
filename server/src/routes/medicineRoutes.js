import { Router } from 'express';
import {
  getMedicines,
  createMedicine,
  getMedicineById,
  updateMedicine,
  updateMedicineStatus,
  getMedicineBatches,
  getMedicineSuppliers,
  updateMedicineSuppliers
} from '../controllers/medicineController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createMedicineSchema,
  updateMedicineSchema,
  updateMedicineStatusSchema,
  updateMedicineSuppliersSchema
} from '../validators/medicineValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', getMedicines);
router.post('/', authorize('admin', 'inventory_manager'), validate(createMedicineSchema), createMedicine);
router.get('/:id', getMedicineById);
router.put('/:id', authorize('admin', 'inventory_manager'), validate(updateMedicineSchema), updateMedicine);
router.patch(
  '/:id/status',
  authorize('admin', 'inventory_manager'),
  validate(updateMedicineStatusSchema),
  updateMedicineStatus
);
router.get('/:id/batches', getMedicineBatches);
router.get('/:id/suppliers', getMedicineSuppliers);
router.put(
  '/:id/suppliers',
  authorize('admin', 'inventory_manager'),
  validate(updateMedicineSuppliersSchema),
  updateMedicineSuppliers
);

export default router;
