import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { StockMovement } from '../models/StockMovement.js';
import { User } from '../models/User.js';
import { getStartOfToday } from '../utils/dates.js';

dotenv.config();

/**
 * Spreads batch expiry dates over 5 to 200 days with varied quantities.
 * This script modifies existing demo batches in place.
 * It does NOT wipe the database or delete medicines, users, or forecasts.
 */
export async function spreadBatchExpiry(mongoUri = process.env.MONGODB_URI) {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined.');
  }

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await mongoose.connect(mongoUri);
  }

  const startOfToday = getStartOfToday();
  const admin = await User.findOne({ role: 'admin' });
  const medicines = await Medicine.find({ isActive: true }).sort({ medicineCode: 1 });

  if (medicines.length === 0) {
    console.log('No active medicines found to update.');
    if (!isConnected) await mongoose.disconnect();
    return;
  }

  console.log(`\n============================================================`);
  console.log(`REALISTIC BATCH EXPIRY DISTRIBUTION SPREADER (5 to 200 Days)`);
  console.log(`As of baseline date: ${startOfToday.toISOString().split('T')[0]}`);
  console.log(`Found ${medicines.length} medicines.`);
  console.log(`============================================================\n`);

  // Target schedule across medicines to ensure 7, 30, 60, 90 and >90 day windows have distinct results:
  // - 5-7 days (catches 7, 30, 60, 90d)
  // - 12-28 days (catches 30, 60, 90d)
  // - 35-58 days (catches 60, 90d)
  // - 65-88 days (catches 90d)
  // - 100-200 days (beyond 90d)
  const schedule = [
    // 5-7 days (Window 7d+) -> 3 batches
    { code: 'MED-001', days: 5, qty: 45 },
    { code: 'MED-002', days: 6, qty: 35 },
    { code: 'MED-003', days: 7, qty: 50 },

    // 12-28 days (Window 30d+) -> 5 batches (cumulative: 8 batches)
    { code: 'MED-004', days: 12, qty: 60 },
    { code: 'MED-005', days: 16, qty: 80 },
    { code: 'MED-006', days: 20, qty: 40 },
    { code: 'MED-007', days: 24, qty: 95 },
    { code: 'MED-008', days: 28, qty: 70 },

    // 35-58 days (Window 60d+) -> 14 batches (cumulative: 22 batches)
    { code: 'MED-009', days: 35, qty: 90 },
    { code: 'MED-010', days: 38, qty: 110 },
    { code: 'MED-011', days: 40, qty: 65 },
    { code: 'MED-012', days: 42, qty: 85 },
    { code: 'MED-013', days: 44, qty: 120 },
    { code: 'MED-014', days: 46, qty: 95 },
    { code: 'MED-015', days: 48, qty: 75 },
    { code: 'MED-016', days: 50, qty: 130 },
    { code: 'MED-017', days: 52, qty: 55 },
    { code: 'MED-018', days: 54, qty: 140 },
    { code: 'MED-019', days: 55, qty: 100 },
    { code: 'MED-020', days: 56, qty: 80 },
    { code: 'MED-021', days: 58, qty: 115 },
    { code: 'MED-030', days: 45, qty: 80 }, // Hydrochlorothiazide 25mg

    // 65-88 days (Window 90d) -> 7 batches (cumulative: 29 batches)
    { code: 'MED-022', days: 65, qty: 105 },
    { code: 'MED-023', days: 68, qty: 90 },
    { code: 'MED-024', days: 72, qty: 125 },
    { code: 'MED-025', days: 76, qty: 110 },
    { code: 'MED-026', days: 80, qty: 95 },
    { code: 'MED-027', days: 84, qty: 135 },
    { code: 'MED-028', days: 88, qty: 150 },

    // Beyond 90d window (1 batch)
    { code: 'MED-029', days: 150, qty: 200 }
  ];

  const scheduleMap = new Map(schedule.map((s) => [s.code, s]));
  const updatedRecords = [];

  for (const med of medicines) {
    const config = scheduleMap.get(med.medicineCode);
    if (!config) continue;

    // Find batch 2 (e.g. B-MED-xxx-02) or the second active batch
    const batches = await Batch.find({ medicineId: med._id, status: 'active' }).sort({ expiryDate: 1 });
    if (batches.length === 0) continue;

    // Target the second batch if available, else batch 1
    const targetBatch = batches.length > 1 ? batches[1] : batches[0];
    const newExpiryDate = new Date(startOfToday.getTime() + config.days * 24 * 60 * 60 * 1000);
    const oldQty = targetBatch.currentQuantity;
    const newQty = config.qty;

    targetBatch.expiryDate = newExpiryDate;
    targetBatch.initialQuantity = newQty;
    targetBatch.currentQuantity = newQty;
    await targetBatch.save();

    // Record adjustment movement if quantity changed to keep stock ledger accurate
    const diff = newQty - oldQty;
    if (diff !== 0 && admin) {
      await StockMovement.create({
        batchId: targetBatch._id,
        medicineId: med._id,
        movementType: 'adjustment',
        quantityChange: diff,
        balanceBefore: oldQty,
        balanceAfter: newQty,
        referenceType: 'manual',
        reason: 'Rebalance demo batch expiry and quantity spread (5 to 200 days)',
        performedBy: admin._id,
        timestamp: new Date()
      });
    }

    updatedRecords.push({
      code: med.medicineCode,
      name: med.name,
      batch: targetBatch.batchNumber,
      expiryDate: newExpiryDate.toISOString().split('T')[0],
      daysLeft: config.days,
      quantity: newQty
    });
  }

  // Summary counts by window
  const count7 = updatedRecords.filter((r) => r.daysLeft <= 7).length;
  const count30 = updatedRecords.filter((r) => r.daysLeft <= 30).length;
  const count60 = updatedRecords.filter((r) => r.daysLeft <= 60).length;
  const count90 = updatedRecords.filter((r) => r.daysLeft <= 90).length;
  const countBeyond90 = updatedRecords.filter((r) => r.daysLeft > 90).length;

  console.log(`Updated ${updatedRecords.length} batches across medicines.\n`);
  console.log(`Window Distribution Breakdown:`);
  console.log(`- Review Window  7 Days: ${count7} batches`);
  console.log(`- Review Window 30 Days: ${count30} batches (includes 7-day batches)`);
  console.log(`- Review Window 60 Days: ${count60} batches (includes 30-day batches + Hydrochlorothiazide at 45d)`);
  console.log(`- Review Window 90 Days: ${count90} batches (includes 60-day batches)`);
  console.log(`- Beyond Horizon (100–200 Days): ${countBeyond90} batches\n`);

  console.log(`Sample Updated Batches:`);
  console.table(
    updatedRecords.slice(0, 10).map((r) => ({
      Medicine: `${r.code} (${r.name.slice(0, 18)})`,
      Batch: r.batch,
      Expiry: r.expiryDate,
      'Days Left': `${r.daysLeft}d`,
      Quantity: r.quantity
    }))
  );

  const hydroRecord = updatedRecords.find((r) => r.code === 'MED-030');
  if (hydroRecord) {
    console.log(`\nHydrochlorothiazide (MED-030) status:`);
    console.log(`Batch ${hydroRecord.batch} now expires on ${hydroRecord.expiryDate} (${hydroRecord.daysLeft} days away) with ${hydroRecord.quantity} units.`);
    console.log(`It will now appear in the 60-day and 90-day review windows!`);
  }

  if (!isConnected) {
    await mongoose.disconnect();
  }
}

// Execute directly if run as a CLI script
if (process.argv[1] && process.argv[1].endsWith('spreadBatchExpiry.js')) {
  spreadBatchExpiry()
    .then(() => {
      console.log('\nBatch spread completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error spreading batch expiry dates:', err);
      process.exit(1);
    });
}
