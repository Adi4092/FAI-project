import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getPredictions } from '../controllers/stockoutController.js';

const router = Router();

router.use(authenticate);

router.get('/', getPredictions);

export default router;
