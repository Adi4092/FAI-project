import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  resetPassword
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', resetPassword);

export default router;
