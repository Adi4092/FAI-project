import api from './api';

export const supplierService = {
  async getSuppliers(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return api.get('/suppliers', { params: cleanParams });
  },

  async getSupplierById(id) {
    return api.get(`/suppliers/${id}`);
  },

  async createSupplier(payload) {
    return api.post('/suppliers', payload);
  },

  async updateSupplier(id, payload) {
    return api.put(`/suppliers/${id}`, payload);
  },

  async updateSupplierStatus(id, isActive) {
    return api.patch(`/suppliers/${id}/status`, { isActive });
  },

  async getSupplierBatches(id) {
    return api.get(`/suppliers/${id}/batches`);
  },

  async getSupplierPurchaseOrders(id) {
    return api.get(`/suppliers/${id}/purchase-orders`);
  },
};
