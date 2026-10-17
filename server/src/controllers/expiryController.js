import { getExpiryRisk, getBatchExpiryRisk } from '../services/expiryRiskService.js';
import { successResponse } from '../utils/apiResponse.js';

export async function getRisk(req, res, next) {
  try {
    const { windowDays, medicineId, riskLevel, page, limit } = req.query;
    const result = await getExpiryRisk({
      windowDays: windowDays ? Number(windowDays) : 30,
      medicineId: medicineId || null,
      riskLevel: riskLevel || null,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });
    return successResponse(res, {
      summary: result.summary,
      batches: result.batches
    }, 200, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getByBatchId(req, res, next) {
  try {
    const batchRisk = await getBatchExpiryRisk(req.params.batchId);
    return successResponse(res, batchRisk);
  } catch (error) {
    next(error);
  }
}
