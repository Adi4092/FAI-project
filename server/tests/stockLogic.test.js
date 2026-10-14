import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Supplier } from '../src/models/Supplier.js';
import { Medicine } from '../src/models/Medicine.js';
import { Batch } from '../src/models/Batch.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { getStartOfToday } from '../src/utils/dates.js';

describe('Inventory & Stock Logic (Phase 3)', () => {
  let adminCookies, csrfToken, supplier, medicine;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    await User.create({
      name: 'Admin Test',
      email: 'admin@test.local',
      passwordHash: hash,
      role: 'admin',
      isActive: true
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'password123' });

    adminCookies = loginRes.headers['set-cookie'];
    const csrfCookie = adminCookies.find((c) => c.startsWith('csrf_token='));
    csrfToken = csrfCookie.split(';')[0].split('=')[1];

    supplier = await Supplier.create({
      name: 'Global Pharma',
      contactPerson: 'Alice',
      defaultLeadTimeDays: 7
    });

    medicine = await Medicine.create({
      medicineCode: 'MED-101',
      name: 'Paracetamol 500mg',
      category: 'Analgesic',
      unit: 'tablet',
      reorderLevel: 100,
      safetyStock: 50
    });
  });

  it('rejects duplicate medicine codes with 409 DUPLICATE_RESOURCE', async () => {
    const res = await request(app)
      .post('/api/medicines')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineCode: 'MED-101', // already exists
        name: 'Duplicate Paracetamol',
        category: 'Analgesic',
        unit: 'tablet',
        reorderLevel: 50
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('receive stock creates batch and immutable receipt movement', async () => {
    const startOfToday = getStartOfToday();
    const mfg = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const exp = new Date(startOfToday.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/inventory/receive')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        batchNumber: 'B-REC-01',
        supplierId: supplier._id.toString(),
        manufacturingDate: mfg,
        expiryDate: exp,
        quantity: 200,
        purchaseCostPerUnit: 1.5
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.batch.currentQuantity).toBe(200);
    expect(res.body.data.movement.movementType).toBe('receipt');
    expect(res.body.data.movement.quantityChange).toBe(200);
    expect(res.body.data.movement.balanceBefore).toBe(0);
    expect(res.body.data.movement.balanceAfter).toBe(200);

    // Verify batch in DB
    const batchInDb = await Batch.findOne({ batchNumber: 'B-REC-01' });
    expect(batchInDb).toBeDefined();
    expect(batchInDb.currentQuantity).toBe(200);
  });

  it('dispenses stock according to FEFO (earliest expiry first)', async () => {
    const startOfToday = getStartOfToday();

    // Create 2 batches with different expiries
    const earlierExp = new Date(startOfToday.getTime() + 60 * 24 * 60 * 60 * 1000);
    const laterExp = new Date(startOfToday.getTime() + 180 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 60 * 24 * 60 * 60 * 1000);

    const b1 = await Batch.create({
      batchNumber: 'BATCH-EARLY',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: earlierExp,
      initialQuantity: 50,
      currentQuantity: 50,
      status: 'active'
    });

    const b2 = await Batch.create({
      batchNumber: 'BATCH-LATER',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: laterExp,
      initialQuantity: 100,
      currentQuantity: 100,
      status: 'active'
    });

    // Dispense 70 units: should take all 50 from BATCH-EARLY, and 20 from BATCH-LATER
    const res = await request(app)
      .post('/api/inventory/dispense')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        quantity: 70,
        note: 'Ward requisition'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalDispensed).toBe(70);

    const movements = res.body.data.movements;
    expect(movements.length).toBe(2);
    expect(movements[0].batchNumber).toBe('BATCH-EARLY');
    expect(movements[0].quantity).toBe(50);
    expect(movements[0].balanceAfter).toBe(0);

    expect(movements[1].batchNumber).toBe('BATCH-LATER');
    expect(movements[1].quantity).toBe(20);
    expect(movements[1].balanceAfter).toBe(80);

    // Verify batch states in DB
    const updatedB1 = await Batch.findById(b1._id);
    expect(updatedB1.currentQuantity).toBe(0);
    expect(updatedB1.status).toBe('depleted');

    const updatedB2 = await Batch.findById(b2._id);
    expect(updatedB2.currentQuantity).toBe(80);
    expect(updatedB2.status).toBe('active');
  });

  it('blocks dispensing from expired batches', async () => {
    const startOfToday = getStartOfToday();
    const expiredDate = new Date(startOfToday.getTime() - 10 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 365 * 24 * 60 * 60 * 1000);

    const expBatch = await Batch.create({
      batchNumber: 'BATCH-OLD',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: expiredDate,
      initialQuantity: 100,
      currentQuantity: 100,
      status: 'expired'
    });

    // Try explicit dispense from expired batch
    const res = await request(app)
      .post('/api/inventory/dispense')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        quantity: 10,
        allocations: [{ batchId: expBatch._id.toString(), quantity: 10 }]
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATCH_EXPIRED');
  });

  it('prevents negative stock (returns 409 INSUFFICIENT_STOCK)', async () => {
    const startOfToday = getStartOfToday();
    const exp = new Date(startOfToday.getTime() + 100 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    await Batch.create({
      batchNumber: 'BATCH-TINY',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: exp,
      initialQuantity: 10,
      currentQuantity: 10,
      status: 'active'
    });

    const res = await request(app)
      .post('/api/inventory/dispense')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        quantity: 50 // exceeds available 10
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('adjustment requires a reason and updates stock ledger', async () => {
    const startOfToday = getStartOfToday();
    const exp = new Date(startOfToday.getTime() + 100 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    const batch = await Batch.create({
      batchNumber: 'BATCH-ADJ',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: exp,
      initialQuantity: 50,
      currentQuantity: 50,
      status: 'active'
    });

    // Fails without reason
    const failRes = await request(app)
      .post('/api/inventory/adjust')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        batchId: batch._id.toString(),
        quantityChange: -5,
        reason: ''
      });
    expect(failRes.status).toBe(400);

    // Succeeds with reason
    const okRes = await request(app)
      .post('/api/inventory/adjust')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        batchId: batch._id.toString(),
        quantityChange: -5,
        reason: 'Damaged packaging during inventory count'
      });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.batch.currentQuantity).toBe(45);
    expect(okRes.body.data.movement.movementType).toBe('adjustment');
    expect(okRes.body.data.movement.quantityChange).toBe(-5);
    expect(okRes.body.data.movement.balanceBefore).toBe(50);
    expect(okRes.body.data.movement.balanceAfter).toBe(45);
  });

  it('write-off removes stock and calculates realized wastage cost', async () => {
    const startOfToday = getStartOfToday();
    const exp = new Date(startOfToday.getTime() - 5 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 300 * 24 * 60 * 60 * 1000);

    const batch = await Batch.create({
      batchNumber: 'BATCH-WRITEOFF',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: mfg,
      expiryDate: exp,
      initialQuantity: 40,
      currentQuantity: 40,
      purchaseCostPerUnit: 2.5,
      status: 'expired'
    });

    const res = await request(app)
      .post('/api/inventory/write-off')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        batchId: batch._id.toString(),
        reason: 'Expired quarantine disposal'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.writtenOffQuantity).toBe(40);
    expect(res.body.data.realizedWastageCost).toBe(100); // 40 * 2.50

    const updated = await Batch.findById(batch._id);
    expect(updated.currentQuantity).toBe(0);
  });

  it('reconcile endpoint verifies batch quantities against ledger movements', async () => {
    const startOfToday = getStartOfToday();
    const exp = new Date(startOfToday.getTime() + 200 * 24 * 60 * 60 * 1000);
    const mfg = new Date(startOfToday.getTime() - 100 * 24 * 60 * 60 * 1000);

    // Create batch via receiveStock
    const rec = await request(app)
      .post('/api/inventory/receive')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        batchNumber: 'B-RECON-01',
        supplierId: supplier._id.toString(),
        manufacturingDate: mfg.toISOString().slice(0, 10),
        expiryDate: exp.toISOString().slice(0, 10),
        quantity: 100,
        purchaseCostPerUnit: 1.0
      });

    // Dispense 30
    await request(app)
      .post('/api/inventory/dispense')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        medicineId: medicine._id.toString(),
        quantity: 30,
        note: 'Dispense 30'
      });

    // Run reconciliation
    const reconRes = await request(app)
      .get('/api/inventory/reconcile')
      .set('Cookie', adminCookies);

    expect(reconRes.status).toBe(200);
    expect(reconRes.body.data.reconciled).toBe(true);
    expect(reconRes.body.data.mismatches.length).toBe(0);
  });
});
