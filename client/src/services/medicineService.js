import api from './api';

export const medicineService = {
  async getMedicines(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return api.get('/medicines', { params: cleanParams });
  },

  async getMedicineById(id) {
    return api.get(`/medicines/${id}`);
  },

  async createMedicine(payload) {
    return api.post('/medicines', payload);
  },

  async updateMedicine(id, payload) {
    return api.put(`/medicines/${id}`, payload);
  },

  async updateMedicineStatus(id, isActive) {
    return api.patch(`/medicines/${id}/status`, { isActive });
  },

  async getMedicineBatches(id) {
    return api.get(`/medicines/${id}/batches`);
  },

  async getMedicineSuppliers(id) {
    return api.get(`/medicines/${id}/suppliers`);
  },

  async updateMedicineSuppliers(id, suppliers) {
    return api.put(`/medicines/${id}/suppliers`, { suppliers });
  },
};
