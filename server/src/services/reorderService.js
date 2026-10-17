import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { MedicineSupplier } from '../models/MedicineSupplier.js';
import { Supplier } from '../models/Supplier.js';
import { Setting } from '../models/Setting.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { getLatestForecastForMedicine } from './forecastService.js';
import { getStartOfToday } from '../utils/dates.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

function roundUpToMultiple(value, multiple) {
  if (!multiple || multiple <= 1) return Math.ceil(value);
  return Math.ceil(value / multiple) * multiple;
}

/**
 * Calculates and persists reorder recommendations per Section 9.9
 */
export async function generateReorderRecommendations(userId = null) {
  const startOfToday = getStartOfToday();
  const settings = (await Setting.findOne()) || {};
  const targetCoverageDays = settings.targetCoverageDays || 30;
  const serviceLevelZ = settings.serviceLevelZ || 1.65;

  const activeMedicines = await Medicine.find({ isActive: true });
  const generatedRecommendations = [];

  for (const med of activeMedicines) {
    // 1. Usable stock (strictly active, quantity > 0, expiryDate >= today)
    const usableBatches = await Batch.find({
      medicineId: med._id,
      status: 'active',
      currentQuantity: { $gt: 0 },
      expiryDate: { $gte: startOfToday }
    });
    const usableStock = usableBatches.reduce((sum, b) => sum + b.currentQuantity, 0);

    // 2. Preferred Supplier & Lead Time
    const medSupp = await MedicineSupplier.findOne({
      medicineId: med._id,
      isPreferred: true
    }).populate('supplierId');

    let leadTimeDays = 7;
    let minOrderQty = 0;
    let unitCost = null;
    let preferredSupplierId = null;

    if (medSupp) {
      preferredSupplierId = medSupp.supplierId?._id || medSupp.supplierId;
      leadTimeDays = medSupp.leadTimeDays || medSupp.supplierId?.defaultLeadTimeDays || 7;
      minOrderQty = medSupp.minOrderQty || 0;
      unitCost = medSupp.unitCost || null;
    } else {
      const anySupp = await Supplier.findOne({ isActive: true });
      if (anySupp) {
        preferredSupplierId = anySupp._id;
        leadTimeDays = anySupp.defaultLeadTimeDays || 7;
      }
    }

    // Latest batch cost fallback if unitCost missing
    if (unitCost === null) {
      const latestBatch = await Batch.findOne({ medicineId: med._id }).sort({ receivedAt: -1 });
      if (latestBatch?.purchaseCostPerUnit) {
        unitCost = latestBatch.purchaseCostPerUnit;
      }
    }

    // 3. Demand estimation (Forecast or 28-day baseline)
    const forecast = await getLatestForecastForMedicine(med._id);
    let avgDailyDemand = 0;
    let forecastLeadTimeDemand = 0;

    if (forecast && forecast.predictedDailyDemand?.length > 0) {
      const horizon = forecast.horizonDays || 15;
      avgDailyDemand = forecast.predictedTotalDemand / horizon;
      const predSlice = forecast.predictedDailyDemand.slice(0, leadTimeDays);
      forecastLeadTimeDemand = predSlice.reduce((sum, d) => sum + d.predicted, 0);
      if (leadTimeDays > horizon) {
        forecastLeadTimeDemand += (leadTimeDays - horizon) * avgDailyDemand;
      }
    } else {
      const past28Days = new Date(startOfToday.getTime() - 28 * 24 * 60 * 60 * 1000);
      const usageDocs = await DailyUsage.find({
        medicineId: med._id,
        date: { $gte: past28Days, $lte: startOfToday }
      });
      const totalDispensed = usageDocs.reduce((sum, u) => sum + (u.unitsDispensed || 0), 0);
      avgDailyDemand = totalDispensed > 0 ? totalDispensed / 28 : (med.reorderLevel / 10 || 5);
      forecastLeadTimeDemand = avgDailyDemand * leadTimeDays;
    }

    avgDailyDemand = Number(avgDailyDemand.toFixed(2));
    forecastLeadTimeDemand = Math.round(forecastLeadTimeDemand);

    // 4. Safety Stock
    let safetyStock = med.safetyStock;
    if (!safetyStock) {
      // ceil(z * sigma_daily * sqrt(leadTimeDays)) -> approximation with sigma ~ 0.5 * avgDailyDemand
      const sigmaDaily = Math.max(1, avgDailyDemand * 0.5);
      safetyStock = Math.ceil(serviceLevelZ * sigmaDaily * Math.sqrt(leadTimeDays));
    }

    // 5. Reorder Point
    const reorderPoint = forecastLeadTimeDemand + safetyStock;

    // 6. Confirmed Incoming POs
    const confirmedPOs = await PurchaseOrder.find({
      status: { $in: ['approved', 'partially_received'] },
      'items.medicineId': med._id
    });

    let incomingConfirmed = 0;
    for (const po of confirmedPOs) {
      for (const item of po.items) {
        if (item.medicineId.toString() === med._id.toString()) {
          incomingConfirmed += Math.max(0, item.quantityOrdered - (item.quantityReceived || 0));
        }
      }
    }

    // 7. Inventory Position & Trigger
    const outstandingOrders = incomingConfirmed;
    const inventoryPosition = usableStock + incomingConfirmed;
    const trigger = inventoryPosition <= reorderPoint;

    // Only generate recommendation when trigger is true
    if (!trigger) {
      continue;
    }

    // 8. Order Quantities per Section 9.9
    const targetStock = Math.round(avgDailyDemand * targetCoverageDays + safetyStock);
    const rawOrder = Math.max(0, targetStock - inventoryPosition);

    // Expiry Adjustment
    const expiryWindow = new Date(startOfToday.getTime() + targetCoverageDays * 24 * 60 * 60 * 1000);
    const expiringSoonBatches = usableBatches.filter((b) => b.expiryDate <= expiryWindow);
    const expiringQty = expiringSoonBatches.reduce((sum, b) => sum + b.currentQuantity, 0);
    // If excess expiring stock exceeds demand in that period, adjust
    const expiryRiskReduction = Math.min(rawOrder, Math.max(0, expiringQty - Math.round(avgDailyDemand * targetCoverageDays)));
    const adjustedOrder = Math.max(0, rawOrder - expiryRiskReduction);

    let suggestedQuantity = 0;
    if (adjustedOrder > 0) {
      const candidate = Math.max(adjustedOrder, minOrderQty);
      suggestedQuantity = roundUpToMultiple(candidate, minOrderQty);
    }

    if (suggestedQuantity <= 0) {
      continue;
    }

    const estimatedCost = unitCost !== null ? Number((suggestedQuantity * unitCost).toFixed(2)) : null;

    const formulaText =
      `avgDailyDemand (${avgDailyDemand}) × targetCoverageDays (${targetCoverageDays}) + safetyStock (${safetyStock}) = targetStock (${targetStock}). ` +
      `inventoryPosition (${inventoryPosition} = usable ${usableStock} + incoming ${incomingConfirmed}) ≤ reorderPoint (${reorderPoint}). ` +
      `rawOrder = max(0, ${targetStock} − ${inventoryPosition}) = ${rawOrder}. ` +
      (expiryRiskReduction > 0 ? `Adjusted for expiring stock (−${expiryRiskReduction}). ` : '') +
      (minOrderQty > 0 ? `Rounded to MOQ ${minOrderQty} → ${suggestedQuantity} units.` : `Order = ${suggestedQuantity} units.`);

    const reason = `Inventory position (${inventoryPosition}) is below reorder point (${reorderPoint}). Suggested order of ${suggestedQuantity} units provides ${targetCoverageDays} days of stock buffer.`;

    // Check if there is an existing pending recommendation for this medicine
    const existing = await ReorderRecommendation.findOne({
      medicineId: med._id,
      status: 'pending'
    });

    if (existing) {
      existing.inputs = {
        usableStock,
        forecastLeadTimeDemand,
        safetyStock,
        reorderPoint,
        incomingConfirmed,
        outstandingOrders,
        targetCoverageDays,
        avgDailyDemand,
        leadTimeDays,
        minOrderQty,
        expiryRiskReduction
      };
      existing.suggestedQuantity = suggestedQuantity;
      existing.preferredSupplierId = preferredSupplierId;
      existing.estimatedCost = estimatedCost;
      existing.reason = reason;
      existing.formulaText = formulaText;
      existing.generatedAt = new Date();
      await existing.save();
      generatedRecommendations.push(existing);
    } else {
      const rec = await ReorderRecommendation.create({
        medicineId: med._id,
        generatedAt: new Date(),
        inputs: {
          usableStock,
          forecastLeadTimeDemand,
          safetyStock,
          reorderPoint,
          incomingConfirmed,
          outstandingOrders,
          targetCoverageDays,
          avgDailyDemand,
          leadTimeDays,
          minOrderQty,
          expiryRiskReduction
        },
        suggestedQuantity,
        preferredSupplierId,
        estimatedCost,
        reason,
        formulaText,
        status: 'pending'
      });
      generatedRecommendations.push(rec);
    }
  }

  logger.info(`[reorderService] Generated ${generatedRecommendations.length} recommendations.`);
  return generatedRecommendations;
}

