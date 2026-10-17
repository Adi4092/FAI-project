import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { Setting } from '../models/Setting.js';
import { createNotification, resolveNotification } from '../services/notificationService.js';
import { getStockoutPredictions } from '../services/stockoutService.js';
import { getStartOfToday, calculateDaysToExpiry } from '../utils/dates.js';
import { logger } from '../config/logger.js';

export async function runAlertJob() {
  logger.info('[alertJob] Starting automated alert evaluation job...');
  const startOfToday = getStartOfToday();
  const settings = (await Setting.findOne()) || {};
  const expiryBands = settings.expiryBands || [7, 30, 60, 90];

  let createdAlerts = 0;
  let resolvedAlerts = 0;

  // 1. Evaluate Low Stock & Auto-resolve when replenished
  const activeMedicines = await Medicine.find({ isActive: true });
  for (const med of activeMedicines) {
    const usableBatches = await Batch.find({
      medicineId: med._id,
      status: 'active',
      currentQuantity: { $gt: 0 },
      expiryDate: { $gte: startOfToday }
    });
    const usableStock = usableBatches.reduce((sum, b) => sum + b.currentQuantity, 0);
    const dedupeKey = `LOW_STOCK:${med._id}`;

    if (usableStock <= med.reorderLevel) {
      const severity = usableStock === 0 ? 'critical' : 'warning';
      const created = await createNotification({
        type: 'low_stock',
        severity,
        title: `Low Stock: ${med.name}`,
        message: `Usable stock (${usableStock} ${med.unit}) has fallen below reorder level (${med.reorderLevel}).`,
        relatedEntityType: 'Medicine',
        relatedEntityId: med._id,
        dedupeKey
      });
      if (created) createdAlerts++;
    } else {
      // Auto-resolve when condition clears
      const res = await resolveNotification(dedupeKey);
      if (res?.modifiedCount > 0) resolvedAlerts += res.modifiedCount;
    }
  }

  // 2. Evaluate Expiring Batches across bands (7, 30, 60, 90)
  const candidateBatches = await Batch.find({
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: startOfToday }
  }).populate('medicineId', 'name unit');

  for (const b of candidateBatches) {
    const daysLeft = calculateDaysToExpiry(b.expiryDate);

    // Find the tightest matching band
    let matchingBand = null;
    let severity = 'info';

    if (daysLeft <= 7) {
      matchingBand = 7;
      severity = 'critical';
    } else if (daysLeft <= 30) {
      matchingBand = 30;
      severity = 'critical';
    } else if (daysLeft <= 60) {
      matchingBand = 60;
      severity = 'warning';
    } else if (daysLeft <= 90) {
      matchingBand = 90;
      severity = 'info';
    }

    if (matchingBand !== null) {
      const dedupeKey = `EXPIRY:${b._id}:${matchingBand}`;
      const medName = b.medicineId?.name || 'Medicine';
      const created = await createNotification({
        type: 'expiring_batch',
        severity,
        title: `Expiring Batch: ${b.batchNumber}`,
        message: `Batch ${b.batchNumber} (${medName}, ${b.currentQuantity} units) expires in ${daysLeft} days.`,
        relatedEntityType: 'Batch',
        relatedEntityId: b._id,
        dedupeKey
      });
      if (created) createdAlerts++;
    }
  }

  // 3. Evaluate Stockout Predictions
  try {
    const { predictions } = await getStockoutPredictions({ page: 1, limit: 100 });
    for (const p of predictions) {
      const dedupeKey = `STOCKOUT:${p.medicineId}`;
      if (p.riskLevel === 'critical' || p.riskLevel === 'high') {
        const severity = p.riskLevel === 'critical' ? 'critical' : 'warning';
        const created = await createNotification({
          type: 'stockout_predicted',
          severity,
          title: `Predicted Stockout: ${p.medicineName}`,
          message: p.explanation,
          relatedEntityType: 'Medicine',
          relatedEntityId: p.medicineId,
          dedupeKey
        });
        if (created) createdAlerts++;
      } else {
        const res = await resolveNotification(dedupeKey);
        if (res?.modifiedCount > 0) resolvedAlerts += res.modifiedCount;
      }
    }
  } catch (err) {
    logger.error('[alertJob] Error checking stockout predictions in alert job:', err);
  }

  logger.info(`[alertJob] Finished alert evaluation: ${createdAlerts} active alerts evaluated/created, ${resolvedAlerts} auto-resolved.`);
  return { createdAlerts, resolvedAlerts };
}
