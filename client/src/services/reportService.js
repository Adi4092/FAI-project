import api from './api';

export const reportService = {
  getReport(reportType, params = {}) {
    return api.get(`/reports/${reportType}`, { params });
  },

  async downloadCsv(reportType, params = {}) {
    const res = await api.get(`/reports/${reportType}`, {
      params: { ...params, format: 'csv' },
      responseType: 'blob'
    });
    
    const blobData = res?.data || res;
    // Create download trigger
    const url = window.URL.createObjectURL(new Blob([blobData], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

export default reportService;