/**
 * Retrieves reorder recommendations with pagination and status filter
 */
export async function getReorderRecommendations({ status = null, page = 1, limit = 20 } = {}) {
  const query = {};
  if (status && status !== 'all') {
    query.status = status;
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [recommendations, total, allRecsForSummary] = await Promise.all([
    ReorderRecommendation.find(query)
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('medicineId', 'name medicineCode unit')
      .populate('preferredSupplierId', 'name defaultLeadTimeDays contactPerson'),
    ReorderRecommendation.countDocuments(query),
    ReorderRecommendation.find(query).select('suggestedQuantity adjustedQuantity estimatedCost')
  ]);

  const totalSuggestedUnits = allRecsForSummary.reduce(
    (sum, r) => sum + (r.adjustedQuantity || r.suggestedQuantity || 0),
    0
  );
  const totalEstimatedCost = allRecsForSummary.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

  return {
    summary: {
      totalSuggestedUnits,
      estimatedCost: Number(totalEstimatedCost.toFixed(2))
    },
    recommendations: recommendations.map((r) => ({
      id: r._id.toString(),
      medicineId: r.medicineId
        ? {
            id: r.medicineId._id.toString(),
            name: r.medicineId.name,
            medicineCode: r.medicineId.medicineCode,
            unit: r.medicineId.unit
          }
        : null,
      generatedAt: r.generatedAt,
      inputs: r.inputs,
      suggestedQuantity: r.suggestedQuantity,
      adjustedQuantity: r.adjustedQuantity,
      preferredSupplier: r.preferredSupplierId
        ? {
            id: r.preferredSupplierId._id.toString(),
            name: r.preferredSupplierId.name,
            defaultLeadTimeDays: r.preferredSupplierId.defaultLeadTimeDays
          }
        : null,
      estimatedCost: r.estimatedCost,
      reason: r.reason,
      formulaText: r.formulaText,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote
    })),
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

/**
 * Approves a recommendation and creates a draft Purchase Order
 */
export async function approveRecommendation(id, userId = null) {
  const rec = await ReorderRecommendation.findById(id).populate('medicineId preferredSupplierId');
  if (!rec) {
    throw ApiError.notFound('Reorder recommendation not found.');
  }

  if (rec.status !== 'pending' && rec.status !== 'adjusted') {
    throw ApiError.badRequest(`Cannot approve recommendation in '${rec.status}' status.`);
  }

  const finalQty = rec.adjustedQuantity || rec.suggestedQuantity;
  let supplierId = rec.preferredSupplierId?._id || rec.preferredSupplierId;

  if (!supplierId) {
    const anySupp = await Supplier.findOne({ isActive: true });
    if (!anySupp) {
      throw ApiError.badRequest('No active supplier available to assign to the purchase order.');
    }
    supplierId = anySupp._id;
  }

  // Create Draft Purchase Order
  const poCount = await PurchaseOrder.countDocuments();
  const orderNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(4, '0')}`;
  const leadTime = rec.preferredSupplierId?.defaultLeadTimeDays || 7;
  const expectedDeliveryDate = new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000);

  const po = await PurchaseOrder.create({
    orderNumber,
    supplierId,
    items: [
      {
        medicineId: rec.medicineId._id,
        quantityOrdered: finalQty,
        unitCost: rec.estimatedCost && finalQty > 0 ? Number((rec.estimatedCost / finalQty).toFixed(2)) : 0,
        quantityReceived: 0
      }
    ],
    status: 'draft',
    expectedDeliveryDate,
    createdBy: userId,
    estimatedTotalCost: rec.estimatedCost || 0,
    sourceRecommendationId: rec._id
  });

  rec.status = 'approved';
  rec.reviewedBy = userId;
  rec.reviewedAt = new Date();
  rec.purchaseOrderId = po._id;
  await rec.save();

  return { recommendation: rec, purchaseOrder: po };
}

/**
 * Rejects a recommendation with a reason
 */
export async function rejectRecommendation(id, reason, userId = null) {
  const rec = await ReorderRecommendation.findById(id);
  if (!rec) {
    throw ApiError.notFound('Reorder recommendation not found.');
  }

  if (rec.status !== 'pending' && rec.status !== 'adjusted') {
    throw ApiError.badRequest(`Cannot reject recommendation in '${rec.status}' status.`);
  }

  rec.status = 'rejected';
  rec.reviewNote = reason || 'Rejected by user';
  rec.reviewedBy = userId;
  rec.reviewedAt = new Date();
  await rec.save();

  return rec;
}

/**
 * Adjusts quantity and note on a recommendation
 */
export async function adjustRecommendation(id, quantity, note = '', userId = null) {
  const rec = await ReorderRecommendation.findById(id);
  if (!rec) {
    throw ApiError.notFound('Reorder recommendation not found.');
  }

  if (Number(quantity) <= 0) {
    throw ApiError.badRequest('Adjusted quantity must be greater than zero.');
  }

  rec.adjustedQuantity = Number(quantity);
  if (note) rec.reviewNote = note;
  rec.status = 'adjusted';
  rec.reviewedBy = userId;
  rec.reviewedAt = new Date();

  // Recalculate estimated cost if unit price exists
  if (rec.estimatedCost !== null && rec.suggestedQuantity > 0) {
    const unitPrice = rec.estimatedCost / rec.suggestedQuantity;
    rec.estimatedCost = Number((unitPrice * Number(quantity)).toFixed(2));
  }

  await rec.save();
  return rec;
}
