import api from './api';

export const reorderService = {
  getRecommendations({ status = null, page = 1, limit = 20 } = {}) {
    return api.get('/reorders', {
      params: { status, page, limit }
    });
  },

  generateRecommendations() {
    return api.post('/reorders/generate');
  },

  approveRecommendation(id) {
    return api.post(`/reorders/${id}/approve`);
  },

  rejectRecommendation(id, reason) {
    return api.post(`/reorders/${id}/reject`, { reason });
  },

  adjustRecommendation(id, quantity, note = '') {
    return api.post(`/reorders/${id}/adjust`, { quantity, note });
  }
};
