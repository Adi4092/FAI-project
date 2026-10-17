import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { MedicineSupplier } from '../models/MedicineSupplier.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { getLatestForecastForMedicine } from './forecastService.js';
import { getStartOfToday } from '../utils/dates.js';
import { logger } from '../config/logger.js';

export async function getStockoutPredictions({ riskLevel = null, q = '', page = 1, limit = 20 } = {}) {
  const startOfToday = getStartOfToday();
  const todayStr = startOfToday.toISOString().split('T')[0];

  // 1. Load active medicines
  const medQuery = { isActive: true };
  if (q) {
    medQuery.$or = [
      { name: { $regex: q, $options: 'i' } },
      { medicineCode: { $regex: q, $options: 'i' } }
    ];
  }

  const medicines = await Medicine.find(medQuery).sort({ name: 1 });
  const predictions = [];

  for (const med of medicines) {
    // 2. Usable stock (strictly excluding expired batches and depleted/quarantined)
    const usableBatches = await Batch.find({
      medicineId: med._id,
      status: 'active',
      currentQuantity: { $gt: 0 },
      expiryDate: { $gte: startOfToday }
    });

    const currentUsableStock = usableBatches.reduce((sum, b) => sum + b.currentQuantity, 0);

    // 3. Lead time: find preferred supplier association or default 7 days
    const medSupp = await MedicineSupplier.findOne({
      medicineId: med._id,
      isPreferred: true
    }).populate('supplierId', 'defaultLeadTimeDays');

    let leadTimeDays = 7;
    if (medSupp?.leadTimeDays) {
      leadTimeDays = medSupp.leadTimeDays;
    } else if (medSupp?.supplierId?.defaultLeadTimeDays) {
      leadTimeDays = medSupp.supplierId.defaultLeadTimeDays;
    }

    const safetyStock = med.safetyStock || Math.round(med.reorderLevel * 0.4) || 10;

    // 4. Confirmed incoming POs (approved or partially_received only; draft/pending are strictly excluded)
    const confirmedPOs = await PurchaseOrder.find({
      status: { $in: ['approved', 'partially_received'] },
      'items.medicineId': med._id
    });

    let incomingConfirmedQuantity = 0;
    const arrivalsMap = new Map(); // dateStr -> quantity

    for (const po of confirmedPOs) {
      for (const item of po.items) {
        if (item.medicineId.toString() === med._id.toString()) {
          const rem = Math.max(0, item.quantityOrdered - (item.quantityReceived || 0));
          if (rem > 0 && po.expectedDeliveryDate) {
            incomingConfirmedQuantity += rem;
            const expDateStr = new Date(po.expectedDeliveryDate).toISOString().split('T')[0];
            arrivalsMap.set(expDateStr, (arrivalsMap.get(expDateStr) || 0) + rem);
          }
        }
      }
    }

    // 5. Forecast vs Rule-based Fallback
    const forecast = await getLatestForecastForMedicine(med._id);
    let isFallbackRule = false;
    let forecastLeadTimeDemand = 0;
    let daysUntilStockout = null;
    let dailyDemandSeries = [];

    if (forecast && forecast.predictedDailyDemand?.length > 0 && !forecast.provisional) {
      const predMap = new Map(forecast.predictedDailyDemand.map((d) => [d.date, d.predicted]));
      const horizonDays = forecast.horizonDays || 15;
      const avgDemand = forecast.predictedTotalDemand / horizonDays;

      // Build day-by-day simulation up to max(horizonDays, leadTimeDays * 2, 30)
      const simDays = Math.max(horizonDays, leadTimeDays * 2, 30);
      let runningStock = currentUsableStock;
      if (currentUsableStock <= 0) {
        daysUntilStockout = 0;
      }

      for (let dayOffset = 0; dayOffset < simDays; dayOffset++) {
        const d = new Date(startOfToday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dStr = d.toISOString().split('T')[0];

        const dayDemand = predMap.has(dStr) ? predMap.get(dStr) : avgDemand;
        if (dayOffset < leadTimeDays) {
          forecastLeadTimeDemand += dayDemand;
        }

        const arrivals = arrivalsMap.get(dStr) || 0;
        runningStock = runningStock - dayDemand + arrivals;

        if (runningStock <= 0 && daysUntilStockout === null) {
          daysUntilStockout = dayOffset + 1;
        }

        dailyDemandSeries.push({ date: dStr, stock: Math.round(runningStock), demand: dayDemand, arrivals });
      }

      forecastLeadTimeDemand = Math.round(forecastLeadTimeDemand);
    } else {
      // Rule-based fallback: Trailing 28-day usage from DailyUsage
      isFallbackRule = true;
      const past28Days = new Date(startOfToday.getTime() - 28 * 24 * 60 * 60 * 1000);
      const usageHistory = await DailyUsage.find({
        medicineId: med._id,
        date: { $gte: past28Days, $lte: startOfToday }
      });
      const totalUnits = usageHistory.reduce((sum, u) => sum + (u.unitsDispensed || 0), 0);
      const avgDailyUsage = totalUnits > 0 ? totalUnits / 28 : (med.reorderLevel / 10 || 5);

      forecastLeadTimeDemand = Math.round(avgDailyUsage * leadTimeDays);

      if (avgDailyUsage > 0) {
        const rawDays = (currentUsableStock + incomingConfirmedQuantity) / avgDailyUsage;
        daysUntilStockout = Math.max(0, Math.floor(rawDays));
      } else {
        daysUntilStockout = null;
      }
    }

    // 6. Risk Level Calculation per Section 9.8
    // Critical: stockout date < L days and no confirmed arrival before it
    // High: stock projected to fall below safety stock before replenishment arrives
    // Medium: stock covers lead time but ending buffer < safety stock * 1.5
    // Low: otherwise
    let calculatedRisk = 'low';
    let explanation = '';
    let recommendedAction = 'Monitor regular consumption';

    if (daysUntilStockout !== null && daysUntilStockout <= 0) {
      calculatedRisk = 'critical';
      explanation = `Currently out of usable stock. Supplier lead time is ${leadTimeDays} days.`;
      recommendedAction = incomingConfirmedQuantity > 0 ? 'Expedite incoming purchase order' : 'Place urgent replenishment order';
    } else if (daysUntilStockout !== null && daysUntilStockout < leadTimeDays) {
      if (incomingConfirmedQuantity === 0) {
        calculatedRisk = 'critical';
        explanation = `Stockout projected in ${daysUntilStockout} days; supplier lead time is ${leadTimeDays} days with no confirmed delivery.`;
        recommendedAction = 'Reorder immediately';
      } else {
        calculatedRisk = 'high';
        explanation = `Stockout projected in ${daysUntilStockout} days before full replenishment arrives (${incomingConfirmedQuantity} units on order).`;
        recommendedAction = 'Expedite pending delivery';
      }
    } else if (currentUsableStock < forecastLeadTimeDemand + safetyStock) {
      calculatedRisk = 'high';
      explanation = `Usable stock (${currentUsableStock}) falls below lead time demand + safety stock (${forecastLeadTimeDemand + safetyStock}).`;
      recommendedAction = incomingConfirmedQuantity > 0 ? 'Monitor delivery schedule' : 'Initiate purchase order';
    } else if (currentUsableStock < forecastLeadTimeDemand + safetyStock * 1.5) {
      calculatedRisk = 'medium';
      explanation = `Stock covers supplier lead time, but safety buffer is thin (${currentUsableStock} vs ${Math.round(forecastLeadTimeDemand + safetyStock * 1.5)}).`;
      recommendedAction = 'Prepare replenishment requisition';
    } else {
      calculatedRisk = 'low';
      explanation = `Stock levels are healthy and sufficient to cover lead time (${leadTimeDays} days) and safety reserves.`;
      recommendedAction = 'Normal inventory operations';
    }

    if (isFallbackRule) {
      explanation += ' (Estimated using a rule-based fallback — limited forecast data)';
    }

    predictions.push({
      medicineId: med._id.toString(),
      medicineName: med.name,
      medicineCode: med.medicineCode,
      unit: med.unit,
      currentUsableStock,
      leadTimeDays,
      safetyStock,
      forecastLeadTimeDemand,
      daysUntilStockout,
      incomingOrdersCount: confirmedPOs.length,
      incomingConfirmedQuantity,
      riskLevel: calculatedRisk,
      isFallbackRule,
      explanation,
      recommendedAction
    });
  }

  // Filter by riskLevel if provided
  let filtered = predictions;
  if (riskLevel && riskLevel !== 'all') {
    filtered = filtered.filter((p) => p.riskLevel.toLowerCase() === riskLevel.toLowerCase());
  }

  // Sort by risk priority: Critical -> High -> Medium -> Low
  const priority = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a, b) => {
    const diff = (priority[a.riskLevel] ?? 4) - (priority[b.riskLevel] ?? 4);
    if (diff !== 0) return diff;
    return (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999);
  });

  const skip = (Math.max(1, page) - 1) * limit;
  const paginated = filtered.slice(skip, skip + Number(limit));

  return {
    predictions: paginated,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit) || 1
    }
  };
}
