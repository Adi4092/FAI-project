import mongoose from 'mongoose';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Medicine } from '../models/Medicine.js';
import { Supplier } from '../models/Supplier.js';
import { User } from '../models/User.js';
import { MedicineSupplier } from '../models/MedicineSupplier.js';
import { Batch } from '../models/Batch.js';
import { StockMovement } from '../models/StockMovement.js';
import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './auditService.js';
import { createNotification, resolveNotification } from './notificationService.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

/**
 * Recomputes item unit costs and total estimated cost on the server.
 * Never stores unknown cost as 0. Unknown cost is null.
 */
async function computeLineCostsAndTotal(supplierId, items) {
  let hasUnknown = false;
  let runningTotal = 0;
  let knownLineCount = 0;

  const processedItems = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantityOrdered) || 1);
    let unitCost = null;

    if (item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== '' && !isNaN(Number(item.unitCost)) && Number(item.unitCost) > 0) {
      unitCost = Number(Number(item.unitCost).toFixed(2));
    } else {
      // Lookup from MedicineSupplier association
      if (supplierId && item.medicineId) {
        const suppAssoc = await MedicineSupplier.findOne({
          medicineId: item.medicineId,
          supplierId
        });
        if (suppAssoc && suppAssoc.unitCost && suppAssoc.unitCost > 0) {
          unitCost = Number(suppAssoc.unitCost.toFixed(2));
        }
      }

      // If still null, lookup from latest batch
      if (unitCost === null && item.medicineId) {
        const latestBatch = await Batch.findOne({ medicineId: item.medicineId, purchaseCostPerUnit: { $gt: 0 } })
          .sort({ receivedAt: -1 });
        if (latestBatch && latestBatch.purchaseCostPerUnit > 0) {
          unitCost = Number(latestBatch.purchaseCostPerUnit.toFixed(2));
        }
      }
    }

    if (unitCost === null) {
      hasUnknown = true;
    } else {
      runningTotal += unitCost * qty;
      knownLineCount++;
    }

    processedItems.push({
      medicineId: item.medicineId,
      quantityOrdered: qty,
      unitCost, // strictly null if unknown, never 0
      quantityReceived: item.quantityReceived || 0
    });
  }

  const estimatedTotalCost = knownLineCount > 0 ? Number(runningTotal.toFixed(2)) : null;

  return {
    items: processedItems,
    estimatedTotalCost,
    hasUnknownCost: hasUnknown
  };
}

/**
 * Lists purchase orders with pagination and filtering
 */
