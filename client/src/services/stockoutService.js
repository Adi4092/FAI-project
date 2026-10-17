import api from './api';

export const stockoutService = {
  getStockoutPredictions({ riskLevel = null, q = '', page = 1, limit = 20 } = {}) {
    return api.get('/stockout-predictions', {
      params: { riskLevel, q, page, limit }
    });
  }
};
