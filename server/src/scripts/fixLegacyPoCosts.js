import { connectDB, disconnectDB } from '../config/db.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Medicine } from '../models/Medicine.js'; // Ensure schema is registered
import { Supplier } from '../models/Supplier.js'; // Ensure schema is registered
import { logger } from '../config/logger.js';

/**
 * Migration Script: fixLegacyPoCosts.js
 * 
 * Converts legacy zero unit costs (unitCost: 0) on draft purchase orders created
 * from reorder recommendations into null (representing unknown cost), and recalculates
 * estimatedTotalCost (setting to null if all lines are unknown, or summing valid lines).
 * 
 * Usage:
 *   Dry-run mode (no changes written to DB):
 *     npm run fix:legacy-po-costs -- --dry-run
 * 
 *   Real execution (updates database):
 *     npm run fix:legacy-po-costs
 */

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(70));
  console.log(`[MIGRATION] Fix Legacy Draft PO Costs`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Safe: will NOT modify database)' : 'EXECUTE (Will commit changes to MongoDB)'}`);
  console.log('='.repeat(70));

  try {
    await connectDB();

    // Query draft purchase orders created from reorder recommendations
    const filter = {
      status: 'draft',
      sourceRecommendationId: { $ne: null }
    };

    const draftOrders = await PurchaseOrder.find(filter).populate('items.medicineId', 'name medicineCode unit');
    console.log(`Found ${draftOrders.length} draft purchase orders originating from reorders.`);

    let affectedCount = 0;

    for (const po of draftOrders) {
      let needsFix = false;
      const changes = [];

      for (const item of po.items) {
        if (item.unitCost === 0) {
          needsFix = true;
          const medName = item.medicineId?.name || String(item.medicineId);
          changes.push({
            medicine: medName,
            oldUnitCost: item.unitCost,
            newUnitCost: null,
            quantity: item.quantityOrdered
          });
          item.unitCost = null;
        }
      }

      // Check if estimatedTotalCost also needs recalculation
      const validKnownLines = po.items.filter(
        (it) => typeof it.unitCost === 'number' && it.unitCost > 0
      );

      const oldTotal = po.estimatedTotalCost;
      let newTotal = null;

      if (validKnownLines.length > 0) {
        const sum = validKnownLines.reduce(
          (acc, it) => acc + (it.unitCost * it.quantityOrdered),
          0
        );
        newTotal = Number(sum.toFixed(2));
      } else {
        newTotal = null;
      }

      if (oldTotal !== newTotal) {
        needsFix = true;
      }

      if (needsFix) {
        affectedCount++;
        console.log(`\nPO: ${po.orderNumber} (ID: ${po._id})`);
        changes.forEach((c) => {
          console.log(`  - Medicine: ${c.medicine} (Qty: ${c.quantity})`);
          console.log(`    unitCost: ${c.oldUnitCost} -> ${c.newUnitCost === null ? 'null (Cost unavailable)' : c.newUnitCost}`);
        });
        console.log(`  - estimatedTotalCost: ${oldTotal} -> ${newTotal === null ? 'null (Unknown)' : `$${newTotal}`}`);

        if (!isDryRun) {
          po.estimatedTotalCost = newTotal;
          po.markModified('items');
          await po.save();
          console.log(`  ✓ Successfully updated in database.`);
        } else {
          console.log(`  [DRY-RUN] No changes saved.`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Summary:`);
    console.log(`- Examined draft reorder POs: ${draftOrders.length}`);
    console.log(`- POs with legacy zero costs: ${affectedCount}`);
    if (isDryRun) {
      console.log(`- Result: DRY RUN complete. 0 records modified in database.`);
      console.log(`- To commit these changes, run: npm run fix:legacy-po-costs`);
    } else {
      console.log(`- Result: SUCCESS. ${affectedCount} records updated in database.`);
    }
    console.log('='.repeat(70));
  } catch (err) {
    console.error('[ERROR] Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
