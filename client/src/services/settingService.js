import api from './api';

export const settingService = {
  getSettings() {
    return api.get('/settings');
  },

  updateSettings(data) {
    return api.put('/settings', data);
  },

  async downloadTemplate(name) {
    const res = await api.get(`/settings/templates/${name}`, {
      responseType: 'blob'
    });
    const blobData = res?.data || res;
    const url = window.URL.createObjectURL(new Blob([blobData], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${name}-template.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewImport(type, csvData, columnMapping = {}) {
    return api.post('/settings/import/preview', {
      type,
      csvData,
      columnMapping
    });
  },

  commitImport(importId, type, validRows = []) {
    return api.post('/settings/import/commit', {
      importId,
      type,
      validRows
    });
  }
};

export default settingService;
