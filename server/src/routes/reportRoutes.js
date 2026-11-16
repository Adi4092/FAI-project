import { Router } from 'express';
import {
  getConsumptionReport,
  getStockMovementsReport,
  getWastageReport,
  getExpiryExposureReport,
  getStockoutsReport,
  getPurchasesReport,
  getValuationReport,
  getForecastPerformanceReport,
  getReordersReport
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'inventory_manager'));

router.get('/consumption', getConsumptionReport);
router.get('/stock-movements', getStockMovementsReport);
router.get('/wastage', getWastageReport);
router.get('/expiry-exposure', getExpiryExposureReport);
router.get('/stockouts', getStockoutsReport);
router.get('/purchases', getPurchasesReport);
router.get('/valuation', getValuationReport);
router.get('/forecast-performance', getForecastPerformanceReport);
router.get('/reorders', getReordersReport);

export default router;
