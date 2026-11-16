import api from './api';

export const notificationService = {
  getNotifications(params = {}) {
    return api.get('/notifications', { params });
  },

  markAsRead(id) {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return api.post('/notifications/mark-all-read');
  },

  getUnreadCount() {
    return api.get('/notifications/unread-count');
  }
};

export default notificationService;
