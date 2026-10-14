import { Router } from 'express';
import { getSettings, updateSettings, getTemplate } from '../controllers/settingController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/templates/:name', getTemplate);
router.get('/', authorize('admin'), getSettings);
router.put('/', authorize('admin'), updateSettings);

export default router;
