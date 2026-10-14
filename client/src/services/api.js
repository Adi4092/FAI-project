import axios from 'axios';

let inMemoryCsrf = null;

export function setInMemoryCsrf(token) {
  inMemoryCsrf = token;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to retrieve cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Request interceptor: attach CSRF token header for state-changing requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const url = config.url || '';
    // Skip CSRF header for login, refresh, and csrf endpoint itself
    const isAuthBypass = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/csrf');
    
    if (!isAuthBypass) {
      let csrfToken = getCookie('csrf_token') || inMemoryCsrf;
      
      // If no token in cookie or memory, fetch one eagerly
      if (!csrfToken) {
        try {
          const res = await axios.get(`${api.defaults.baseURL}/auth/csrf`, { withCredentials: true });
          if (res.data?.data?.csrfToken) {
            csrfToken = res.data.data.csrfToken;
            inMemoryCsrf = csrfToken;
          }
        } catch {
          // Proceed; backend will respond with 403 CSRF_ERROR if missing
        }
      }

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor: standard envelope handling + automatic refresh on TOKEN_EXPIRED
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 TOKEN_EXPIRED and not already retrying
    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(refreshErr.response?.data || refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }

    return Promise.reject({
      success: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network request failed',
      },
    });
  }
);

export default api;
