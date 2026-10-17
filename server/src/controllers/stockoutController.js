import { getStockoutPredictions } from '../services/stockoutService.js';
import { successResponse } from '../utils/apiResponse.js';

export async function getPredictions(req, res, next) {
  try {
    const { riskLevel, q, page, limit } = req.query;
    const { predictions, meta } = await getStockoutPredictions({
      riskLevel: riskLevel || null,
      q: q || '',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });
    return successResponse(res, predictions, 200, meta);
  } catch (error) {
    next(error);
  }
}
