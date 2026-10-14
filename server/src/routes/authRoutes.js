import { Router } from 'express';
import { login, refresh, logout, getMe, getCsrfToken } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/authValidator.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/csrf', getCsrfToken);

export default router;
