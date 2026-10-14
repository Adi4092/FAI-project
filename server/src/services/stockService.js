import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { StockMovement } from '../models/StockMovement.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { ApiError } from '../utils/ApiError.js';
import { getStartOfToday, normalizeToUtcDay, isBatchExpired } from '../utils/dates.js';
import { allocateFEFO } from './fefoService.js';
import { logAudit } from './auditService.js';
import { logger } from '../config/logger.js';

/**
 * Execute a unit of work inside a MongoDB transaction if replica set is available,
 * or run directly if running on a standalone instance without replica set.
 */
async function withTransaction(work) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // Ignore abort error if transaction was never started
      }
    }

    // Check if error is because standalone mongo does not support transactions
    const isStandaloneError =
      error.message &&
      (error.message.includes('Transactions are not supported') ||
        error.message.includes('replica set') ||
        error.message.includes('This MongoDB deployment does not support transactions'));

    if (isStandaloneError) {
      logger.warn('MongoDB deployment does not support transactions. Executing with atomic conditional fallback.');
      return work(null);
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * Update DailyUsage for a medicine on a given day
 */
async function recordDailyUsage({ medicineId, date = new Date(), unitsDispensed = 0, unitsReceived = 0, session = null }) {
  const utcDay = normalizeToUtcDay(date);

  // Check if stock is now zero for stockout indicator
  const usableBatches = await Batch.find({
    medicineId,
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: getStartOfToday() }
  }).session(session);

  const usableStock = usableBatches.reduce((acc, b) => acc + b.currentQuantity, 0);
  const stockoutObserved = usableStock <= 0;

  await DailyUsage.findOneAndUpdate(
    { medicineId, date: utcDay },
    {
      $inc: {
        unitsDispensed: Math.max(0, unitsDispensed),
        unitsReceived: Math.max(0, unitsReceived)
      },
      $set: {
        stockoutObserved,
        dataSource: 'ledger'
      }
    },
    { upsert: true, new: true, session }
  );
}

/**
 * Receive Stock (Create Batch & Receipt Movement)
 */
export async function receiveStock({
  medicineId,
  batchNumber,
  supplierId,
  manufacturingDate,
  expiryDate,
  quantity,
  purchaseCostPerUnit = 0,
  purchaseOrderId = null,
  isDemo = false,
  performedBy,
  ip = ''
}) {
  if (quantity <= 0) {
    throw ApiError.badRequest('Received quantity must be greater than zero.');
  }

  const mfg = new Date(manufacturingDate);
  const exp = new Date(expiryDate);

  if (exp <= mfg) {
    throw ApiError.badRequest('Expiry date must be after manufacturing date.');
  }

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw ApiError.notFound('Medicine not found.');
  }

  return withTransaction(async (session) => {
    // Check if batch with this number, medicine, and supplier already exists
    let batch = await Batch.findOne({
      supplierId,
      medicineId,
      batchNumber: batchNumber.trim().toUpperCase()
    }).session(session);

    let balanceBefore = 0;
    let balanceAfter = quantity;

    if (batch) {
      balanceBefore = batch.currentQuantity;
      balanceAfter = balanceBefore + quantity;

      batch.currentQuantity = balanceAfter;
      batch.initialQuantity += quantity;
      if (batch.status === 'depleted') {
        batch.status = 'active';
      }
      await batch.save({ session });
    } else {
      const isExpired = isBatchExpired(exp);
      const newBatchDocs = await Batch.create(
        [
          {
            batchNumber: batchNumber.trim().toUpperCase(),
            medicineId,
            supplierId,
            manufacturingDate: mfg,
            expiryDate: exp,
            initialQuantity: quantity,
            currentQuantity: quantity,
            purchaseCostPerUnit,
            receivedAt: new Date(),
            status: isExpired ? 'expired' : 'active',
            purchaseOrderId,
            isDemo
          }
        ],
        { session }
      );
      batch = newBatchDocs[0];
    }

    // Record immutable stock movement
    const movementDocs = await StockMovement.create(
      [
        {
          batchId: batch._id,
          medicineId,
          movementType: 'receipt',
          quantityChange: quantity,
          balanceBefore,
          balanceAfter,
          referenceType: purchaseOrderId ? 'purchase_order' : 'manual',
          referenceId: purchaseOrderId ? String(purchaseOrderId) : null,
          reason: 'Stock receipt',
          performedBy,
          timestamp: new Date()
        }
      ],
      { session }
    );
    const movement = movementDocs[0];

    // Record daily usage received units
    await recordDailyUsage({
      medicineId,
      unitsReceived: quantity,
      session
    });

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_RECEIVE',
      entityType: 'Batch',
      entityId: batch._id,
      beforeState: { currentQuantity: balanceBefore },
      afterState: { currentQuantity: balanceAfter },
      reason: `Received ${quantity} units`,
      ip,
      session
    });

    return {
      batch: batch.toJSON(),
      movement: movement.toJSON()
    };
  });
}

