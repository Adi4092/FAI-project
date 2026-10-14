import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  User,
  Medicine,
  Supplier,
  MedicineSupplier,
  Batch,
  StockMovement,
  DailyUsage,
  Setting
} from '../models/index.js';
import { reconcileInventory } from '../services/stockService.js';
import { getStartOfToday, normalizeToUtcDay } from '../utils/dates.js';

const DEMO_USERS = [
  {
    name: 'System Administrator',
    email: 'admin@medstock.local',
    password: 'password123',
    role: 'admin'
  },
  {
    name: 'Inventory Manager',
    email: 'manager@medstock.local',
    password: 'password123',
    role: 'inventory_manager'
  },
  {
    name: 'Pharmacy Staff',
    email: 'staff@medstock.local',
    password: 'password123',
    role: 'staff'
  }
];

const DEMO_SUPPLIERS = [
  {
    name: 'HealthPlus Pharma',
    contactPerson: 'Sarah Johnson',
    email: 'orders@healthplus.com',
    phone: '+91 98765 43210',
    address: 'Plot 42, Pharmaceutical Zone, Sector 18, Gurugram',
    defaultLeadTimeDays: 7
  },
  {
    name: 'MedSupply Global',
    contactPerson: 'Vikram Mehta',
    email: 'supplies@medsupply.com',
    phone: '+91 98765 43211',
    address: 'B-12 Industrial Area, MIDC Andheri East, Mumbai',
    defaultLeadTimeDays: 10
  },
  {
    name: 'CareLife Pharmaceuticals',
    contactPerson: 'Anita Rao',
    email: 'info@carelife.in',
    phone: '+91 98765 43212',
    address: '77 Biotech Corridor, Electronic City, Bengaluru',
    defaultLeadTimeDays: 5
  },
  {
    name: 'Apex Lifesciences',
    contactPerson: 'David Chen',
    email: 'contact@apexlifesciences.com',
    phone: '+91 98765 43213',
    address: '15 Healthcare Way, GIDC, Vadodara',
    defaultLeadTimeDays: 14
  },
  {
    name: 'BioMed Healthcare',
    contactPerson: 'Priya Sharma',
    email: 'support@biomedhealth.org',
    phone: '+91 98765 43214',
    address: '88 Okhla Phase III, New Delhi',
    defaultLeadTimeDays: 3
  }
];

