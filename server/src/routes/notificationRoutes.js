import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import {
  list,
  readOne,
  readAll,
  unreadCount,
  triggerAlertJob
} from '../controllers/notificationController.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.patch('/:id/read', readOne);
router.post('/mark-all-read', readAll);
router.get('/unread-count', unreadCount);
router.post('/run-alerts', authorize('admin', 'inventory_manager'), triggerAlertJob);

export default router;
