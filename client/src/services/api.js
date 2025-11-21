/**
 * @file api.js
 * @description Axios instance configured for the auction platform API with interceptors
 * that log requests and surface common error states.
 */

import axios from 'axios';
import { toast } from 'react-toastify';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

aioRequestInterceptor(api);
aioResponseInterceptor(api);

/**
 * @function aioRequestInterceptor
 * @description Applies request interceptor to log outgoing requests.
 * @param {import('axios').AxiosInstance} instance - Axios instance.
 * @returns {void}
 */
function aioRequestInterceptor(instance) {
  instance.interceptors.request.use(
    (config) => {
      // Don't log auth check requests to reduce noise
      if (config.url !== '/auth/me') {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => {
      console.error('❌ API request error:', error);
      return Promise.reject(error);
    }
  );
}

/**
 * @function aioResponseInterceptor
 * @description Applies response interceptor to handle common errors.
 * @param {import('axios').AxiosInstance} instance - Axios instance.
 * @returns {void}
 */
function aioResponseInterceptor(instance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (!error.response) {
        toast.error('Network error: Unable to reach the server.');
        return Promise.reject(error);
      }

      const { status } = error.response;
      const { url } = error.config;

      // Don't show toast or redirect for auth check failures
      if (status === 401 && url === '/auth/me') {
        return Promise.reject(error);
      }

      if (status === 401) {
        toast.error('Please log in to continue.');
        window.location.href = '/login';
      } else if (status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      }

      return Promise.reject(error);
    }
  );
}

/**
 * @function fetchItemPrices
 * @description Fetches only price data for multiple items (lightweight endpoint)
 * @param {string[]} itemIds - Array of item IDs
 * @returns {Promise<Object>} Object with prices array
 */
export const fetchItemPrices = async (itemIds) => {
  if (!itemIds || itemIds.length === 0) {
    return { prices: [] };
  }
  const response = await api.get('/items/prices/batch', {
    params: { itemIds: itemIds.join(',') }
  });
  return response.data;
};

export default api;
