import api from './api';

export const expiryService = {
  getExpiryRisk({ windowDays = 30, medicineId = null, riskLevel = null, page = 1, limit = 20 } = {}) {
    return api.get('/expiry-risk', {
      params: { windowDays, medicineId, riskLevel, page, limit }
    });
  },

  getBatchExpiryRisk(batchId) {
    return api.get(`/expiry-risk/batch/${batchId}`);
  }
};
