import api from './api';

export const inventoryService = {
  async getInventorySummary() {
    return api.get('/inventory/summary');
  },

  async getFefoPreview(medicineId, quantity) {
    return api.get('/inventory/fefo-preview', {
      params: { medicineId, quantity },
    });
  },

  async receiveStock(payload) {
    return api.post('/inventory/receive', payload);
  },

  async dispenseStock(payload) {
    return api.post('/inventory/dispense', payload);
  },

  async returnStock(payload) {
    return api.post('/inventory/return', payload);
  },

  async adjustStock(payload) {
    return api.post('/inventory/adjust', payload);
  },

  async writeOffStock(payload) {
    return api.post('/inventory/write-off', payload);
  },

  async reconcileInventory() {
    return api.get('/inventory/reconcile');
  },
};
