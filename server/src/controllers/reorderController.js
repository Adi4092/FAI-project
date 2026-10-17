import {
  getReorderRecommendations,
  generateReorderRecommendations,
  approveRecommendation,
  rejectRecommendation,
  adjustRecommendation
} from '../services/reorderService.js';
import { successResponse } from '../utils/apiResponse.js';

export async function list(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await getReorderRecommendations({
      status: status || null,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });
    return successResponse(res, {
      summary: result.summary,
      recommendations: result.recommendations
    }, 200, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function generate(req, res, next) {
  try {
    const recommendations = await generateReorderRecommendations(req.user?.id);
    return successResponse(res, {
      message: `Generated ${recommendations.length} reorder recommendations based on current inventory position and lead time demand.`,
      count: recommendations.length
    }, 201);
  } catch (error) {
    next(error);
  }
}

export async function approve(req, res, next) {
  try {
    const result = await approveRecommendation(req.params.id, req.user?.id);
    return successResponse(res, {
      message: 'Reorder recommendation approved and draft purchase order created.',
      recommendation: result.recommendation,
      purchaseOrder: result.purchaseOrder
    });
  } catch (error) {
    next(error);
  }
}

export async function reject(req, res, next) {
  try {
    const { reason } = req.body;
    const rec = await rejectRecommendation(req.params.id, reason, req.user?.id);
    return successResponse(res, {
      message: 'Reorder recommendation rejected.',
      recommendation: rec
    });
  } catch (error) {
    next(error);
  }
}

export async function adjust(req, res, next) {
  try {
    const { quantity, note } = req.body;
    const rec = await adjustRecommendation(req.params.id, quantity, note, req.user?.id);
    return successResponse(res, {
      message: 'Reorder recommendation adjusted successfully.',
      recommendation: rec
    });
  } catch (error) {
    next(error);
  }
}