/**
 * Dispense Stock (FEFO or explicit allocations)
 */
export async function dispenseStock({
  medicineId,
  quantity,
  note = '',
  allocations: userAllocations = null,
  performedBy,
  ip = ''
}) {
  if (quantity <= 0) {
    throw ApiError.badRequest('Dispensed quantity must be greater than zero.');
  }

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw ApiError.notFound('Medicine not found.');
  }

  // Determine allocations
  let planAllocations = userAllocations;
  if (!planAllocations || planAllocations.length === 0) {
    const fefoResult = await allocateFEFO(medicineId, quantity);
    planAllocations = fefoResult.allocations.map((a) => ({
      batchId: a.batchId,
      quantity: a.allocatedQuantity
    }));
  }

  // Validate allocations
  const totalAllocated = planAllocations.reduce((sum, a) => sum + a.quantity, 0);
  if (totalAllocated !== quantity) {
    throw ApiError.badRequest(
      `Total allocated quantity (${totalAllocated}) does not match requested quantity (${quantity}).`
    );
  }

  const startOfToday = getStartOfToday();

  return withTransaction(async (session) => {
    const createdMovements = [];

    for (const alloc of planAllocations) {
      const batch = await Batch.findById(alloc.batchId).session(session);
      if (!batch) {
        throw ApiError.notFound(`Batch ${alloc.batchId} not found.`);
      }

      if (String(batch.medicineId) !== String(medicineId)) {
        throw ApiError.badRequest(`Batch ${batch.batchNumber} does not belong to the selected medicine.`);
      }

      if (batch.status === 'expired' || batch.expiryDate < startOfToday) {
        throw new ApiError(
          409,
          'BATCH_EXPIRED',
          `Cannot dispense from expired batch ${batch.batchNumber} (expired on ${batch.expiryDate.toISOString().slice(0, 10)}).`
        );
      }

      if (batch.status === 'quarantined') {
        throw new ApiError(409, 'FORBIDDEN', `Cannot dispense from quarantined batch ${batch.batchNumber}.`);
      }

      if (batch.currentQuantity < alloc.quantity) {
        throw new ApiError(
          409,
          'INSUFFICIENT_STOCK',
          `Batch ${batch.batchNumber} has insufficient stock. Available: ${batch.currentQuantity}, Requested: ${alloc.quantity}`
        );
      }

      const balanceBefore = batch.currentQuantity;
      const balanceAfter = balanceBefore - alloc.quantity;

      // Atomic conditional update
      const updatedBatch = await Batch.findOneAndUpdate(
        {
          _id: batch._id,
          currentQuantity: { $gte: alloc.quantity }
        },
        {
          $inc: { currentQuantity: -alloc.quantity },
          $set: { status: balanceAfter === 0 ? 'depleted' : 'active' }
        },
        { new: true, session }
      );

      if (!updatedBatch) {
        throw new ApiError(
          409,
          'INSUFFICIENT_STOCK',
          `Concurrent update conflict on batch ${batch.batchNumber}. Insufficient stock.`
        );
      }

      // Record movement
      const movementDocs = await StockMovement.create(
        [
          {
            batchId: batch._id,
            medicineId,
            movementType: 'dispense',
            quantityChange: -alloc.quantity,
            balanceBefore,
            balanceAfter,
            referenceType: 'manual',
            reason: note || 'Dispense request',
            performedBy,
            timestamp: new Date()
          }
        ],
        { session }
      );

      createdMovements.push({
        id: movementDocs[0]._id.toString(),
        batchId: batch._id.toString(),
        batchNumber: batch.batchNumber,
        quantity: alloc.quantity,
        balanceAfter
      });
    }

    // Update DailyUsage
    await recordDailyUsage({
      medicineId,
      unitsDispensed: quantity,
      session
    });

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_DISPENSE',
      entityType: 'Medicine',
      entityId: medicineId,
      reason: note || `Dispensed ${quantity} units across ${planAllocations.length} batches`,
      ip,
      session
    });

    return {
      medicineId: medicine._id.toString(),
      totalDispensed: quantity,
      movements: createdMovements
    };
  });
}

