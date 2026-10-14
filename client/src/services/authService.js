import api, { setInMemoryCsrf } from './api';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response?.data?.csrfToken) {
      setInMemoryCsrf(response.data.csrfToken);
    }
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    return { success: true };
  },

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.data?.user || null;
    } catch {
      return null;
    }
  },

  async getCsrfToken() {
    try {
      const response = await api.get('/auth/csrf');
      const token = response.data?.csrfToken;
      if (token) {
        setInMemoryCsrf(token);
      }
      return token;
    } catch {
      return null;
    }
  },
};
