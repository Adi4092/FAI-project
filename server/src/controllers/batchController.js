import { Batch } from '../models/Batch.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/ApiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';
import { getStartOfToday } from '../utils/dates.js';
import { receiveStock } from '../services/stockService.js';
import { logAudit } from '../services/auditService.js';

export async function getBatches(req, res, next) {
  try {
    const { page, limit, skip, sort } = getPaginationParams(req.query);
    const filter = {};

    if (req.query.q) {
      filter.batchNumber = { $regex: req.query.q.trim(), $options: 'i' };
    }

    if (req.query.medicineId) {
      filter.medicineId = req.query.medicineId;
    }

    if (req.query.supplierId) {
      filter.supplierId = req.query.supplierId;
    }

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const startOfToday = getStartOfToday();
    const in30Days = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (req.query.expiryStatus === 'expired') {
      filter.$or = [{ status: 'expired' }, { expiryDate: { $lt: startOfToday } }];
    } else if (req.query.expiryStatus === 'expiring') {
      filter.expiryDate = { $gte: startOfToday, $lte: in30Days };
      filter.status = 'active';
    } else if (req.query.expiryStatus === 'healthy') {
      filter.expiryDate = { $gt: in30Days };
      filter.status = 'active';
    }

    const total = await Batch.countDocuments(filter);
    const batches = await Batch.find(filter)
      .populate('medicineId', 'name medicineCode unit')
      .populate('supplierId', 'name contactPerson email phone')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return successResponse(
      res,
      batches.map((b) => b.toJSON()),
      200,
      buildPaginationMeta(total, page, limit)
    );
  } catch (error) {
    next(error);
  }
}

export async function createBatch(req, res, next) {
  try {
    const {
      medicineId,
      supplierId,
      batchNumber,
      manufacturingDate,
      expiryDate,
      initialQuantity,
      purchaseCostPerUnit,
      purchaseOrderId
    } = req.body;

    const result = await receiveStock({
      medicineId,
      batchNumber,
      supplierId,
      manufacturingDate,
      expiryDate,
      quantity: initialQuantity,
      purchaseCostPerUnit,
      purchaseOrderId,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result.batch, 201);
  } catch (error) {
    next(error);
  }
}

export async function getBatchById(req, res, next) {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('medicineId', 'name medicineCode unit description category')
      .populate('supplierId', 'name contactPerson email phone address defaultLeadTimeDays');

    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    return successResponse(res, batch.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateBatch(req, res, next) {
  try {
    // Quantity update is strictly forbidden via PUT per Section 6.6 & API contract
    if (req.body.currentQuantity !== undefined || req.body.initialQuantity !== undefined) {
      throw ApiError.badRequest('Batch quantity cannot be altered via PUT. Use inventory operations.');
    }

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    const beforeState = batch.toJSON();
    const allowed = ['supplierId', 'manufacturingDate', 'expiryDate', 'purchaseCostPerUnit'];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        batch[field] = req.body[field];
      }
    });

    await batch.save();

    await logAudit({
      actorId: req.user.id,
      action: 'BATCH_METADATA_UPDATE',
      entityType: 'Batch',
      entityId: batch._id,
      beforeState,
      afterState: batch.toJSON(),
      reason: 'Updated batch metadata',
      ip: req.ip
    });

    return successResponse(res, batch.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function getBatchHistory(req, res, next) {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    const movements = await StockMovement.find({ batchId: batch._id })
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 });

    return successResponse(res, movements.map((m) => m.toJSON()));
  } catch (error) {
    next(error);
  }
}