/**
 * Return Stock to a Batch
 */
export async function returnStock({
  batchId,
  quantity,
  reason,
  referenceDispenseMovementId = null,
  performedBy,
  ip = ''
}) {
  if (quantity <= 0) {
    throw ApiError.badRequest('Return quantity must be greater than zero.');
  }

  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is mandatory when recording a return.');
  }

  return withTransaction(async (session) => {
    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    const startOfToday = getStartOfToday();
    if (batch.expiryDate < startOfToday) {
      throw new ApiError(409, 'BATCH_EXPIRED', 'Cannot return units into an expired batch.');
    }

    // If reference movement is provided, check that we do not return more than what was dispensed
    if (referenceDispenseMovementId) {
      const origMovement = await StockMovement.findById(referenceDispenseMovementId).session(session);
      if (!origMovement || origMovement.movementType !== 'dispense') {
        throw ApiError.badRequest('Referenced movement is not a valid dispense record.');
      }

      const priorReturns = await StockMovement.find({
        movementType: 'return',
        referenceId: String(referenceDispenseMovementId)
      }).session(session);

      const totalReturnedAlready = priorReturns.reduce((sum, m) => sum + m.quantityChange, 0);
      const maxReturnable = Math.abs(origMovement.quantityChange) - totalReturnedAlready;

      if (quantity > maxReturnable) {
        throw ApiError.badRequest(
          `Cannot return ${quantity} units. Maximum returnable from this dispense is ${maxReturnable}.`
        );
      }
    }

    const balanceBefore = batch.currentQuantity;
    const balanceAfter = balanceBefore + quantity;

    batch.currentQuantity = balanceAfter;
    if (batch.status === 'depleted') {
      batch.status = 'active';
    }
    await batch.save({ session });

    const movementDocs = await StockMovement.create(
      [
        {
          batchId: batch._id,
          medicineId: batch.medicineId,
          movementType: 'return',
          quantityChange: quantity,
          balanceBefore,
          balanceAfter,
          referenceType: referenceDispenseMovementId ? 'manual' : 'manual',
          referenceId: referenceDispenseMovementId ? String(referenceDispenseMovementId) : null,
          reason,
          performedBy,
          timestamp: new Date()
        }
      ],
      { session }
    );

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_RETURN',
      entityType: 'Batch',
      entityId: batch._id,
      beforeState: { currentQuantity: balanceBefore },
      afterState: { currentQuantity: balanceAfter },
      reason,
      ip,
      session
    });

    return {
      batch: batch.toJSON(),
      movement: movementDocs[0].toJSON()
    };
  });
}

/**
 * Adjust Stock (Physical inventory discrepancy)
 */