const MEDICINES_DATA = [
  { code: 'MED-001', name: 'Paracetamol 500mg', category: 'Analgesic', unit: 'tablet', reorderLevel: 100, safetyStock: 50 },
  { code: 'MED-002', name: 'Amoxicillin 250mg', category: 'Antibiotic', unit: 'capsule', reorderLevel: 120, safetyStock: 40 },
  { code: 'MED-003', name: 'Ciprofloxacin 500mg', category: 'Antibiotic', unit: 'tablet', reorderLevel: 80, safetyStock: 30 },
  { code: 'MED-004', name: 'Metformin 500mg', category: 'Antidiabetic', unit: 'tablet', reorderLevel: 150, safetyStock: 50 },
  { code: 'MED-005', name: 'Ibuprofen 400mg', category: 'NSAID', unit: 'tablet', reorderLevel: 90, safetyStock: 30 },
  { code: 'MED-006', name: 'Azithromycin 500mg', category: 'Antibiotic', unit: 'tablet', reorderLevel: 60, safetyStock: 25 },
  { code: 'MED-007', name: 'Omeprazole 20mg', category: 'Gastrointestinal', unit: 'capsule', reorderLevel: 110, safetyStock: 40 },
  { code: 'MED-008', name: 'Amlodipine 5mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 140, safetyStock: 50 },
  { code: 'MED-009', name: 'Atorvastatin 10mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 130, safetyStock: 45 },
  { code: 'MED-010', name: 'Cetirizine 10mg', category: 'Antihistamine', unit: 'tablet', reorderLevel: 80, safetyStock: 30 },
  { code: 'MED-011', name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', unit: 'inhaler', reorderLevel: 40, safetyStock: 15 },
  { code: 'MED-012', name: 'Losartan 50mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 100, safetyStock: 35 },
  { code: 'MED-013', name: 'Pantoprazole 40mg', category: 'Gastrointestinal', unit: 'tablet', reorderLevel: 120, safetyStock: 40 },
  { code: 'MED-014', name: 'Metoprolol 25mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 70, safetyStock: 25 },
  { code: 'MED-015', name: 'Clopidogrel 75mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 60, safetyStock: 20 },
  { code: 'MED-016', name: 'Ceftriaxone 1g Injection', category: 'Antibiotic', unit: 'vial', reorderLevel: 50, safetyStock: 20 },
  { code: 'MED-017', name: 'Insulin Glargine 100IU/ml', category: 'Antidiabetic', unit: 'vial', reorderLevel: 30, safetyStock: 10 },
  { code: 'MED-018', name: 'Doxycycline 100mg', category: 'Antibiotic', unit: 'capsule', reorderLevel: 70, safetyStock: 25 },
  { code: 'MED-019', name: 'Levothyroxine 50mcg', category: 'Endocrine', unit: 'tablet', reorderLevel: 90, safetyStock: 30 },
  { code: 'MED-020', name: 'Montelukast 10mg', category: 'Respiratory', unit: 'tablet', reorderLevel: 65, safetyStock: 20 },
  { code: 'MED-021', name: 'Diclofenac 50mg', category: 'NSAID', unit: 'tablet', reorderLevel: 80, safetyStock: 30 },
  { code: 'MED-022', name: 'Ranitidine 150mg', category: 'Gastrointestinal', unit: 'tablet', reorderLevel: 50, safetyStock: 20 },
  { code: 'MED-023', name: 'Furosemide 40mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 60, safetyStock: 20 },
  { code: 'MED-024', name: 'Tramadol 50mg', category: 'Analgesic', unit: 'capsule', reorderLevel: 40, safetyStock: 15 },
  { code: 'MED-025', name: 'Alprazolam 0.5mg', category: 'Psychiatric', unit: 'tablet', reorderLevel: 30, safetyStock: 10 },
  { code: 'MED-026', name: 'Gabapentin 300mg', category: 'Neurology', unit: 'capsule', reorderLevel: 50, safetyStock: 20 },
  { code: 'MED-027', name: 'Fluconazole 150mg', category: 'Antifungal', unit: 'capsule', reorderLevel: 45, safetyStock: 15 },
  { code: 'MED-028', name: 'Mupirocin 2% Ointment', category: 'Dermatology', unit: 'tube', reorderLevel: 35, safetyStock: 12 },
  { code: 'MED-029', name: 'Ondansetron 4mg', category: 'Gastrointestinal', unit: 'tablet', reorderLevel: 75, safetyStock: 25 },
  { code: 'MED-030', name: 'Hydrochlorothiazide 25mg', category: 'Cardiovascular', unit: 'tablet', reorderLevel: 60, safetyStock: 20 }
];

export async function seedDatabase(options = {}) {
  const { resetDemo = false } = options;
  await connectDB();

  logger.info('--- Starting MedStock Seed Process ---');

  if (resetDemo) {
    logger.info('Resetting demo data as requested (--reset-demo)...');
    await User.deleteMany({ email: { $in: DEMO_USERS.map((u) => u.email) } });
    await Batch.deleteMany({ isDemo: true });
    await StockMovement.deleteMany({ referenceType: 'import' });
    await MedicineSupplier.deleteMany({});
    await Medicine.deleteMany({ isDemo: true });
    await Supplier.deleteMany({ isDemo: true });
    await DailyUsage.deleteMany({ dataSource: 'synthetic' });
    logger.info('Demo data cleaned.');
  }

  // 1. Seed System Users
  const seededUsers = {};
  for (const u of DEMO_USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      const salt = await bcrypt.genSalt(env.BCRYPT_COST);
      const passwordHash = await bcrypt.hash(u.password, salt);
      user = await User.create({
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        isActive: true
      });
      logger.info(`Created user: ${u.email} (${u.role})`);
    } else {
      logger.info(`User already exists: ${u.email}`);
    }
    seededUsers[u.role] = user;
  }

  // 2. Seed Suppliers
  const seededSuppliers = [];
  for (const s of DEMO_SUPPLIERS) {
    let supplier = await Supplier.findOne({ name: s.name });
    if (!supplier) {
      supplier = await Supplier.create({
        ...s,
        isActive: true,
        isDemo: true
      });
      logger.info(`Created supplier: ${s.name}`);
    }
    seededSuppliers.push(supplier);
  }

  // 3. Seed Medicines
  const seededMedicines = [];
  for (const m of MEDICINES_DATA) {
    let medicine = await Medicine.findOne({ medicineCode: m.code });
    if (!medicine) {
      medicine = await Medicine.create({
        medicineCode: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        description: `Pharmaceutical formulation for ${m.name}`,
        reorderLevel: m.reorderLevel,
        safetyStock: m.safetyStock,
        isActive: true,
        isDemo: true
      });
    }
    seededMedicines.push(medicine);
  }
  logger.info(`Seeded ${seededMedicines.length} medicines.`);

  // 4. Seed MedicineSupplier Links
  for (let i = 0; i < seededMedicines.length; i++) {
    const med = seededMedicines[i];
    const supp1 = seededSuppliers[i % seededSuppliers.length];
    const supp2 = seededSuppliers[(i + 1) % seededSuppliers.length];

    await MedicineSupplier.findOneAndUpdate(
      { medicineId: med._id, supplierId: supp1._id },
      {
        leadTimeDays: supp1.defaultLeadTimeDays,
        minOrderQty: 50,
        unitCost: Number((1.5 + (i % 8) * 0.75).toFixed(2)),
        isPreferred: true
      },
      { upsert: true }
    );

    await MedicineSupplier.findOneAndUpdate(
      { medicineId: med._id, supplierId: supp2._id },
      {
        leadTimeDays: supp2.defaultLeadTimeDays + 2,
        minOrderQty: 100,
        unitCost: Number((1.4 + (i % 8) * 0.75).toFixed(2)),
        isPreferred: false
      },
      { upsert: true }
    );
  }

  // 5. Seed Batches & Opening StockMovements
  const startOfToday = getStartOfToday();
  const adminUser = seededUsers.admin || (await User.findOne({ role: 'admin' }));

  for (let i = 0; i < seededMedicines.length; i++) {
    const med = seededMedicines[i];
    const supp = seededSuppliers[i % seededSuppliers.length];

    // Check if batches already exist for this medicine
    const existingBatches = await Batch.find({ medicineId: med._id });
    if (existingBatches.length > 0) {
      continue;
    }

    // Determine quantities (include some low stock cases, e.g. for MED-003, MED-017)
    const isDeliberateLowStock = med.medicineCode === 'MED-003' || med.medicineCode === 'MED-017';

    // Batch 1: Primary Healthy Batch (Expires in ~1.5 years)
    const b1Qty = isDeliberateLowStock ? 20 : 150 + (i % 5) * 40;
    const b1Mfg = new Date(startOfToday.getTime() - 120 * 24 * 60 * 60 * 1000);
    const b1Exp = new Date(startOfToday.getTime() + 450 * 24 * 60 * 60 * 1000);

    const batch1 = await Batch.create({
      batchNumber: `B-${med.medicineCode}-01`,
      medicineId: med._id,
      supplierId: supp._id,
      manufacturingDate: b1Mfg,
      expiryDate: b1Exp,
      initialQuantity: b1Qty,
      currentQuantity: b1Qty,
      purchaseCostPerUnit: Number((1.2 + (i % 6) * 0.5).toFixed(2)),
      receivedAt: b1Mfg,
      status: 'active',
      isDemo: true
    });

    await StockMovement.create({
      batchId: batch1._id,
      medicineId: med._id,
      movementType: 'receipt',
      quantityChange: b1Qty,
      balanceBefore: 0,
      balanceAfter: b1Qty,
      referenceType: 'import',
      reason: 'Opening stock balance',
      performedBy: adminUser._id,
      timestamp: b1Mfg
    });

    // Batch 2: Secondary Batch (Some expiring soon to trigger risk simulation)
    const isExpiringSoon = i % 4 === 0; // MED-001, MED-005, MED-009, etc.
    const b2Days = isExpiringSoon ? 15 : 240;
    const b2Qty = isDeliberateLowStock ? 10 : 80 + (i % 4) * 25;
    const b2Mfg = new Date(startOfToday.getTime() - 200 * 24 * 60 * 60 * 1000);
    const b2Exp = new Date(startOfToday.getTime() + b2Days * 24 * 60 * 60 * 1000);

    const batch2 = await Batch.create({
      batchNumber: `B-${med.medicineCode}-02`,
      medicineId: med._id,
      supplierId: supp._id,
      manufacturingDate: b2Mfg,
      expiryDate: b2Exp,
      initialQuantity: b2Qty,
      currentQuantity: b2Qty,
      purchaseCostPerUnit: Number((1.3 + (i % 6) * 0.5).toFixed(2)),
      receivedAt: b2Mfg,
      status: 'active',
      isDemo: true
    });

    await StockMovement.create({
      batchId: batch2._id,
      medicineId: med._id,
      movementType: 'receipt',
      quantityChange: b2Qty,
      balanceBefore: 0,
      balanceAfter: b2Qty,
      referenceType: 'import',
      reason: 'Opening stock balance',
      performedBy: adminUser._id,
      timestamp: b2Mfg
    });

    // Batch 3: An expired batch for some medicines (to test exclusion from FEFO)
    if (i % 7 === 0) {
      const b3Exp = new Date(startOfToday.getTime() - 20 * 24 * 60 * 60 * 1000); // expired 20 days ago
      const b3Mfg = new Date(b3Exp.getTime() - 365 * 24 * 60 * 60 * 1000);
      const b3Qty = 30;

      const batch3 = await Batch.create({
        batchNumber: `B-${med.medicineCode}-EXP`,
        medicineId: med._id,
        supplierId: supp._id,
        manufacturingDate: b3Mfg,
        expiryDate: b3Exp,
        initialQuantity: b3Qty,
        currentQuantity: b3Qty,
        purchaseCostPerUnit: Number((1.1 + (i % 6) * 0.5).toFixed(2)),
        receivedAt: b3Mfg,
        status: 'expired',
        isDemo: true
      });

      await StockMovement.create({
        batchId: batch3._id,
        medicineId: med._id,
        movementType: 'receipt',
        quantityChange: b3Qty,
        balanceBefore: 0,
        balanceAfter: b3Qty,
        referenceType: 'import',
        reason: 'Expired historical lot',
        performedBy: adminUser._id,
        timestamp: b3Mfg
      });
    }
  }

  // 6. Seed DailyUsage records for the last 365 days (>= 12 months)
  logger.info('Seeding 12 months of DailyUsage for demand forecasting...');
  const usageCount = await DailyUsage.countDocuments();
  if (usageCount === 0) {
    const dailyRecords = [];
    const daysHistory = 365;

    for (let d = daysHistory; d >= 1; d--) {
      const date = new Date(startOfToday.getTime() - d * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      for (let i = 0; i < seededMedicines.length; i++) {
        const med = seededMedicines[i];
        // Base consumption modulated by item velocity and weekend slowdown
        const baseDemand = 8 + (i % 10) * 2;
        const weekendFactor = isWeekend ? 0.4 : 1.0;
        const randomNoise = (Math.sin(d + i) * 3);
        const units = Math.max(0, Math.round((baseDemand + randomNoise) * weekendFactor));

        // Deliberate stockout pattern for MED-002
        const isStockoutDay = med.medicineCode === 'MED-002' && d >= 40 && d <= 43;

        dailyRecords.push({
          medicineId: med._id,
          date: normalizeToUtcDay(date),
          unitsDispensed: isStockoutDay ? 0 : units,
          unitsReceived: 0,
          stockoutObserved: isStockoutDay,
          dataSource: 'synthetic'
        });
      }
    }

    // Insert in batches of 1000 to keep memory low
    for (let i = 0; i < dailyRecords.length; i += 1000) {
      const chunk = dailyRecords.slice(i, i + 1000);
      await DailyUsage.insertMany(chunk, { ordered: false }).catch(() => {});
    }
    logger.info(`Inserted ${dailyRecords.length} DailyUsage records.`);
  }

  // 7. Seed Settings Document
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      expiryWarningDays: 30,
      expiryBands: [7, 30, 60, 90],
      defaultForecastHorizon: 15,
      serviceLevelZ: 1.65,
      targetCoverageDays: 30,
      currency: 'INR'
    });
    logger.info('System settings document initialized.');
  }

  // 8. Run Reconciliation
  const recon = await reconcileInventory();
  logger.info(`Inventory Reconciliation: Total Batches Checked: ${recon.totalBatchesChecked}, Mismatches: ${recon.mismatches.length}`);

  logger.info('--- Seed Completed Successfully ---');
  console.log('\n=============================================');
  console.log('MEDSTOCK AI DEMO CREDENTIALS:');
  console.log('Admin:   admin@medstock.local   / password123');
  console.log('Manager: manager@medstock.local / password123');
  console.log('Staff:   staff@medstock.local   / password123');
  console.log('=============================================\n');
}

// Allow direct CLI execution: node src/seed/seed.js [--reset-demo]
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const resetDemo = process.argv.includes('--reset-demo');
  seedDatabase({ resetDemo })
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error('Seed error:', err);
      await disconnectDB();
      process.exit(1);
    });
}
