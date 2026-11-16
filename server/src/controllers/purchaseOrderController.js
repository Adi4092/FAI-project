import * as poService from '../services/purchaseOrderService.js';
import { successResponse } from '../utils/apiResponse.js';

export async function listPurchaseOrders(req, res, next) {
  try {
    const { items, meta } = await poService.listPurchaseOrders(req.query);
    return successResponse(res, items, 200, meta);
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseOrder(req, res, next) {
  try {
    const data = await poService.getPurchaseOrderById(req.params.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrder(req, res, next) {
  try {
    const data = await poService.createPurchaseOrder(req.body, req.user.id);
    return successResponse(res, data, 201);
  } catch (error) {
    next(error);
  }
}

export async function updatePurchaseOrder(req, res, next) {
  try {
    const data = await poService.updateDraftPurchaseOrder(req.params.id, req.body, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function submitPurchaseOrder(req, res, next) {
  try {
    const data = await poService.submitPurchaseOrder(req.params.id, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function approvePurchaseOrder(req, res, next) {
  try {
    const data = await poService.approvePurchaseOrder(req.params.id, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function rejectPurchaseOrder(req, res, next) {
  try {
    const reason = req.body.reason || req.body.rejectReason;
    const data = await poService.rejectPurchaseOrder(req.params.id, reason, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function receivePurchaseOrder(req, res, next) {
  try {
    const data = await poService.receivePurchaseOrder(req.params.id, req.body, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function cancelPurchaseOrder(req, res, next) {
  try {
    const reason = req.body.cancelReason || req.body.reason;
    const data = await poService.cancelPurchaseOrder(req.params.id, reason, req.user.id);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}
