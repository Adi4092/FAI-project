import { StockMovement } from '../models/StockMovement.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { normalizeToUtcDay, getStartOfToday } from '../utils/dates.js';
import { logger } from '../config/logger.js';

/**
 * Aggregates dispense movements into DailyUsage records.
 * Per Section 6.8 & 8: Receipts are NEVER counted as consumption.
 */
export async function refreshDailyUsage(medicineId = null) {
  const startOfToday = getStartOfToday();
  const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  const matchFilter = {
    movementType: 'dispense',
    timestamp: { $lt: startOfToday }
  };

  if (medicineId) {
    matchFilter.medicineId = medicineId;
  }

  // 1. Aggregate dispense movements strictly before today
  const aggregated = await StockMovement.aggregate([
    { $match: matchFilter },
    {
      $project: {
        medicineId: 1,
        date: {
          $dateTrunc: {
            date: '$timestamp',
            unit: 'day',
            timezone: 'UTC'
          }
        },
        dispensedUnits: { $abs: '$quantityChange' },
        balanceAfter: 1
      }
    },
    {
      $group: {
        _id: { medicineId: '$medicineId', date: '$date' },
        totalDispensed: { $sum: '$dispensedUnits' },
        minBalanceAfter: { $min: '$balanceAfter' }
      }
    }
  ]);

  let updatedCount = 0;

  for (const item of aggregated) {
    const medId = item._id.medicineId;
    const date = item._id.date;
    const unitsDispensed = item.totalDispensed || 0;
    // stockoutObserved: true if balanceAfter hit 0 during any movement that day
    const stockoutObserved = item.minBalanceAfter <= 0;

    await DailyUsage.findOneAndUpdate(
      { medicineId: medId, date },
      {
        $set: {
          unitsDispensed,
          stockoutObserved,
          dataSource: 'ledger'
        }
      },
      { upsert: true, new: true }
    );
    updatedCount++;
  }

  // 2. Ensure DailyUsage is continuous up to yesterday for target medicine(s)
  const medQuery = medicineId ? { _id: medicineId } : { isActive: true };
  const targetMedicines = await Medicine.find(medQuery).select('_id');

  for (const med of targetMedicines) {
    const latestRecord = await DailyUsage.findOne({ medicineId: med._id }).sort({ date: -1 });
    if (!latestRecord) continue;

    const latestDate = new Date(latestRecord.date);
    let checkDate = new Date(latestDate.getTime() + 24 * 60 * 60 * 1000);

    if (checkDate <= yesterday) {
      const activeBatches = await Batch.find({
        medicineId: med._id,
        status: { $in: ['active', 'expiring'] }
      });
      const totalStock = activeBatches.reduce((acc, b) => acc + (b.currentQuantity || 0), 0);
      const isStockout = totalStock <= 0;

      while (checkDate <= yesterday) {
        const utcDay = normalizeToUtcDay(checkDate);
        const res = await DailyUsage.findOneAndUpdate(
          { medicineId: med._id, date: utcDay },
          {
            $setOnInsert: {
              unitsDispensed: 0,
              unitsReceived: 0,
              stockoutObserved: isStockout,
              dataSource: 'ledger'
            }
          },
          { upsert: true, new: true }
        );
        if (res) updatedCount++;
        checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }

  logger.info(`[usageService] Refreshed daily usage: ${updatedCount} daily records updated.`);
  return { updatedCount };
}

/**
 * Retrieves daily usage history for a medicine within an optional date range.
 */
export async function getMedicineUsageHistory(medicineId, from = null, to = null) {
  const query = { medicineId };

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = normalizeToUtcDay(from);
    if (to) query.date.$lte = normalizeToUtcDay(to);
  }

  const records = await DailyUsage.find(query).sort({ date: 1 });

  return records.map((r) => {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
    return {
      date: dateStr,
      unitsDispensed: r.unitsDispensed,
      unitsReceived: r.unitsReceived || 0,
      stockoutObserved: Boolean(r.stockoutObserved),
      dataSource: r.dataSource
    };
  });
}
