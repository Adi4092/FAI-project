import api from './api';

export const forecastService = {
  generateForecast(medicineId, horizonDays = 15) {
    return api.post('/forecasts/generate', { medicineId, horizonDays });
  },

  getForecasts(medicineId, page = 1, limit = 20) {
    return api.get('/forecasts', { params: { medicineId, page, limit } });
  },

  getForecastById(id) {
    return api.get(`/forecasts/${id}`);
  },

  getUsageHistory(medicineId, from = null, to = null) {
    return api.get(`/forecasts/usage/${medicineId}`, { params: { from, to } });
  },

  refreshUsage() {
    return api.post('/forecasts/refresh-usage');
  },

  getModelInfo() {
    return api.get('/forecasts/model-info');
  },

  getHealth() {
    return api.get('/forecasts/health');
  },

  retrainModel(history = [], versionNote = '') {
    return api.post('/forecasts/retrain', { history, versionNote });
  }
};