export async function adjustStock({
  batchId,
  quantityChange,
  reason,
  performedBy,
  ip = ''
}) {
  if (!quantityChange || quantityChange === 0) {
    throw ApiError.badRequest('quantityChange must be a non-zero integer.');
  }

  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is mandatory for inventory adjustments.');
  }

  return withTransaction(async (session) => {
    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    const balanceBefore = batch.currentQuantity;
    const balanceAfter = balanceBefore + quantityChange;

    if (balanceAfter < 0) {
      throw new ApiError(
        409,
        'INSUFFICIENT_STOCK',
        `Adjustment would result in negative quantity (${balanceAfter}). Current balance: ${balanceBefore}`
      );
    }

    batch.currentQuantity = balanceAfter;
    batch.status = balanceAfter === 0 ? 'depleted' : 'active';
    await batch.save({ session });

    const movementDocs = await StockMovement.create(
      [
        {
          batchId: batch._id,
          medicineId: batch.medicineId,
          movementType: 'adjustment',
          quantityChange,
          balanceBefore,
          balanceAfter,
          referenceType: 'manual',
          reason,
          performedBy,
          timestamp: new Date()
        }
      ],
      { session }
    );

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'Batch',
      entityId: batch._id,
      beforeState: { currentQuantity: balanceBefore },
      afterState: { currentQuantity: balanceAfter },
      reason,
      ip,
      session
    });

    return {
      batch: batch.toJSON(),
      movement: movementDocs[0].toJSON()
    };
  });
}

/**
 * Write-Off Expired Stock
 */
export async function writeOffStock({ batchId, reason, performedBy, ip = '' }) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is required for write-off.');
  }

  return withTransaction(async (session) => {
    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      throw ApiError.notFound('Batch not found.');
    }

    const writtenOffQuantity = batch.currentQuantity;
    if (writtenOffQuantity <= 0) {
      throw ApiError.badRequest('Batch has zero current quantity to write off.');
    }

    const balanceBefore = writtenOffQuantity;
    const balanceAfter = 0;
    const realizedWastageCost = writtenOffQuantity * (batch.purchaseCostPerUnit || 0);

    batch.currentQuantity = 0;
    batch.status = 'expired';
    await batch.save({ session });

    const movementDocs = await StockMovement.create(
      [
        {
          batchId: batch._id,
          medicineId: batch.medicineId,
          movementType: 'expiry_writeoff',
          quantityChange: -writtenOffQuantity,
          balanceBefore,
          balanceAfter,
          referenceType: 'manual',
          reason,
          performedBy,
          timestamp: new Date()
        }
      ],
      { session }
    );

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_WRITE_OFF',
      entityType: 'Batch',
      entityId: batch._id,
      beforeState: { currentQuantity: balanceBefore },
      afterState: { currentQuantity: 0 },
      reason,
      ip,
      session
    });

    return {
      batchId: batch._id.toString(),
      writtenOffQuantity,
      realizedWastageCost: Number(realizedWastageCost.toFixed(2)),
      movementId: movementDocs[0]._id.toString()
    };
  });
}

/**
 * Correct a previous movement (Compensating entry)
 */
export async function correctMovement({ movementId, reason, performedBy, ip = '' }) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is mandatory when correcting a movement.');
  }

  return withTransaction(async (session) => {
    const original = await StockMovement.findById(movementId).session(session);
    if (!original) {
      throw ApiError.notFound('Original stock movement not found.');
    }

    // Check if this movement has already been reversed
    const existingCorrection = await StockMovement.findOne({
      reversesMovementId: original._id
    }).session(session);

    if (existingCorrection) {
      throw new ApiError(
        409,
        'IMMUTABLE_RECORD',
        'This movement has already been reversed by a compensating correction.'
      );
    }

    const batch = await Batch.findById(original.batchId).session(session);
    if (!batch) {
      throw ApiError.notFound('Associated batch not found.');
    }

    // Compensating change reverses the original sign
    const compensatingChange = -original.quantityChange;
    const balanceBefore = batch.currentQuantity;
    const balanceAfter = balanceBefore + compensatingChange;

    if (balanceAfter < 0) {
      throw new ApiError(
        409,
        'INSUFFICIENT_STOCK',
        `Reversal would result in negative stock balance (${balanceAfter}).`
      );
    }

    batch.currentQuantity = balanceAfter;
    batch.status = balanceAfter === 0 ? 'depleted' : 'active';
    await batch.save({ session });

    const movementDocs = await StockMovement.create(
      [
        {
          batchId: batch._id,
          medicineId: original.medicineId,
          movementType: 'correction',
          quantityChange: compensatingChange,
          balanceBefore,
          balanceAfter,
          referenceType: 'system',
          reason,
          performedBy,
          reversesMovementId: original._id,
          timestamp: new Date()
        }
      ],
      { session }
    );

    await logAudit({
      actorId: performedBy,
      action: 'STOCK_CORRECTION',
      entityType: 'StockMovement',
      entityId: original._id,
      reason,
      ip,
      session
    });

    return {
      batch: batch.toJSON(),
      movement: movementDocs[0].toJSON()
    };
  });
}

