import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getAuditLogs);

export default router;
