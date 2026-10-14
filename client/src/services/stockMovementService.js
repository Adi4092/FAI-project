import api from './api';
import axios from 'axios';

export const stockMovementService = {
  async getStockMovements(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return api.get('/stock-movements', { params: cleanParams });
  },

  async exportStockMovementsCsv(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    
    const response = await axios.get(`${api.defaults.baseURL}/stock-movements/export`, {
      params: cleanParams,
      withCredentials: true,
      responseType: 'blob',
    });

    // Create a temporary link to download the blob
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stock-movements-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async correctStockMovement(id, reason) {
    return api.post(`/stock-movements/${id}/correct`, { reason });
  },
};
