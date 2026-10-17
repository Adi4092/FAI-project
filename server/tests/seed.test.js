import { describe, it, expect } from 'vitest';
import { seedDatabase } from '../src/seed/seed.js';
import { User } from '../src/models/User.js';
import { Medicine } from '../src/models/Medicine.js';
import { Supplier } from '../src/models/Supplier.js';
import { Batch } from '../src/models/Batch.js';
import { DailyUsage } from '../src/models/DailyUsage.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { reconcileInventory } from '../src/services/stockService.js';

describe('Database Seed Script', () => {
  it('executes seedDatabase idempotently and completes reconciliation', async () => {
    await seedDatabase({ resetDemo: false });

    const userCount = await User.countDocuments();
    expect(userCount).toBe(3); // admin, manager, staff

    const medicineCount = await Medicine.countDocuments();
    expect(medicineCount).toBe(30);

    const supplierCount = await Supplier.countDocuments();
    expect(supplierCount).toBe(5);

    const batchCount = await Batch.countDocuments();
    expect(batchCount).toBeGreaterThanOrEqual(60);

    const movementCount = await StockMovement.countDocuments();
    expect(movementCount).toBeGreaterThanOrEqual(60);

    const usageCount = await DailyUsage.countDocuments();
    expect(usageCount).toBeGreaterThan(0);

    // Verify reconciliation
    const recon = await reconcileInventory();
    expect(recon.reconciled).toBe(true);
    expect(recon.mismatches.length).toBe(0);
  });

  it('spreads batch expiry dates realistically over 5 to 200 days without wiping data', async () => {
    await seedDatabase({ resetDemo: false });
    const { spreadBatchExpiry } = await import('../src/seed/spreadBatchExpiry.js');
    await spreadBatchExpiry();

    const now = new Date();
    const batches = await Batch.find({ status: 'active', currentQuantity: { $gt: 0 } });
    expect(batches.length).toBeGreaterThan(0);

    const b7 = batches.filter((b) => (b.expiryDate.getTime() - now.getTime()) / 86400000 <= 7);
    const b30 = batches.filter((b) => (b.expiryDate.getTime() - now.getTime()) / 86400000 <= 30);
    const b60 = batches.filter((b) => (b.expiryDate.getTime() - now.getTime()) / 86400000 <= 60);
    const b90 = batches.filter((b) => (b.expiryDate.getTime() - now.getTime()) / 86400000 <= 90);
    const bBeyond90 = batches.filter((b) => (b.expiryDate.getTime() - now.getTime()) / 86400000 > 90);

    expect(b7.length).toBeGreaterThan(0);
    expect(b30.length).toBeGreaterThan(b7.length);
    expect(b60.length).toBeGreaterThan(b30.length);
    expect(b90.length).toBeGreaterThan(b60.length);
    expect(bBeyond90.length).toBeGreaterThan(0);

    // Verify reconciliation still passes after spread adjustments
    const recon = await reconcileInventory();
    expect(recon.reconciled).toBe(true);
  });
});
