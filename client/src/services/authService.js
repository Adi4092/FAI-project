import api from './api';

export const authService = {
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (err) {
      // In Phase 2 frontend preview mode, if server is not running yet, allow demo login
      if (err.error?.code === 'NETWORK_ERROR') {
        const demoUser = {
          id: 'demo-admin-id',
          name: email.includes('admin') ? 'Admin User' : 'Dr. Sarah Smith',
          email: email,
          role: email.includes('staff') ? 'staff' : (email.includes('manager') ? 'inventory_manager' : 'admin'),
          isActive: true,
          lastLoginAt: new Date().toISOString(),
        };
        localStorage.setItem('medstock_demo_user', JSON.stringify(demoUser));
        return { user: demoUser, isDemoSession: true };
      }
      throw err;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('medstock_demo_user');
    }
    return { success: true };
  },

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.data?.user;
    } catch (err) {
      const stored = localStorage.getItem('medstock_demo_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  async getCsrfToken() {
    try {
      const response = await api.get('/auth/csrf');
      return response.data?.csrfToken;
    } catch {
      return null;
    }
  }
};
