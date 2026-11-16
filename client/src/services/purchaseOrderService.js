import api from './api';

export const purchaseOrderService = {
  getPurchaseOrders(params = {}) {
    return api.get('/purchase-orders', { params });
  },

  getPurchaseOrder(id) {
    return api.get(`/purchase-orders/${id}`);
  },

  createPurchaseOrder(data) {
    return api.post('/purchase-orders', data);
  },

  updatePurchaseOrder(id, data) {
    return api.put(`/purchase-orders/${id}`, data);
  },

  submitPurchaseOrder(id) {
    return api.post(`/purchase-orders/${id}/submit`);
  },

  approvePurchaseOrder(id) {
    return api.post(`/purchase-orders/${id}/approve`);
  },

  rejectPurchaseOrder(id, reason) {
    return api.post(`/purchase-orders/${id}/reject`, { reason });
  },

  receivePurchaseOrder(id, data) {
    return api.post(`/purchase-orders/${id}/receive`, data);
  },

  cancelPurchaseOrder(id, cancelReason) {
    return api.post(`/purchase-orders/${id}/cancel`, { cancelReason });
  }
};

export default purchaseOrderService;
