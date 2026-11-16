import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Medicine } from '../models/Medicine.js';
import { Supplier } from '../models/Supplier.js';
import { MedicineSupplier } from '../models/MedicineSupplier.js';
import { Batch } from '../models/Batch.js';
import { StockMovement } from '../models/StockMovement.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { User } from '../models/User.js';
import { logger } from '../config/logger.js';

async function seedDemoMedicine() {
  await connectDB();
  console.log('Seeding dedicated demo medicine for presentation...');

  // Find admin user for audit ledger attribution
  const adminUser = await User.findOne({ email: 'admin@medstock.local' });
  const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  // 1. Find or pick supplier
  let supplier = await Supplier.findOne({ name: 'HealthPlus Pharma' });
  if (!supplier) {
    supplier = await Supplier.findOne();
  }
  if (!supplier) {
    console.error('No supplier found in database!');
    process.exit(1);
  }

  const medicineCode = 'MED-DEMO';
  const medicineName = 'Paracetamol Demo 500mg';

  // Remove existing demo medicine if already present (for idempotent re-runs)
  const existingMed = await Medicine.findOne({ medicineCode });
  if (existingMed) {
    console.log(`Cleaning up previous ${medicineCode}...`);
    const batches = await Batch.find({ medicineId: existingMed._id });
    for (const b of batches) {
      await StockMovement.collection.deleteMany({ batchId: b._id });
    }
    await Batch.deleteMany({ medicineId: existingMed._id });
    await DailyUsage.deleteMany({ medicineId: existingMed._id });
    await MedicineSupplier.deleteMany({ medicineId: existingMed._id });
    await Medicine.deleteOne({ _id: existingMed._id });
  }

  // 2. Create Medicine
  // ROP = (avgDailyDemand 25 * leadTime 3) + safetyStock 20 = 95
  const medicine = await Medicine.create({
    medicineCode,
    name: medicineName,
    category: 'Analgesics',
    unit: 'tablets',
    description: 'Special presentation demo medicine for live teacher walkthrough',
    reorderLevel: 95,
    safetyStock: 20,
    isActive: true,
    isDemo: true
  });
  console.log(`Created Medicine: ${medicine.name} (${medicine.medicineCode}) with ID: ${medicine._id}`);

  // 3. Link MedicineSupplier
  await MedicineSupplier.create({
    medicineId: medicine._id,
    supplierId: supplier._id,
    leadTimeDays: 3,
    minOrderQty: 50,
    unitCost: 2.50,
    isPreferred: true
  });
  console.log(`Linked Supplier: ${supplier.name} (Lead Time: 3 days, MOQ: 50, Unit Cost: $2.50)`);

  // 4. Create Batches: Batch A (50), Batch B (40), Batch C (60)
  // Baseline date is 2026-11-16
  const batchData = [
    {
      batchNumber: 'BATCH-A',
      initialQuantity: 50,
      currentQuantity: 50,
      manufacturingDate: new Date('2026-05-20T00:00:00.000Z'),
      expiryDate: new Date('2026-11-20T00:00:00.000Z'), // in 4 days
      purchaseCostPerUnit: 2.50
    },
    {
      batchNumber: 'BATCH-B',
      initialQuantity: 40,
      currentQuantity: 40,
      manufacturingDate: new Date('2026-05-30T00:00:00.000Z'),
      expiryDate: new Date('2026-11-30T00:00:00.000Z'), // in 14 days
      purchaseCostPerUnit: 2.50
    },
    {
      batchNumber: 'BATCH-C',
      initialQuantity: 60,
      currentQuantity: 60,
      manufacturingDate: new Date('2026-06-20T00:00:00.000Z'),
      expiryDate: new Date('2026-12-20T00:00:00.000Z'), // in 34 days
      purchaseCostPerUnit: 2.50
    }
  ];

  const createdBatches = [];
  for (const b of batchData) {
    const createdBatch = await Batch.create({
      medicineId: medicine._id,
      supplierId: supplier._id,
      batchNumber: b.batchNumber,
      initialQuantity: b.initialQuantity,
      currentQuantity: b.currentQuantity,
      manufacturingDate: b.manufacturingDate,
      expiryDate: b.expiryDate,
      purchaseCostPerUnit: b.purchaseCostPerUnit,
      receivedAt: b.manufacturingDate,
      status: 'active'
    });

    // Opening receipt stock movement
    await StockMovement.create({
      batchId: createdBatch._id,
      medicineId: medicine._id,
      movementType: 'receipt',
      quantityChange: b.initialQuantity,
      balanceBefore: 0,
      balanceAfter: b.initialQuantity,
      referenceType: 'manual',
      referenceId: 'INITIAL-STOCK',
      performedBy: adminId,
      reason: 'Opening demo stock'
    });

    createdBatches.push(createdBatch);
    console.log(`Created Batch ${b.batchNumber}: ${b.currentQuantity} units, Expiry: ${b.expiryDate.toISOString().split('T')[0]}`);
  }

  // 5. Generate 90 days of DailyUsage ending 2026-11-15 (average ~25 units/day)
  // Seeded pattern with realistic day-of-week fluctuations: 20-30 units/day
  const dailyUsages = [];
  const baseDate = new Date('2026-11-15T00:00:00.000Z');
  for (let i = 89; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat
    // Slightly higher on weekdays (24-28), lower on weekends (18-22)
    const baseDispense = (dayOfWeek === 0 || dayOfWeek === 6) ? 20 : 26;
    // Add small deterministic jitter
    const jitter = (i % 5) - 2; // -2 to +2
    const unitsDispensed = Math.max(15, baseDispense + jitter);

    dailyUsages.push({
      medicineId: medicine._id,
      date: d,
      unitsDispensed,
      unitsReceived: 0,
      stockoutObserved: false,
      dataSource: 'synthetic'
    });
  }

  await DailyUsage.insertMany(dailyUsages);
  console.log(`Seeded ${dailyUsages.length} daily consumption records ending 2026-11-15 (mean daily demand: ~25 units/day).`);

  // Verify reconciliation
  const { reconcileInventory } = await import('../services/stockService.js');
  const recon = await reconcileInventory();
  console.log('Ledger Reconciliation Status:', recon.reconciled ? 'SUCCESS (0 mismatches)' : 'FAILED');

  console.log('\n============================================================');
  console.log('DEMO MEDICINE READY FOR PRESENTATION:');
  console.log(`- Code: ${medicine.medicineCode}`);
  console.log(`- Name: ${medicine.name}`);
  console.log('- Starting Stock: 150 units across 3 batches:');
  console.log('    • BATCH-A: 50 units (Exp: 2026-11-20)');
  console.log('    • BATCH-B: 40 units (Exp: 2026-11-30)');
  console.log('    • BATCH-C: 60 units (Exp: 2026-12-20)');
  console.log('- Reorder Level: 95 | Safety Stock: 20 | Lead Time: 3 days');
  console.log('- When you dispense 70 units:');
  console.log('    • Batch A: 50 -> 0');
  console.log('    • Batch B: 40 -> 20');
  console.log('    • Batch C: 60 (untouched)');
  console.log('    • Total Stock remaining = 80 units');
  console.log('    • Since 80 < 95, Reorder recommendation is triggered!');
  console.log('============================================================\n');

  process.exit(0);
}

seedDemoMedicine().catch((err) => {
  console.error('Error seeding demo medicine:', err);
  process.exit(1);
});
