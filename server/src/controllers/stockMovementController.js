import { StockMovement } from '../models/StockMovement.js';
import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { correctMovement } from '../services/stockService.js';
import { successResponse } from '../utils/apiResponse.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

function buildMovementFilter(query) {
  const filter = {};

  if (query.medicineId) {
    filter.medicineId = query.medicineId;
  }

  if (query.batchId) {
    filter.batchId = query.batchId;
  }

  if (query.type) {
    filter.movementType = query.type;
  }

  if (query.userId) {
    filter.performedBy = query.userId;
  }

  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from) {
      filter.timestamp.$gte = new Date(query.from);
    }
    if (query.to) {
      filter.timestamp.$lte = new Date(query.to);
    }
  }

  return filter;
}

export async function getStockMovements(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = buildMovementFilter(req.query);

    const sort = req.query.sort ? getPaginationParams(req.query).sort : { timestamp: -1 };

    const total = await StockMovement.countDocuments(filter);
    const movements = await StockMovement.find(filter)
      .populate('medicineId', 'name medicineCode')
      .populate('batchId', 'batchNumber')
      .populate('performedBy', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const formatted = movements.map((m) => ({
      id: m._id.toString(),
      timestamp: m.timestamp,
      medicine: m.medicineId
        ? {
            id: m.medicineId._id ? m.medicineId._id.toString() : m.medicineId.toString(),
            name: m.medicineId.name || 'Unknown',
            medicineCode: m.medicineId.medicineCode || ''
          }
        : null,
      batch: m.batchId
        ? {
            id: m.batchId._id ? m.batchId._id.toString() : m.batchId.toString(),
            batchNumber: m.batchId.batchNumber || ''
          }
        : null,
      movementType: m.movementType,
      quantityChange: m.quantityChange,
      balanceBefore: m.balanceBefore,
      balanceAfter: m.balanceAfter,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      reason: m.reason,
      performedBy: m.performedBy
        ? {
            id: m.performedBy._id ? m.performedBy._id.toString() : m.performedBy.toString(),
            name: m.performedBy.name || 'System',
            email: m.performedBy.email || ''
          }
        : null,
      reversesMovementId: m.reversesMovementId
    }));

    return successResponse(res, formatted, 200, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
}

export async function exportStockMovements(req, res, next) {
  try {
    const filter = buildMovementFilter(req.query);
    const movements = await StockMovement.find(filter)
      .populate('medicineId', 'name medicineCode')
      .populate('batchId', 'batchNumber')
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1 });

    const headers = [
      'Timestamp',
      'Movement ID',
      'Medicine Code',
      'Medicine Name',
      'Batch Number',
      'Type',
      'Quantity Change',
      'Balance Before',
      'Balance After',
      'Reference Type',
      'Reference ID',
      'Reason',
      'Performed By'
    ];

    const rows = movements.map((m) => [
      m.timestamp.toISOString(),
      m._id.toString(),
      m.medicineId?.medicineCode || '',
      `"${(m.medicineId?.name || '').replace(/"/g, '""')}"`,
      m.batchId?.batchNumber || '',
      m.movementType,
      m.quantityChange,
      m.balanceBefore,
      m.balanceAfter,
      m.referenceType,
      m.referenceId || '',
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      m.performedBy?.name || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-movements.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}

export async function correct(req, res, next) {
  try {
    const { reason } = req.body;
    const movementId = req.params.id;

    const result = await correctMovement({
      movementId,
      reason,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}