export async function listPurchaseOrders(query) {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.supplierId) {
    filter.supplierId = query.supplierId;
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const total = await PurchaseOrder.countDocuments(filter);
  const orders = await PurchaseOrder.find(filter)
    .populate('supplierId', 'name contactPerson email phone')
    .populate('items.medicineId', 'name medicineCode unit')
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    items: orders.map((o) => {
      const json = o.toJSON();
      json.hasUnknownCost = json.items.some((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0);
      if (json.hasUnknownCost && (json.estimatedTotalCost === 0 || json.items.every((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0))) {
        json.estimatedTotalCost = null;
      }
      return json;
    }),
    meta: buildPaginationMeta(total, page, limit)
  };
}

/**
 * Gets a purchase order by ID with details
 */
export async function getPurchaseOrderById(id) {
  const po = await PurchaseOrder.findById(id)
    .populate('supplierId', 'name contactPerson email phone address defaultLeadTimeDays')
    .populate('items.medicineId', 'name medicineCode unit category')
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .populate('receipts.receivedBy', 'name email role')
    .populate('receipts.lines.medicineId', 'name medicineCode unit')
    .populate('receipts.lines.batchId', 'batchNumber expiryDate currentQuantity');

  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }

  const json = po.toJSON();
  json.hasUnknownCost = json.items.some((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0);
  if (json.hasUnknownCost && (json.estimatedTotalCost === 0 || json.items.every((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0))) {
    json.estimatedTotalCost = null;
  }
  return json;
}

/**
 * Creates a draft purchase order
 */
export async function createPurchaseOrder({ supplierId, expectedDeliveryDate, items, sourceRecommendationId }, userId) {
  if (!supplierId) {
    throw ApiError.badRequest('Supplier is required.');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Purchase order must contain at least one item line.');
  }

  const { items: computedItems, estimatedTotalCost, hasUnknownCost } = await computeLineCostsAndTotal(supplierId, items);

  const poCount = await PurchaseOrder.countDocuments();
  const year = new Date().getFullYear();
  const orderNumber = `PO-${year}-${String(poCount + 1).padStart(4, '0')}`;

  const po = await PurchaseOrder.create({
    orderNumber,
    supplierId,
    items: computedItems,
    status: 'draft',
    expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
    createdBy: userId,
    estimatedTotalCost,
    sourceRecommendationId: sourceRecommendationId || null
  });

  await logAudit({
    actorId: userId,
    action: 'PO_CREATE',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Created draft purchase order ${orderNumber}`
  });

  const json = po.toJSON();
  json.hasUnknownCost = hasUnknownCost;
  return json;
}

/**
 * Updates a draft purchase order
 */
export async function updateDraftPurchaseOrder(id, { supplierId, expectedDeliveryDate, items }, userId) {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status !== 'draft') {
    throw ApiError.badRequest(`Cannot edit purchase order in '${po.status}' status. Only draft orders can be edited.`);
  }

  const targetSupplierId = supplierId || po.supplierId;
  const targetItems = items || po.items;

  const { items: computedItems, estimatedTotalCost, hasUnknownCost } = await computeLineCostsAndTotal(targetSupplierId, targetItems);

  po.supplierId = targetSupplierId;
  po.items = computedItems;
  if (expectedDeliveryDate !== undefined) {
    po.expectedDeliveryDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : null;
  }
  po.estimatedTotalCost = estimatedTotalCost;

  await po.save();

  await logAudit({
    actorId: userId,
    action: 'PO_UPDATE',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Updated draft purchase order ${po.orderNumber}`
  });

  const json = po.toJSON();
  json.hasUnknownCost = hasUnknownCost;
  return json;
}

/**
 * Submits a draft purchase order for approval
 */
export async function submitPurchaseOrder(id, userId) {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status !== 'draft') {
    throw ApiError.badRequest(`Cannot submit purchase order in '${po.status}' status. Must be 'draft'.`);
  }
  if (!po.items || po.items.length === 0) {
    throw ApiError.badRequest('Cannot submit a purchase order with no items.');
  }

  po.status = 'pending_approval';
  await po.save();

  // Create alert for managers/admins
  await createNotification({
    type: 'po_pending',
    severity: 'warning',
    title: `Purchase Order ${po.orderNumber} Pending Approval`,
    message: `Purchase order ${po.orderNumber} has been submitted and is awaiting approval.`,
    relatedEntityType: 'PurchaseOrder',
    relatedEntityId: po._id,
    dedupeKey: `PO_PENDING:${po._id}`
  });

  // If created from recommendation, mark as ordered
  if (po.sourceRecommendationId) {
    await ReorderRecommendation.findByIdAndUpdate(po.sourceRecommendationId, { status: 'ordered' });
  }

  await logAudit({
    actorId: userId,
    action: 'PO_SUBMIT',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Submitted purchase order ${po.orderNumber} for approval`
  });

  return po.toJSON();
}

/**
 * Approves a pending purchase order
 */
export async function approvePurchaseOrder(id, userId) {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status !== 'pending_approval') {
    throw ApiError.badRequest(`Cannot approve purchase order in '${po.status}' status. Must be 'pending_approval'.`);
  }

  po.status = 'approved';
  po.approvedBy = userId;
  po.approvedAt = new Date();
  await po.save();

  // Resolve pending alert
  await resolveNotification(`PO_PENDING:${po._id}`);

  // Mark recommendation as ordered
  if (po.sourceRecommendationId) {
    await ReorderRecommendation.findByIdAndUpdate(po.sourceRecommendationId, { status: 'ordered' });
  }

  await logAudit({
    actorId: userId,
    action: 'PO_APPROVE',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Approved purchase order ${po.orderNumber}`
  });

  return po.toJSON();
}

/**
 * Rejects a pending purchase order
 */
export async function rejectPurchaseOrder(id, reason, userId) {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status !== 'pending_approval') {
    throw ApiError.badRequest(`Cannot reject purchase order in '${po.status}' status. Must be 'pending_approval'.`);
  }

  po.status = 'rejected';
  po.rejectReason = reason || 'Rejected by manager';
  po.cancelReason = reason || 'Rejected by manager';
  await po.save();

  await resolveNotification(`PO_PENDING:${po._id}`);

  await logAudit({
    actorId: userId,
    action: 'PO_REJECT',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Rejected purchase order ${po.orderNumber}: ${reason || 'No reason provided'}`
  });

  return po.toJSON();
}

/**
 * Cancels a purchase order (Reason required)
 */
export async function cancelPurchaseOrder(id, reason, userId) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Cancellation reason is required.');
  }

  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }
  if (po.status === 'received') {
    throw ApiError.badRequest('Cannot cancel an order that has already been fully received.');
  }
  if (po.status === 'cancelled') {
    throw ApiError.badRequest('Purchase order is already cancelled.');
  }

  po.status = 'cancelled';
  po.cancelReason = reason.trim();
  await po.save();

  await resolveNotification(`PO_PENDING:${po._id}`);

  await logAudit({
    actorId: userId,
    action: 'PO_CANCEL',
    entityType: 'PurchaseOrder',
    entityId: po._id,
    afterState: po.toJSON(),
    reason: `Cancelled purchase order ${po.orderNumber}: ${reason.trim()}`
  });

  return po.toJSON();
}

/**
 * Receives goods against a purchase order.
 * - Idempotent by receiptId
 * - Atomic in ONE database transaction
 * - Creates batches and stock movements with before/after balances
 * - Prevents over-receiving remaining ordered quantities
 * - Updates quantityReceived and status (partially_received or received)
 */
export async function receivePurchaseOrder(id, { receiptId, lines }, userId) {
  if (!receiptId || !receiptId.trim()) {
    throw ApiError.badRequest('receiptId (client UUID) is required for idempotency.');
  }
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    throw ApiError.badRequest('At least one receipt line is required.');
  }

  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found.');
  }

  // 1. Idempotency Check: if receiptId already committed, return without changes
  const existingReceipt = po.receipts.find((r) => r.receiptId === receiptId.trim());
  if (existingReceipt) {
    return po.toJSON();
  }

  // 2. Validate Order Status
  if (po.status !== 'approved' && po.status !== 'partially_received') {
    throw ApiError.badRequest(`Cannot receive stock for purchase order in '${po.status}' status. Order must be 'approved' or 'partially_received'.`);
  }

  // 3. Validate Remaining Quantities (Over-receive guard)
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!qty || qty <= 0) {
      throw ApiError.badRequest('Received quantity must be a positive number.');
    }

    const lineMedId = typeof line.medicineId === 'object' && line.medicineId !== null
      ? (line.medicineId._id || line.medicineId.id || String(line.medicineId))
      : String(line.medicineId);

    const item = po.items.find((it) => (it.medicineId?._id || it.medicineId)?.toString() === lineMedId.toString());
    if (!item) {
      throw ApiError.badRequest(`Medicine ${lineMedId} is not part of purchase order ${po.orderNumber}.`);
    }

    const remainingQty = item.quantityOrdered - (item.quantityReceived || 0);
    if (qty > remainingQty) {
      throw ApiError.badRequest(
        `Over-receive rejected: line quantity (${qty}) exceeds remaining ordered quantity (${remainingQty}) for medicine ${lineMedId}.`
      );
    }

    if (!line.batchNumber || !line.batchNumber.trim()) {
      throw ApiError.badRequest('Batch number is required for all received lines.');
    }
    if (!line.manufacturingDate || !line.expiryDate) {
      throw ApiError.badRequest('Manufacturing date and expiry date are required for all received lines.');
    }
    if (new Date(line.expiryDate) <= new Date(line.manufacturingDate)) {
      throw ApiError.badRequest(`Expiry date must be after manufacturing date for batch ${line.batchNumber}.`);
    }
  }

  // 4. Execute in a Transaction
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (err) {
    // If replica set transactions are not supported in the active environment
    useTransaction = false;
  }

  try {
    const receiptLines = [];

    for (const line of lines) {
      const lineMedId = typeof line.medicineId === 'object' && line.medicineId !== null
        ? (line.medicineId._id || line.medicineId.id || String(line.medicineId))
        : String(line.medicineId);

      const qty = Number(line.quantity);
      const unitCost = line.unitCost !== undefined && line.unitCost !== null && !isNaN(Number(line.unitCost))
        ? Number(line.unitCost)
        : null;

      // Create new Batch
      const batchDoc = new Batch({
        medicineId: lineMedId,
        supplierId: po.supplierId?._id || po.supplierId,
        batchNumber: line.batchNumber.trim(),
        manufacturingDate: new Date(line.manufacturingDate),
        expiryDate: new Date(line.expiryDate),
        initialQuantity: qty,
        currentQuantity: qty,
        purchaseCostPerUnit: unitCost,
        receivedAt: new Date(),
        purchaseOrderId: po._id,
        status: 'active'
      });

      if (useTransaction) {
        await batchDoc.save({ session });
      } else {
        await batchDoc.save();
      }

      // Create StockMovement (receipt)
      const movement = new StockMovement({
        batchId: batchDoc._id,
        medicineId: lineMedId,
        movementType: 'receipt',
        quantityChange: qty,
        balanceBefore: 0,
        balanceAfter: qty,
        referenceType: 'purchase_order',
        referenceId: po._id,
        reason: `PO Receipt: ${po.orderNumber} (Receipt ID: ${receiptId})`,
        performedBy: userId,
        timestamp: new Date()
      });

      if (useTransaction) {
        await movement.save({ session });
      } else {
        await movement.save();
      }

      // Update PO Item quantityReceived
      const item = po.items.find((it) => (it.medicineId?._id || it.medicineId)?.toString() === lineMedId.toString());
      item.quantityReceived = (item.quantityReceived || 0) + qty;

      receiptLines.push({
        medicineId: lineMedId,
        batchNumber: line.batchNumber.trim(),
        expiryDate: new Date(line.expiryDate),
        manufacturingDate: new Date(line.manufacturingDate),
        quantity: qty,
        unitCost,
        batchId: batchDoc._id
      });
    }

    // Determine final status
    const allFullyReceived = po.items.every((it) => (it.quantityReceived || 0) >= it.quantityOrdered);
    po.status = allFullyReceived ? 'received' : 'partially_received';

    // Append receipt record
    po.receipts.push({
      receiptId: receiptId.trim(),
      receivedAt: new Date(),
      receivedBy: userId,
      lines: receiptLines
    });

    if (useTransaction) {
      await po.save({ session });
      if (po.sourceRecommendationId) {
        await ReorderRecommendation.findByIdAndUpdate(
          po.sourceRecommendationId,
          { status: 'ordered' },
          { session }
        );
      }
      await session.commitTransaction();
    } else {
      await po.save();
      if (po.sourceRecommendationId) {
        await ReorderRecommendation.findByIdAndUpdate(po.sourceRecommendationId, { status: 'ordered' });
      }
    }

    await logAudit({
      actorId: userId,
      action: 'PO_RECEIVE',
      entityType: 'PurchaseOrder',
      entityId: po._id,
      afterState: { status: po.status, receiptId, receivedLinesCount: lines.length },
      reason: `Received goods for PO ${po.orderNumber} (Receipt ID: ${receiptId})`
    });

    return po.toJSON();
  } catch (err) {
    if (useTransaction && session) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}
