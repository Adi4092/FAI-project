import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { getLatestForecastForMedicine } from './forecastService.js';
import { aiClient } from './aiClient.js';
import { getStartOfToday, calculateDaysToExpiry } from '../utils/dates.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

/**
 * Calculates expiry risk across usable batches by calling FastAPI /expiry-risk.
 * Only usable batches (active, currentQuantity > 0, expiryDate >= today) are included.
 */
export async function getExpiryRisk({ windowDays = 30, medicineId = null, riskLevel = null, page = 1, limit = 20 } = {}) {
  const startOfToday = getStartOfToday();
  const todayStr = startOfToday.toISOString().split('T')[0];

  // 1. Build filter for usable batches
  const batchFilter = {
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: startOfToday }
  };

  if (medicineId) {
    batchFilter.medicineId = medicineId;
  }

  // Find all candidate usable batches
  const usableBatches = await Batch.find(batchFilter)
    .populate('medicineId', 'name medicineCode unit')
    .sort({ expiryDate: 1 });

  if (usableBatches.length === 0) {
    return {
      summary: {
        estimatedWastageUnits: 0,
        estimatedValueAtRisk: 0,
        disclaimer: 'Estimated — based on forecasts and assumptions, not guaranteed.'
      },
      batches: [],
      meta: { page: Number(page), limit: Number(limit), total: 0, totalPages: 1 }
    };
  }

  // Group usable batches by medicineId
  const batchesByMedicine = new Map();
  for (const b of usableBatches) {
    const medId = b.medicineId._id.toString();
    if (!batchesByMedicine.has(medId)) {
      batchesByMedicine.set(medId, {
        medicine: b.medicineId,
        batches: []
      });
    }
    batchesByMedicine.get(medId).batches.push(b);
  }

  const allSimulatedBatches = [];

  // 2. Run simulation per medicine
  for (const [medId, group] of batchesByMedicine.entries()) {
    const medicine = group.medicine;
    const medBatches = group.batches;

    // Load latest forecast if available
    const forecast = await getLatestForecastForMedicine(medicine._id);

    let dailyForecast = [];
    let extrapolationDailyDemand = 0;
    const hasSavedForecast = Boolean(forecast && forecast.predictedDailyDemand?.length > 0);
    const trailingDays = 28;

    if (hasSavedForecast) {
      dailyForecast = forecast.predictedDailyDemand.map((d) => ({
        date: d.date,
        predicted: d.predicted
      }));
      extrapolationDailyDemand = forecast.predictedTotalDemand / (forecast.horizonDays || 15);
    } else {
      // Fallback: 28-day trailing usage from DailyUsage
      const past28Days = new Date(startOfToday.getTime() - trailingDays * 24 * 60 * 60 * 1000);
      const usageHistory = await DailyUsage.find({
        medicineId: medicine._id,
        date: { $gte: past28Days, $lte: startOfToday }
      });
      const totalDispensed = usageHistory.reduce((sum, u) => sum + (u.unitsDispensed || 0), 0);
      extrapolationDailyDemand = Number((totalDispensed / trailingDays).toFixed(2));
    }

    // Load confirmed incoming PO items for this medicine (approved or partially_received only)
    const confirmedPOs = await PurchaseOrder.find({
      status: { $in: ['approved', 'partially_received'] },
      'items.medicineId': medicine._id
    });

    const incomingLots = [];
    for (const po of confirmedPOs) {
      for (const item of po.items) {
        if (item.medicineId.toString() === medicine._id.toString()) {
          const remainingQty = item.quantityOrdered - (item.quantityReceived || 0);
          if (remainingQty > 0 && po.expectedDeliveryDate) {
            const expectedStr = new Date(po.expectedDeliveryDate).toISOString().split('T')[0];
            // Default incoming expiry to 1 year ahead if unspecified
            const defaultExp = new Date(new Date(po.expectedDeliveryDate).getTime() + 365 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];
            incomingLots.push({
              expectedDate: expectedStr,
              quantity: remainingQty,
              expiryDate: defaultExp
            });
          }
        }
      }
    }

    // Prepare simulation payload
    const simPayload = {
      asOfDate: todayStr,
      windowDays: Number(windowDays),
      dailyForecast,
      extrapolationDailyDemand,
      hasSavedForecast,
      trailingDays,
      batches: medBatches.map((b) => ({
        batchId: b._id.toString(),
        expiryDate: b.expiryDate.toISOString().split('T')[0],
        quantity: b.currentQuantity,
        unitCost: b.purchaseCostPerUnit ?? null,
        receivedAt: b.receivedAt ? b.receivedAt.toISOString().split('T')[0] : null
      })),
      incoming: incomingLots
    };

    try {
      const simResponse = await aiClient.simulateExpiryRisk(simPayload);
      const resultsMap = new Map((simResponse.results || []).map((r) => [r.batchId, r]));

      for (const b of medBatches) {
        const r = resultsMap.get(b._id.toString());
        const daysLeft = calculateDaysToExpiry(b.expiryDate);

        // Filter by windowDays: only batches expiring within windowDays are included in results
        if (daysLeft <= Number(windowDays)) {
          allSimulatedBatches.push({
            batchId: b._id.toString(),
            batchNumber: b.batchNumber,
            medicineId: medicine._id.toString(),
            medicineName: medicine.name,
            medicineCode: medicine.medicineCode,
            unit: medicine.unit,
            expiryDate: b.expiryDate.toISOString().split('T')[0],
            daysLeft,
            currentQuantity: b.currentQuantity,
            expectedConsumed: r ? r.expectedConsumed : 0,
            expectedLeftover: r ? r.expectedLeftover : b.currentQuantity,
            leftoverPct: r ? r.leftoverPct : 100,
            exposureValue: r ? r.exposureValue : null,
            riskLevel: r ? r.riskLevel : (daysLeft <= 14 ? 'critical' : 'high'),
            reasons: r ? r.reasons : [
              hasSavedForecast
                ? 'Risk evaluated with baseline assumptions'
                : `No saved forecast; estimated from the last ${trailingDays} days of average usage`
            ],
            suggestedActions: r ? r.suggestedActions : ['Prioritise dispensing this batch'],
            extrapolated: r ? r.extrapolated : false,
            confidence: r ? r.confidence : 'low',
            confidenceNote: r?.confidenceNote || (
              !hasSavedForecast
                ? `No saved forecast; estimated from the last ${trailingDays} days of average usage`
                : (r?.extrapolated ? 'Estimate extrapolated beyond forecast horizon — lower confidence' : null)
            ),
            hasSavedForecast,
            trailingDays
          });
        }
      }
    } catch (err) {
      logger.error(`[expiryRiskService] Error simulating expiry for medicine ${medicine.name}:`, err);
      // Re-throw if it's service unavailable (503)
      if (err.statusCode === 503) {
        throw err;
      }
    }
  }

  // 3. Filter by riskLevel if requested
  let filteredBatches = allSimulatedBatches;
  if (riskLevel && riskLevel !== 'all') {
    filteredBatches = filteredBatches.filter((b) => b.riskLevel.toLowerCase() === riskLevel.toLowerCase());
  }

  // Sort batches by risk severity and days left
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  filteredBatches.sort((a, b) => {
    const rankDiff = (severityRank[a.riskLevel] ?? 4) - (severityRank[b.riskLevel] ?? 4);
    if (rankDiff !== 0) return rankDiff;
    return a.daysLeft - b.daysLeft;
  });

  // Calculate totals
  const estimatedWastageUnits = filteredBatches.reduce((sum, b) => sum + (b.expectedLeftover || 0), 0);
  const estimatedValueAtRisk = filteredBatches.reduce((sum, b) => sum + (b.exposureValue || 0), 0);

  // Pagination
  const skip = (Math.max(1, page) - 1) * limit;
  const paginated = filteredBatches.slice(skip, skip + Number(limit));

  return {
    summary: {
      estimatedWastageUnits: Number(estimatedWastageUnits.toFixed(1)),
      estimatedValueAtRisk: Number(estimatedValueAtRisk.toFixed(2)),
      disclaimer: 'Estimated — based on forecasts and assumptions, not guaranteed.'
    },
    batches: paginated,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: filteredBatches.length,
      totalPages: Math.ceil(filteredBatches.length / limit) || 1
    }
  };
}

/**
 * Detailed expiry risk breakdown for a single batch
 */
export async function getBatchExpiryRisk(batchId) {
  const batch = await Batch.findById(batchId).populate('medicineId', 'name medicineCode unit');
  if (!batch) {
    throw ApiError.notFound('Batch not found.');
  }

  const result = await getExpiryRisk({
    windowDays: 365,
    medicineId: batch.medicineId._id.toString(),
    page: 1,
    limit: 100
  });

  const match = result.batches.find((b) => b.batchId === batchId);
  if (!match) {
    throw ApiError.notFound('Batch is either not usable or already expired.');
  }

  return match;
}
