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
});
