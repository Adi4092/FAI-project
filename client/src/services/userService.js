import api from './api';

export const userService = {
  getUsers(params = {}) {
    return api.get('/users', { params });
  },

  createUser(data) {
    return api.post('/users', data);
  },

  updateUser(id, data) {
    return api.put(`/users/${id}`, data);
  },

  updateUserRole(id, role) {
    return api.patch(`/users/${id}/role`, { role });
  },

  updateUserStatus(id, isActive) {
    return api.patch(`/users/${id}/status`, { isActive });
  },

  resetPassword(id, newPassword) {
    return api.post(`/users/${id}/reset-password`, { newPassword });
  },

  deleteUser(id) {
    return api.delete(`/users/${id}`);
  },

  getAuditLogs(params = {}) {
    return api.get('/audit-logs', { params });
  }
};

export default userService;
