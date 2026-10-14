import {
  receiveStock,
  dispenseStock,
  returnStock,
  adjustStock,
  writeOffStock,
  reconcileInventory,
  getInventorySummary
} from '../services/stockService.js';
import { allocateFEFO } from '../services/fefoService.js';
import { successResponse } from '../utils/apiResponse.js';

export async function getSummary(req, res, next) {
  try {
    const summary = await getInventorySummary();
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function getFefoPreview(req, res, next) {
  try {
    const { medicineId, quantity } = req.query;
    const plan = await allocateFEFO(medicineId, parseInt(quantity, 10));

    return successResponse(res, {
      medicineId,
      requestedQuantity: plan.requestedQuantity,
      sufficientStock: plan.sufficientStock,
      allocations: plan.allocations
    });
  } catch (error) {
    next(error);
  }
}

export async function receive(req, res, next) {
  try {
    const {
      medicineId,
      batchNumber,
      supplierId,
      manufacturingDate,
      expiryDate,
      quantity,
      purchaseCostPerUnit,
      purchaseOrderId
    } = req.body;

    const result = await receiveStock({
      medicineId,
      batchNumber,
      supplierId,
      manufacturingDate,
      expiryDate,
      quantity,
      purchaseCostPerUnit,
      purchaseOrderId,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function dispense(req, res, next) {
  try {
    const { medicineId, quantity, note, allocations } = req.body;

    const result = await dispenseStock({
      medicineId,
      quantity,
      note,
      allocations,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function returnItem(req, res, next) {
  try {
    const { batchId, quantity, reason, referenceDispenseMovementId } = req.body;

    const result = await returnStock({
      batchId,
      quantity,
      reason,
      referenceDispenseMovementId,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function adjust(req, res, next) {
  try {
    const { batchId, quantityChange, reason } = req.body;

    const result = await adjustStock({
      batchId,
      quantityChange,
      reason,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function writeOff(req, res, next) {
  try {
    const { batchId, reason } = req.body;

    const result = await writeOffStock({
      batchId,
      reason,
      performedBy: req.user.id,
      ip: req.ip
    });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function reconcile(req, res, next) {
  try {
    const report = await reconcileInventory();
    return successResponse(res, report);
  } catch (error) {
    next(error);
  }
}
