import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  Medicine,
  Batch,
  Supplier,
  MedicineSupplier,
  PurchaseOrder,
  Forecast,
  ReorderRecommendation,
  Notification,
  User
} from '../src/models/index.js';
import { getStockoutPredictions } from '../src/services/stockoutService.js';
import {
  generateReorderRecommendations,
  approveRecommendation
} from '../src/services/reorderService.js';
import {
  createNotification,
  resolveNotification
} from '../src/services/notificationService.js';
import { getExpiryRisk } from '../src/services/expiryRiskService.js';
import { aiClient } from '../src/services/aiClient.js';
import { getStartOfToday } from '../src/utils/dates.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Phase 6 — Inventory Intelligence Tests', () => {
  let adminUser;
  let supplier;
  let medicine;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.local',
      passwordHash: 'hashedpassword',
      role: 'admin'
    });

    supplier = await Supplier.create({
      name: 'PharmaCore Logistics',
      contactPerson: 'David Miller',
      email: 'david@pharmacore.com',
      phone: '+91 99999 11111',
      defaultLeadTimeDays: 5
    });

    medicine = await Medicine.create({
      name: 'Amoxicillin 500mg',
      medicineCode: 'MED-AMX',
      category: 'Antibiotic',
      unit: 'capsule',
      reorderLevel: 60,
      safetyStock: 20,
      isActive: true
    });

    await MedicineSupplier.create({
      medicineId: medicine._id,
      supplierId: supplier._id,
      leadTimeDays: 5,
      minOrderQty: 50,
      unitCost: 2.5,
      isPreferred: true
    });
  });

  // 1. Expired stock excluded from usable stock
  it('expired stock excluded from usable stock', async () => {
    const today = getStartOfToday();
    const activeExpiry = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const pastExpiry = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

    // Active batch with 50 units
    await Batch.create({
      batchNumber: 'BATCH-ACTIVE',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000),
      expiryDate: activeExpiry,
      initialQuantity: 50,
      currentQuantity: 50,
      status: 'active'
    });

    // Expired batch with 40 units (status expired)
    await Batch.create({
      batchNumber: 'BATCH-EXPIRED',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 400 * 24 * 60 * 60 * 1000),
      expiryDate: pastExpiry,
      initialQuantity: 40,
      currentQuantity: 40,
      status: 'expired'
    });

    const { predictions } = await getStockoutPredictions();
    const pred = predictions.find((p) => p.medicineId === medicine._id.toString());

    // Usable stock must be strictly 50, NOT 90
    expect(pred).toBeDefined();
    expect(pred.currentUsableStock).toBe(50);
  });

  // 2. Expiry-risk worked example (100 units, 3 per day, 10 days gives leftover 70 and Critical)
  it('expiry-risk worked example (100 units, 3 per day, 10 days gives leftover 70 and Critical)', async () => {
    const today = getStartOfToday();
    const expiryDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

    const batch = await Batch.create({
      batchNumber: 'BATCH-WORKED-EX',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate,
      initialQuantity: 100,
      currentQuantity: 100,
      purchaseCostPerUnit: 5.0,
      status: 'active'
    });

    // Forecast: 3 units per day for 10 days
    await Forecast.create({
      medicineId: medicine._id,
      forecastStartDate: today.toISOString().split('T')[0],
      forecastEndDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedDailyDemand: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: 3.0
      })),
      predictedTotalDemand: 30,
      status: 'completed'
    });

    // Mock AI service response representing Section 9.7 simulation outcome
    const spy = vi.spyOn(aiClient, 'simulateExpiryRisk').mockResolvedValue({
      asOfDate: today.toISOString().split('T')[0],
      results: [
        {
          batchId: batch._id.toString(),
          expectedConsumed: 30.0,
          expectedLeftover: 70.0,
          leftoverPct: 70.0,
          exposureValue: 350.0,
          riskLevel: 'critical',
          reasons: [
            'Only 10 days of shelf life remain (immediate expiry window)',
            'Projected demand covers only 30.0% of this batch under FEFO'
          ],
          suggestedActions: [
            'Prioritise dispensing this batch',
            'Review pending reorders to avoid excess accumulation'
          ],
          extrapolated: false,
          confidence: 'normal'
        }
      ]
    });

    const riskData = await getExpiryRisk({ windowDays: 30, medicineId: medicine._id.toString() });
    expect(riskData.batches.length).toBe(1);

    const bRes = riskData.batches[0];
    expect(bRes.currentQuantity).toBe(100);
    expect(bRes.expectedConsumed).toBe(30.0);
    expect(bRes.expectedLeftover).toBe(70.0);
    expect(bRes.leftoverPct).toBe(70.0);
    expect(bRes.riskLevel).toBe('critical');
    expect(bRes.exposureValue).toBe(350.0);
    expect(riskData.summary.disclaimer).toBe('Estimated — based on forecasts and assumptions, not guaranteed.');
    expect(riskData.summary.estimatedWastageUnits).toBe(70.0);

    spy.mockRestore();
  });

  // 3. Multi-batch FEFO expiry risk
  it('multi-batch FEFO expiry risk', async () => {
    const today = getStartOfToday();

    // Batch 1 expires in 5 days
    const batch1 = await Batch.create({
      batchNumber: 'BATCH-FEFO-1',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 50 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      initialQuantity: 40,
      currentQuantity: 40,
      status: 'active'
    });

    // Batch 2 expires in 15 days
    const batch2 = await Batch.create({
      batchNumber: 'BATCH-FEFO-2',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000),
      initialQuantity: 60,
      currentQuantity: 60,
      status: 'active'
    });

    const spy = vi.spyOn(aiClient, 'simulateExpiryRisk').mockImplementation(async (payload) => {
      // Confirm batches were received and sorted by FEFO
      expect(payload.batches.length).toBe(2);
      expect(payload.batches[0].batchId).toBe(batch1._id.toString());
      expect(payload.batches[1].batchId).toBe(batch2._id.toString());

      return {
        asOfDate: today.toISOString().split('T')[0],
        results: [
          {
            batchId: batch1._id.toString(),
            expectedConsumed: 20.0,
            expectedLeftover: 20.0,
            leftoverPct: 50.0,
            exposureValue: 50.0,
            riskLevel: 'critical',
            reasons: ['Prioritized under FEFO'],
            suggestedActions: ['Prioritise dispensing'],
            extrapolated: false,
            confidence: 'normal'
          },
          {
            batchId: batch2._id.toString(),
            expectedConsumed: 40.0,
            expectedLeftover: 20.0,
            leftoverPct: 33.3,
            exposureValue: 50.0,
            riskLevel: 'high',
            reasons: ['Later expiring batch'],
            suggestedActions: ['Monitor dispensing'],
            extrapolated: false,
            confidence: 'normal'
          }
        ]
      };
    });

    const res = await getExpiryRisk({ windowDays: 30, medicineId: medicine._id.toString() });
    expect(res.batches.length).toBe(2);

    const b1 = res.batches.find((b) => b.batchId === batch1._id.toString());
    const b2 = res.batches.find((b) => b.batchId === batch2._id.toString());

    expect(b1.riskLevel).toBe('critical');
    expect(b2.riskLevel).toBe('high');

    spy.mockRestore();
  });

  // 4. Incoming lot changing the result
  it('incoming lot changing the result', async () => {
    const today = getStartOfToday();

    await Batch.create({
      batchNumber: 'BATCH-WITH-INC',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
      initialQuantity: 50,
      currentQuantity: 50,
      status: 'active'
    });

    // Create confirmed incoming PO
    await PurchaseOrder.create({
      orderNumber: 'PO-EXP-001',
      supplierId: supplier._id,
      items: [
        {
          medicineId: medicine._id,
          quantityOrdered: 20,
          quantityReceived: 0,
          unitCost: 2.5
        }
      ],
      status: 'approved',
      expectedDeliveryDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
    });

    let receivedIncomingLots = [];
    const spy = vi.spyOn(aiClient, 'simulateExpiryRisk').mockImplementation(async (payload) => {
      receivedIncomingLots = payload.incoming || [];
      return {
        asOfDate: today.toISOString().split('T')[0],
        results: [
          {
            batchId: payload.batches[0].batchId,
            expectedConsumed: 20.0,
            expectedLeftover: 30.0, // Leftover increased because incoming lot absorbed 20 demand
            leftoverPct: 60.0,
            exposureValue: 75.0,
            riskLevel: 'critical',
            reasons: ['Confirmed incoming purchase order deliveries absorb a portion of projected demand'],
            suggestedActions: ['Prioritise dispensing this batch'],
            extrapolated: false,
            confidence: 'normal'
          }
        ]
      };
    });

    const res = await getExpiryRisk({ windowDays: 30, medicineId: medicine._id.toString() });
    expect(receivedIncomingLots.length).toBe(1);
    expect(receivedIncomingLots[0].quantity).toBe(20);
    expect(res.batches[0].expectedLeftover).toBe(30.0);
    expect(res.batches[0].reasons).toContain('Confirmed incoming purchase order deliveries absorb a portion of projected demand');

    spy.mockRestore();
  });

  // 5. Stockout without incoming orders
  it('stockout without incoming orders', async () => {
    const today = getStartOfToday();

    // Usable stock = 30
    await Batch.create({
      batchNumber: 'BATCH-NO-INC',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 50 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000),
      initialQuantity: 30,
      currentQuantity: 30,
      status: 'active'
    });

    // Forecast: 10 units/day for 15 days
    await Forecast.create({
      medicineId: medicine._id,
      forecastStartDate: today.toISOString().split('T')[0],
      forecastEndDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedDailyDemand: Array.from({ length: 15 }, (_, i) => ({
        date: new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: 10
      })),
      predictedTotalDemand: 150,
      status: 'completed'
    });

    const res = await getStockoutPredictions();
    const pred = res.predictions.find((p) => p.medicineId === medicine._id.toString());

    // Without incoming orders, stock runs out at day 3, lead time is 5 days
    expect(pred.daysUntilStockout).toBe(3);
    expect(pred.leadTimeDays).toBe(5);
    expect(pred.incomingConfirmedQuantity).toBe(0);
    expect(pred.riskLevel).toBe('critical');
    expect(pred.recommendedAction).toBe('Reorder immediately');
  });

  // 6. Stockout with incoming orders
  it('stockout with incoming orders', async () => {
    const today = getStartOfToday();

    await Batch.create({
      batchNumber: 'BATCH-WITH-PO',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 50 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000),
      initialQuantity: 30,
      currentQuantity: 30,
      status: 'active'
    });

    await Forecast.create({
      medicineId: medicine._id,
      forecastStartDate: today.toISOString().split('T')[0],
      forecastEndDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedDailyDemand: Array.from({ length: 15 }, (_, i) => ({
        date: new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: 10
      })),
      predictedTotalDemand: 150,
      status: 'completed'
    });

    // Confirmed incoming PO of 80 units arriving on Day 2
    await PurchaseOrder.create({
      orderNumber: 'PO-TEST-CONFIRMED',
      supplierId: supplier._id,
      items: [
        {
          medicineId: medicine._id,
          quantityOrdered: 80,
          quantityReceived: 0,
          unitCost: 2.5
        }
      ],
      status: 'approved',
      expectedDeliveryDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
    });

    const res = await getStockoutPredictions();
    const pred = res.predictions.find((p) => p.medicineId === medicine._id.toString());

    expect(pred.incomingConfirmedQuantity).toBe(80);
    // Stockout averted on Day 3; stockout extends to Day 11 ((30 + 80) / 10 = 11)
    expect(pred.daysUntilStockout).toBe(11);
    expect(pred.riskLevel).not.toBe('critical');
  });

  // 7. Hand-checked reorder calculation
  it('hand-checked reorder calculation', async () => {
    const today = getStartOfToday();

    // Usable stock = 30
    await Batch.create({
      batchNumber: 'BATCH-HANDCHECK',
      medicineId: medicine._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000),
      initialQuantity: 30,
      currentQuantity: 30,
      status: 'active'
    });

    // Forecast: 8 units/day over 15 days (total 120)
    // leadTimeDays = 5, safetyStock = 20, targetCoverageDays = 30, minOrderQty = 50
    // avgDailyDemand = 8
    // leadTimeDemand = 8 * 5 = 40
    // reorderPoint = leadTimeDemand + safetyStock = 40 + 20 = 60
    // inventoryPosition = 30 <= 60 (reorderPoint) -> trigger is TRUE
    // targetStock = 8 * 30 + 20 = 260
    // rawOrder = 260 - 30 = 230
    // MOQ = 50 -> roundUpToMultiple(max(230, 50), 50) = 250 units!
    await Forecast.create({
      medicineId: medicine._id,
      forecastStartDate: today.toISOString().split('T')[0],
      forecastEndDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedDailyDemand: Array.from({ length: 15 }, (_, i) => ({
        date: new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: 8
      })),
      predictedTotalDemand: 120,
      status: 'completed'
    });

    const recommendations = await generateReorderRecommendations(adminUser._id);
    expect(recommendations.length).toBe(1);

    const rec = recommendations[0];
    expect(rec.inputs.usableStock).toBe(30);
    expect(rec.inputs.avgDailyDemand).toBe(8);
    expect(rec.inputs.forecastLeadTimeDemand).toBe(40);
    expect(rec.inputs.safetyStock).toBe(20);
    expect(rec.inputs.reorderPoint).toBe(60);
    expect(rec.suggestedQuantity).toBe(250); // hand-checked exact value
    expect(rec.formulaText).toContain('targetStock (260)');
    expect(rec.formulaText).toContain('reorderPoint (60)');
    expect(rec.formulaText).toContain('MOQ 50 → 250 units');

    // Approve recommendation creates a draft PO
    const approved = await approveRecommendation(rec._id, adminUser._id);
    expect(approved.recommendation.status).toBe('approved');
    expect(approved.purchaseOrder).toBeDefined();
    expect(approved.purchaseOrder.status).toBe('draft');
    expect(approved.purchaseOrder.items[0].quantityOrdered).toBe(250);
  });

  // 8. Duplicate alert prevention
  it('duplicate alert prevention', async () => {
    const dedupeKey = `LOW_STOCK:${medicine._id}`;

    // 1. Create first notification
    const alert1 = await createNotification({
      type: 'low_stock',
      severity: 'warning',
      title: 'Low Stock Alert',
      message: 'Usable stock below reorder level',
      relatedEntityType: 'Medicine',
      relatedEntityId: medicine._id,
      dedupeKey
    });

    expect(alert1).toBeDefined();

    // 2. Triggering again while unresolved must NOT create a duplicate
    const alert2 = await createNotification({
      type: 'low_stock',
      severity: 'warning',
      title: 'Low Stock Alert Duplicate',
      message: 'Usable stock below reorder level duplicate attempt',
      relatedEntityType: 'Medicine',
      relatedEntityId: medicine._id,
      dedupeKey
    });

    const activeCount = await Notification.countDocuments({ dedupeKey, resolvedAt: null });
    expect(activeCount).toBe(1);
    expect(alert2._id.toString()).toBe(alert1._id.toString());

    // 3. Resolve the alert condition (e.g. after stock replenishment)
    await resolveNotification(dedupeKey);
    const unresolvedCount = await Notification.countDocuments({ dedupeKey, resolvedAt: null });
    expect(unresolvedCount).toBe(0);

    // 4. Once resolved, a new incident can create a fresh notification
    const alert3 = await createNotification({
      type: 'low_stock',
      severity: 'critical',
      title: 'New Low Stock Alert',
      message: 'Stock fell again',
      relatedEntityType: 'Medicine',
      relatedEntityId: medicine._id,
      dedupeKey
    });

    expect(alert3._id.toString()).not.toBe(alert1._id.toString());
    const totalCount = await Notification.countDocuments({ dedupeKey });
    expect(totalCount).toBe(2);
  });

  // 9. AI service down returns 503
  it('AI service down returns 503', async () => {
    // Mock fetch to simulate ECONNREFUSED when calling FastAPI
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

    try {
      await expect(
        aiClient.forecast({
          medicineId: 'MED-AMX',
          horizonDays: 15,
          history: []
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'AI_SERVICE_UNAVAILABLE'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 10. GET /api/forecasts returns saved forecasts
  it('GET /api/forecasts returns saved forecasts and handles query parameters', async () => {
    const today = getStartOfToday();
    const token = jwt.sign(
      { id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const forecastDoc = await Forecast.create({
      medicineId: medicine._id,
      generatedAt: new Date(),
      generatedBy: adminUser._id,
      forecastStartDate: today.toISOString().split('T')[0],
      forecastEndDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedDailyDemand: [
        { date: today.toISOString().split('T')[0], predicted: 10 }
      ],
      predictedTotalDemand: 150,
      evaluationMetrics: { mae: 1.5, rmse: 2.1, wape: 0.08, holdoutDays: 15 },
      dataWindow: { from: '2026-07-01', to: '2026-10-14', days: 105, maskedDays: 0 },
      provisional: false,
      warnings: [],
      status: 'completed'
    });

    // 1. Query with specific medicineId
    const res = await request(app)
      .get(`/api/forecasts?medicineId=${medicine._id}`)
      .set('Cookie', [`accessToken=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(forecastDoc._id.toString());
    expect(res.body.data[0].predictedTotalDemand).toBe(150);
    expect(res.body.data[0].modelVersion).toBe('rf-2026.10.1');

    // 2. Query without medicineId should also return forecasts instead of matching undefined
    const resAll = await request(app)
      .get('/api/forecasts')
      .set('Cookie', [`accessToken=${token}`]);

    expect(resAll.status).toBe(200);
    expect(resAll.body.success).toBe(true);
    expect(resAll.body.data.length).toBe(1);

    // 3. Query with non-existent medicine returns empty array
    const otherMed = await Medicine.create({
      name: 'Other Med',
      medicineCode: 'MED-OTH',
      category: 'Analgesic',
      unit: 'tablet'
    });
    const resEmpty = await request(app)
      .get(`/api/forecasts?medicineId=${otherMed._id}`)
      .set('Cookie', [`accessToken=${token}`]);

    expect(resEmpty.status).toBe(200);
    expect(resEmpty.body.data.length).toBe(0);
  });

  // 11. Expiry risk window filter (batches expiring in 5, 45, and 75 days)
  it('filters batches by windowDays (5, 45, 75 days expiry)', async () => {
    const today = getStartOfToday();

    const windowMed = await Medicine.create({
      name: 'Window Test Medicine',
      medicineCode: 'MED-WINDOW-TEST',
      category: 'Antibiotic',
      unit: 'vial'
    });

    const b5 = await Batch.create({
      batchNumber: 'BATCH-EXP-5D',
      medicineId: windowMed._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      initialQuantity: 50,
      currentQuantity: 50,
      status: 'active'
    });

    const b45 = await Batch.create({
      batchNumber: 'BATCH-EXP-45D',
      medicineId: windowMed._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000),
      initialQuantity: 100,
      currentQuantity: 100,
      status: 'active'
    });

    const b75 = await Batch.create({
      batchNumber: 'BATCH-EXP-75D',
      medicineId: windowMed._id,
      supplierId: supplier._id,
      manufacturingDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 75 * 24 * 60 * 60 * 1000),
      initialQuantity: 150,
      currentQuantity: 150,
      status: 'active'
    });

    const spy = vi.spyOn(aiClient, 'simulateExpiryRisk').mockImplementation(async (payload) => {
      return {
        asOfDate: today.toISOString().split('T')[0],
        results: payload.batches.map((b) => ({
          batchId: b.batchId,
          expectedConsumed: 10.0,
          expectedLeftover: b.quantity - 10.0,
          leftoverPct: 50.0,
          exposureValue: 50.0,
          riskLevel: 'medium',
          reasons: ['Window test'],
          suggestedActions: ['Monitor batch'],
          extrapolated: false,
          confidence: 'normal'
        }))
      };
    });

    // Window 7: only b5 (5 days)
    const res7 = await getExpiryRisk({ windowDays: 7, medicineId: windowMed._id.toString() });
    expect(res7.batches.length).toBe(1);
    expect(res7.batches[0].batchId).toBe(b5._id.toString());

    // Window 30: only b5 (5 days)
    const res30 = await getExpiryRisk({ windowDays: 30, medicineId: windowMed._id.toString() });
    expect(res30.batches.length).toBe(1);
    expect(res30.batches[0].batchId).toBe(b5._id.toString());

    // Window 60: b5 (5 days) and b45 (45 days)
    const res60 = await getExpiryRisk({ windowDays: 60, medicineId: windowMed._id.toString() });
    expect(res60.batches.length).toBe(2);
    const ids60 = res60.batches.map((b) => b.batchId);
    expect(ids60).toContain(b5._id.toString());
    expect(ids60).toContain(b45._id.toString());
    expect(ids60).not.toContain(b75._id.toString());

    // Window 90: b5 (5 days), b45 (45 days), and b75 (75 days)
    const res90 = await getExpiryRisk({ windowDays: 90, medicineId: windowMed._id.toString() });
    expect(res90.batches.length).toBe(3);
    const ids90 = res90.batches.map((b) => b.batchId);
    expect(ids90).toContain(b5._id.toString());
    expect(ids90).toContain(b45._id.toString());
    expect(ids90).toContain(b75._id.toString());

    spy.mockRestore();
  });

  // 12. Expiry risk 60-day window pagination across two pages
  it('returns total 22 across two pages with no batch repeated or missing in 60-day window', async () => {
    const today = getStartOfToday();

    const pagMed = await Medicine.create({
      name: 'Pagination 60d Test Medicine',
      medicineCode: 'MED-PAG-60D',
      category: 'Analgesic',
      unit: 'tablet'
    });

    // Create 22 batches expiring between 7 and 49 days (all within 60-day window)
    const createdBatchIds = [];
    for (let i = 1; i <= 22; i++) {
      const days = 5 + i * 2;
      const b = await Batch.create({
        batchNumber: `BATCH-PAG-${i.toString().padStart(2, '0')}`,
        medicineId: pagMed._id,
        supplierId: supplier._id,
        manufacturingDate: new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(today.getTime() + days * 24 * 60 * 60 * 1000),
        initialQuantity: 50 + i,
        currentQuantity: 50 + i,
        status: 'active'
      });
      createdBatchIds.push(b._id.toString());
    }

    const spy = vi.spyOn(aiClient, 'simulateExpiryRisk').mockImplementation(async (payload) => {
      return {
        asOfDate: today.toISOString().split('T')[0],
        results: payload.batches.map((b) => ({
          batchId: b.batchId,
          expectedConsumed: 10.0,
          expectedLeftover: b.quantity - 10.0,
          leftoverPct: 50.0,
          exposureValue: 50.0,
          riskLevel: 'medium',
          reasons: ['Pagination test'],
          suggestedActions: ['Monitor batch'],
          extrapolated: false,
          confidence: 'normal'
        }))
      };
    });

    // Page 1 (limit 20)
    const page1 = await getExpiryRisk({
      windowDays: 60,
      medicineId: pagMed._id.toString(),
      page: 1,
      limit: 20
    });

    expect(page1.meta.total).toBe(22);
    expect(page1.meta.totalPages).toBe(2);
    expect(page1.meta.page).toBe(1);
    expect(page1.batches.length).toBe(20);

    // Page 2 (limit 20)
    const page2 = await getExpiryRisk({
      windowDays: 60,
      medicineId: pagMed._id.toString(),
      page: 2,
      limit: 20
    });

    expect(page2.meta.total).toBe(22);
    expect(page2.meta.totalPages).toBe(2);
    expect(page2.meta.page).toBe(2);
    expect(page2.batches.length).toBe(2);

    // Combine batch IDs from both pages
    const page1Ids = page1.batches.map((b) => b.batchId);
    const page2Ids = page2.batches.map((b) => b.batchId);
    const allRetrievedIds = [...page1Ids, ...page2Ids];

    // Assert total count is 22
    expect(allRetrievedIds.length).toBe(22);

    // Assert no batch is repeated
    const uniqueIds = new Set(allRetrievedIds);
    expect(uniqueIds.size).toBe(22);

    // Assert no batch is missing (all 22 created batches are present)
    for (const id of createdBatchIds) {
      expect(uniqueIds.has(id)).toBe(true);
    }

    // Verify summary is computed over all 22 batches, not just page 1
    expect(page1.summary.estimatedWastageUnits).toBe(1133);
    expect(page2.summary.estimatedWastageUnits).toBe(1133);

    spy.mockRestore();
  });
});
