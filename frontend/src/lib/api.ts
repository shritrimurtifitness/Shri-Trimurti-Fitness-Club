import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
});

// Request interceptor to attach the JWT token
api.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      if (!config.headers) {
        config.headers = {};
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for basic error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on unauthorized access if needed
      // localStorage.removeItem('adminToken');
      // Uncomment the line below to auto-redirect
      // window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
