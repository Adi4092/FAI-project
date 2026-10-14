import api from './api';

export const batchService = {
  async getBatches(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return api.get('/batches', { params: cleanParams });
  },

  async getBatchById(id) {
    return api.get(`/batches/${id}`);
  },

  async createBatch(payload) {
    return api.post('/batches', payload);
  },

  async updateBatch(id, payload) {
    return api.put(`/batches/${id}`, payload);
  },

  async getBatchHistory(id) {
    return api.get(`/batches/${id}/history`);
  },
};
