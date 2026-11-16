import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import {
  Medicine,
  Batch,
  Supplier,
  MedicineSupplier,
  PurchaseOrder,
  StockMovement,
  DailyUsage,
  Notification,
  User,
  Setting
} from '../src/models/index.js';
import { getStartOfToday } from '../src/utils/dates.js';

describe('Phase 7 — Enterprise Operations, Reports, POs, RBAC & CSV Import', () => {
  let adminUser, managerUser, staffUser;
  let adminCookies, managerCookies, staffCookies;
  let adminCsrf, managerCsrf, staffCsrf;
  let supplier, medicine;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.local',
      passwordHash: hash,
      role: 'admin',
      isActive: true
    });

    managerUser = await User.create({
      name: 'Inventory Manager',
      email: 'manager@test.local',
      passwordHash: hash,
      role: 'inventory_manager',
      isActive: true
    });

    staffUser = await User.create({
      name: 'Pharmacy Staff',
      email: 'staff@test.local',
      passwordHash: hash,
      role: 'staff',
      isActive: true
    });

    // Login each to capture cookies and csrf
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'password123' });
    adminCookies = adminLogin.headers['set-cookie'];
    adminCsrf = adminCookies.find((c) => c.startsWith('csrf_token=')).split(';')[0].split('=')[1];

    const managerLogin = await request(app).post('/api/auth/login').send({ email: 'manager@test.local', password: 'password123' });
    managerCookies = managerLogin.headers['set-cookie'];
    managerCsrf = managerCookies.find((c) => c.startsWith('csrf_token=')).split(';')[0].split('=')[1];

    const staffLogin = await request(app).post('/api/auth/login').send({ email: 'staff@test.local', password: 'password123' });
    staffCookies = staffLogin.headers['set-cookie'];
    staffCsrf = staffCookies.find((c) => c.startsWith('csrf_token=')).split(';')[0].split('=')[1];

    supplier = await Supplier.create({
      name: 'MedSupply Logistics',
      contactPerson: 'Sarah Connor',
      email: 'sarah@medsupply.com',
      phone: '+1 555-0199',
      defaultLeadTimeDays: 7
    });

    medicine = await Medicine.create({
      name: 'Ciprofloxacin 500mg',
      medicineCode: 'MED-CIPRO',
      category: 'Antibiotic',
      unit: 'tablet',
      reorderLevel: 80,
      safetyStock: 30,
      isActive: true
    });

    await MedicineSupplier.create({
      medicineId: medicine._id,
      supplierId: supplier._id,
      leadTimeDays: 7,
      minOrderQty: 100,
      unitCost: 1.5,
      isPreferred: true
    });
  });

  // 1. PO Create (draft) & Unknown Cost Handling
  it('PO create stores draft with server-computed totals and stores unknown cost as null, never 0', async () => {
    // Medicine with NO cost association
    const unknownCostMed = await Medicine.create({
      name: 'Mystery Formulation',
      medicineCode: 'MED-MYST',
      category: 'Analgesic',
      unit: 'vial',
      reorderLevel: 20
    });

    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        supplierId: supplier._id,
        items: [
          { medicineId: medicine._id, quantityOrdered: 200 }, // has known cost 1.50
          { medicineId: unknownCostMed._id, quantityOrdered: 50 } // unknown cost!
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const po = res.body.data;
    expect(po.status).toBe('draft');
    expect(po.orderNumber).toMatch(/^PO-\d{4}-\d{4}$/);

    // Item 1: known cost
    const item1 = po.items.find((it) => (it.medicineId?._id || it.medicineId).toString() === medicine._id.toString());
    expect(item1.unitCost).toBe(1.5);

    // Item 2: unknown cost must be strictly null, NEVER 0
    const item2 = po.items.find((it) => (it.medicineId?._id || it.medicineId).toString() === unknownCostMed._id.toString());
    expect(item2.unitCost).toBeNull();
    expect(item2.unitCost).not.toBe(0);

    // Estimated total excludes the unknown line
    expect(po.estimatedTotalCost).toBe(300); // 200 * 1.50 = 300
    expect(po.hasUnknownCost).toBe(true);
  });

  // 1b. Legacy Zero-Cost Handling & Listing
  it('legacy zero unit costs are treated as unknown costs (hasUnknownCost: true, estimatedTotalCost: null)', async () => {
    // Create legacy draft PO with unitCost: 0, estimatedTotalCost: 0, hasUnknownCost: false
    const legacyPo = await PurchaseOrder.create({
      orderNumber: 'PO-2026-0001',
      supplierId: supplier._id,
      items: [
        {
          medicineId: medicine._id,
          quantityOrdered: 170,
          unitCost: 0, // Legacy 0 cost
          quantityReceived: 0
        }
      ],
      status: 'draft',
      createdBy: managerUser._id,
      estimatedTotalCost: 0
    });

    // 1. Check GET /api/purchase-orders (list under Draft tab)
    const listRes = await request(app)
      .get('/api/purchase-orders?status=draft')
      .set('Cookie', managerCookies);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const found = listRes.body.data.find((p) => p.orderNumber === 'PO-2026-0001');
    expect(found).toBeDefined();
    expect(found.hasUnknownCost).toBe(true);
    expect(found.estimatedTotalCost).toBeNull();
    expect(found.supplierId.name).toBe('MedSupply Logistics');
    expect(found.items[0].medicineId.name).toBe('Ciprofloxacin 500mg');

    // 2. Check GET /api/purchase-orders/:id (detail)
    const detailRes = await request(app)
      .get(`/api/purchase-orders/${legacyPo._id}`)
      .set('Cookie', managerCookies);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.hasUnknownCost).toBe(true);
    expect(detailRes.body.data.estimatedTotalCost).toBeNull();
  });

  // 2. PO Submit & Pending Alert
  it('PO submit transitions draft to pending_approval and triggers pending notification', async () => {
    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        supplierId: supplier._id,
        items: [{ medicineId: medicine._id, quantityOrdered: 150 }]
      });

    const poId = createRes.body.data.id;

    const submitRes = await request(app)
      .post(`/api/purchase-orders/${poId}/submit`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('pending_approval');

    // Verify alert created
    const notif = await Notification.findOne({ dedupeKey: `PO_PENDING:${poId}`, resolvedAt: null });
    expect(notif).toBeDefined();
    expect(notif.type).toBe('po_pending');
  });

  // 3. PO Approve & Alert Auto-Resolution
  it('PO approve transitions pending_approval to approved and resolves pending alert', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9001',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 100, unitCost: 1.5 }],
      status: 'pending_approval'
    });

    const approveRes = await request(app)
      .post(`/api/purchase-orders/${po._id}/approve`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');
    expect(approveRes.body.data.approvedBy).toBe(adminUser._id.toString());

    // Notification resolved
    const unresolved = await Notification.findOne({ dedupeKey: `PO_PENDING:${po._id}`, resolvedAt: null });
    expect(unresolved).toBeNull();
  });

  // 4. PO Reject
  it('PO reject marks order rejected with reason', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9002',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 100, unitCost: 1.5 }],
      status: 'pending_approval'
    });

    const rejectRes = await request(app)
      .post(`/api/purchase-orders/${po._id}/reject`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ reason: 'Exceeds department budget allocation' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');
    expect(rejectRes.body.data.rejectReason).toBe('Exceeds department budget allocation');
  });

  // 5. PO Cancel Requires Reason
  it('PO cancel requires reason and rejects without one', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9003',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 100, unitCost: 1.5 }],
      status: 'draft'
    });

    // Attempt cancel without reason
    const badRes = await request(app)
      .post(`/api/purchase-orders/${po._id}/cancel`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ cancelReason: '' });

    expect(badRes.status).toBe(400);

    // Cancel with valid reason
    const okRes = await request(app)
      .post(`/api/purchase-orders/${po._id}/cancel`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ cancelReason: 'Supplier discontinued this item' });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.status).toBe('cancelled');
    expect(okRes.body.data.cancelReason).toBe('Supplier discontinued this item');
  });

  // 6. Partial Receive, Full Receive & Ledger Verification
  it('PO receive performs transactional partial receive then full receive with stock movements', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9004',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 100, unitCost: 1.5, quantityReceived: 0 }],
      status: 'approved'
    });

    // 1st delivery: Partial (60 units)
    const receipt1Res = await request(app)
      .post(`/api/purchase-orders/${po._id}/receive`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        receiptId: 'uuid-receipt-001',
        lines: [
          {
            medicineId: medicine._id,
            batchNumber: 'CIP-B01',
            manufacturingDate: '2026-01-01',
            expiryDate: '2028-01-01',
            quantity: 60,
            unitCost: 1.5
          }
        ]
      });

    expect(receipt1Res.status).toBe(200);
    expect(receipt1Res.body.data.status).toBe('partially_received');
    expect(receipt1Res.body.data.items[0].quantityReceived).toBe(60);

    // Verify batch and movement
    const batch1 = await Batch.findOne({ batchNumber: 'CIP-B01' });
    expect(batch1).toBeDefined();
    expect(batch1.currentQuantity).toBe(60);

    const mvt1 = await StockMovement.findOne({ batchId: batch1._id, movementType: 'receipt' });
    expect(mvt1).toBeDefined();
    expect(mvt1.quantityChange).toBe(60);

    // 2nd delivery: Full completion (remaining 40 units)
    const receipt2Res = await request(app)
      .post(`/api/purchase-orders/${po._id}/receive`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        receiptId: 'uuid-receipt-002',
        lines: [
          {
            medicineId: medicine._id,
            batchNumber: 'CIP-B02',
            manufacturingDate: '2026-02-01',
            expiryDate: '2028-02-01',
            quantity: 40,
            unitCost: 1.5
          }
        ]
      });

    expect(receipt2Res.status).toBe(200);
    expect(receipt2Res.body.data.status).toBe('received');
    expect(receipt2Res.body.data.items[0].quantityReceived).toBe(100);
  });

  // 7. Duplicate receiptId Idempotency
  it('duplicate receiptId idempotency returns original result and does not duplicate stock', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9005',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 50, unitCost: 1.5, quantityReceived: 0 }],
      status: 'approved'
    });

    const payload = {
      receiptId: 'idempotent-uuid-12345',
      lines: [
        {
          medicineId: medicine._id,
          batchNumber: 'CIP-IDEMPO',
          manufacturingDate: '2026-01-10',
          expiryDate: '2027-12-31',
          quantity: 50,
          unitCost: 1.5
        }
      ]
    };

    // First call
    const res1 = await request(app)
      .post(`/api/purchase-orders/${po._id}/receive`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('received');

    // Second call with identical receiptId
    const res2 = await request(app)
      .post(`/api/purchase-orders/${po._id}/receive`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send(payload);

    expect(res2.status).toBe(200);

    // Verify only ONE batch was created and total received stock did NOT double
    const batches = await Batch.find({ batchNumber: 'CIP-IDEMPO' });
    expect(batches.length).toBe(1);

    const movements = await StockMovement.find({ referenceId: po._id });
    expect(movements.length).toBe(1);
  });

  // 8. Over-receive Rejected
  it('over-receive rejected when quantity exceeds remaining ordered quantity', async () => {
    const po = await PurchaseOrder.create({
      orderNumber: 'PO-2026-9006',
      supplierId: supplier._id,
      items: [{ medicineId: medicine._id, quantityOrdered: 50, unitCost: 1.5, quantityReceived: 0 }],
      status: 'approved'
    });

    const res = await request(app)
      .post(`/api/purchase-orders/${po._id}/receive`)
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        receiptId: 'uuid-over-receive',
        lines: [
          {
            medicineId: medicine._id,
            batchNumber: 'CIP-OVER',
            manufacturingDate: '2026-01-01',
            expiryDate: '2027-01-01',
            quantity: 55 // 55 > 50!
          }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/exceeds remaining/i);
  });

  // 9. Notifications: Read, Mark All & Deduplication
  it('notifications read, mark-all and deduplication work correctly', async () => {
    const n1 = await Notification.create({
      type: 'low_stock',
      severity: 'warning',
      title: 'Low Stock Test 1',
      message: 'Test message 1',
      dedupeKey: 'LOW:TEST1',
      isRead: false
    });

    const n2 = await Notification.create({
      type: 'expiring_batch',
      severity: 'critical',
      title: 'Expiring Test 2',
      message: 'Test message 2',
      dedupeKey: 'EXP:TEST2',
      isRead: false
    });

    // Mark single notification as read
    const readRes = await request(app)
      .patch(`/api/notifications/${n1._id}/read`)
      .set('Cookie', staffCookies)
      .set('X-CSRF-Token', staffCsrf);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.isRead).toBe(true);

    // Mark all as read
    const allRes = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Cookie', staffCookies)
      .set('X-CSRF-Token', staffCsrf);

    expect(allRes.status).toBe(200);

    const unreadCountRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', staffCookies);

    expect(unreadCountRes.body.data.unreadCount).toBe(0);

    // Deduplication test: Creating duplicate unresolved dedupeKey is prevented
    let errorThrown = false;
    try {
      await Notification.create({
        type: 'low_stock',
        title: 'Duplicate',
        message: 'Duplicate',
        dedupeKey: 'LOW:TEST1', // same dedupeKey while resolvedAt is null
        resolvedAt: null
      });
    } catch (e) {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
  });

  // 10. Reports: CSV Export Matches Data
  it('report CSV export returns text/csv matching table data', async () => {
    await DailyUsage.create({
      medicineId: medicine._id,
      date: '2026-10-01',
      unitsDispensed: 25,
      stockoutObserved: false,
      dataSource: 'ledger'
    });

    const csvRes = await request(app)
      .get('/api/reports/consumption?format=csv')
      .set('Cookie', managerCookies);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
    expect(csvRes.text).toContain('"Date","Medicine Code","Medicine Name","Units Dispensed"');
    expect(csvRes.text).toContain('2026-10-01');
    expect(csvRes.text).toContain('MED-CIPRO');
    expect(csvRes.text).toContain('25');
  });

  // 11. Last-Admin Protection
  it('last-admin protection prevents deactivating, demoting, or removing the last admin', async () => {
    // There is only 1 adminUser created in beforeEach
    // 1. Attempt to demote to staff
    const demoteRes = await request(app)
      .patch(`/api/users/${adminUser._id}/role`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ role: 'staff' });

    expect(demoteRes.status).toBe(400);
    expect(demoteRes.body.error.message).toMatch(/last active system administrator/i);

    // 2. Attempt to deactivate
    const deactRes = await request(app)
      .patch(`/api/users/${adminUser._id}/status`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ isActive: false });

    expect(deactRes.status).toBe(400);
    expect(deactRes.body.error.message).toMatch(/last active system administrator/i);

    // 3. Attempt to delete
    const deleteRes = await request(app)
      .delete(`/api/users/${adminUser._id}`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.error.message).toMatch(/last active system administrator/i);
  });

  // 12. Sensitive Routes RBAC Enforcement
  it('RBAC strictly enforces role permissions across sensitive routes', async () => {
    // Staff cannot access Purchase Orders
    const staffPoRes = await request(app)
      .get('/api/purchase-orders')
      .set('Cookie', staffCookies);
    expect(staffPoRes.status).toBe(403);

    // Staff cannot access Reports
    const staffRepRes = await request(app)
      .get('/api/reports/consumption')
      .set('Cookie', staffCookies);
    expect(staffRepRes.status).toBe(403);

    // Staff cannot access Users
    const staffUserRes = await request(app)
      .get('/api/users')
      .set('Cookie', staffCookies);
    expect(staffUserRes.status).toBe(403);

    // Staff cannot access System Settings
    const staffSetRes = await request(app)
      .get('/api/settings')
      .set('Cookie', staffCookies);
    expect(staffSetRes.status).toBe(403);

    // Manager CAN access Purchase Orders
    const mgrPoRes = await request(app)
      .get('/api/purchase-orders')
      .set('Cookie', managerCookies);
    expect(mgrPoRes.status).toBe(200);

    // Manager CAN access Reports
    const mgrRepRes = await request(app)
      .get('/api/reports/consumption')
      .set('Cookie', managerCookies);
    expect(mgrRepRes.status).toBe(200);

    // Manager CANNOT access Users (Admin only)
    const mgrUserRes = await request(app)
      .get('/api/users')
      .set('Cookie', managerCookies);
    expect(mgrUserRes.status).toBe(403);

    // Manager CAN access CSV import preview
    const mgrImportRes = await request(app)
      .post('/api/settings/import/preview')
      .set('Cookie', managerCookies)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        type: 'medicines',
        csvData: 'medicineCode,name,category,unit,reorderLevel\nMED-IMP1,Import Med,Analgesic,tablet,50'
      });
    expect(mgrImportRes.status).toBe(200);
  });

  // 13. CSV Import Validation, Preview & Ledger Reconciliation
  it('CSV import validates whole file, previews errors, and creates ledger movements upon commit', async () => {
    // 1. Missing critical columns rejects whole file
    const badColCsv = 'code,product_name\nMED-1,Med 1';
    const badColRes = await request(app)
      .post('/api/settings/import/preview')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ type: 'medicines', csvData: badColCsv });

    expect(badColRes.status).toBe(400);
    expect(badColRes.body.error.message).toMatch(/Missing required columns/i);

    // 2. Batches CSV with 1 valid row and 1 invalid row (unknown medicine code)
    const batchesCsv = `medicineCode,batchNumber,manufacturingDate,expiryDate,quantity,purchaseCostPerUnit
MED-CIPRO,B-VALID-01,2026-01-01,2028-01-01,150,1.50
MED-NONEXIST,B-INVALID-02,2026-01-01,2028-01-01,80,2.00`;

    const previewRes = await request(app)
      .post('/api/settings/import/preview')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ type: 'batches', csvData: batchesCsv });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.totalRows).toBe(2);
    expect(previewRes.body.data.acceptedCount).toBe(1);
    expect(previewRes.body.data.rejectedCount).toBe(1);

    const importId = previewRes.body.data.importId;

    // 3. Commit only the valid rows
    const commitRes = await request(app)
      .post('/api/settings/import/commit')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrf)
      .send({ importId, type: 'batches', validRows: previewRes.body.data.validRows });

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.data.accepted).toBe(1);

    // 4. Verify batch was created AND receipt stock movement was created to reconcile ledger
    const importedBatch = await Batch.findOne({ batchNumber: 'B-VALID-01' });
    expect(importedBatch).toBeDefined();
    expect(importedBatch.currentQuantity).toBe(150);

    const ledgerMovement = await StockMovement.findOne({ batchId: importedBatch._id, movementType: 'receipt' });
    expect(ledgerMovement).toBeDefined();
    expect(ledgerMovement.quantityChange).toBe(150);
    expect(ledgerMovement.balanceAfter).toBe(150);
    expect(ledgerMovement.referenceType).toBe('import');
  });
});
