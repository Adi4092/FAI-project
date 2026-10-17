import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getRisk, getByBatchId } from '../controllers/expiryController.js';

const router = Router();

router.use(authenticate);

router.get('/', getRisk);
router.get('/batch/:batchId', getByBatchId);

export default router;