/**
 * Reconcile Batch quantities against StockMovement Ledger
 */
export async function reconcileInventory() {
  const batches = await Batch.find({});
  const mismatches = [];

  for (const batch of batches) {
    const movements = await StockMovement.find({ batchId: batch._id });
    const sumMovements = movements.reduce((acc, m) => acc + m.quantityChange, 0);

    // Initial quantity + sum of movements should equal currentQuantity
    // Note: for opening receipt movement, if initialQuantity was already recorded via a receipt movement,
    // the sum of movements from receipt onwards equals currentQuantity.
    const hasInitialReceipt = movements.some((m) => m.movementType === 'receipt');
    const expectedCurrent = hasInitialReceipt ? sumMovements : batch.initialQuantity + sumMovements;

    if (batch.currentQuantity !== expectedCurrent) {
      mismatches.push({
        batchId: batch._id.toString(),
        batchNumber: batch.batchNumber,
        medicineId: batch.medicineId.toString(),
        storedCurrentQuantity: batch.currentQuantity,
        ledgerComputedQuantity: expectedCurrent,
        discrepancy: batch.currentQuantity - expectedCurrent
      });
    }
  }

  return {
    reconciled: mismatches.length === 0,
    totalBatchesChecked: batches.length,
    mismatches
  };
}

/**
 * Get Inventory Summary KPIs
 */
export async function getInventorySummary() {
  const startOfToday = getStartOfToday();
  const in30Days = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);

  const activeBatches = await Batch.find({ status: 'active', currentQuantity: { $gt: 0 } });
  const expiredBatches = await Batch.find({
    $or: [{ status: 'expired' }, { expiryDate: { $lt: startOfToday }, currentQuantity: { $gt: 0 } }]
  });

  const totalUsableUnits = activeBatches
    .filter((b) => b.expiryDate >= startOfToday)
    .reduce((sum, b) => sum + b.currentQuantity, 0);

  const totalExpiredUnits = expiredBatches.reduce((sum, b) => sum + b.currentQuantity, 0);

  const batchesExpiringWithin30Days = activeBatches.filter(
    (b) => b.expiryDate >= startOfToday && b.expiryDate <= in30Days
  ).length;

  // Medicines below reorder
  const medicines = await Medicine.find({ isActive: true });
  let medicinesBelowReorder = 0;

  for (const med of medicines) {
    const medBatches = activeBatches.filter(
      (b) => String(b.medicineId) === String(med._id) && b.expiryDate >= startOfToday
    );
    const usable = medBatches.reduce((sum, b) => sum + b.currentQuantity, 0);
    if (usable <= med.reorderLevel) {
      medicinesBelowReorder++;
    }
  }

  const totalTrackedUnits = totalUsableUnits + totalExpiredUnits;
  const healthyStockPercentage = totalTrackedUnits > 0
    ? Number(((totalUsableUnits / totalTrackedUnits) * 100).toFixed(1))
    : 100.0;
  const expiryRiskPercentage = totalTrackedUnits > 0
    ? Number(((totalExpiredUnits / totalTrackedUnits) * 100).toFixed(1))
    : 0.0;

  return {
    totalUsableUnits,
    totalExpiredUnits,
    totalActiveBatches: activeBatches.length,
    batchesExpiringWithin30Days,
    medicinesBelowReorder,
    medicinesAtStockoutRisk: medicinesBelowReorder,
    healthyStockPercentage,
    expiryRiskPercentage
  };
}
