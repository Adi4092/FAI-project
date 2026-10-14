import { AuditLog } from '../models/AuditLog.js';
import { successResponse } from '../utils/apiResponse.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = {};

    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.entityType) {
      filter.entityType = req.query.entityType;
    }
    if (req.query.entityId) {
      filter.entityId = req.query.entityId;
    }

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('actorId', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return successResponse(
      res,
      logs.map((l) => l.toJSON()),
      200,
      buildPaginationMeta(total, page, limit)
    );
  } catch (error) {
    next(error);
  }
}
