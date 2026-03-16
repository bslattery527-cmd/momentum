import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { saveRefreshToken, getRefreshToken } from '@/lib/auth';
import { router } from 'expo-router';
import { isDemoMode, handleDemoRequest } from '@/lib/demoApi';
import { getApiBaseUrl } from '@/lib/config';

const BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Demo mode short-circuit + Bearer Token ────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // In demo mode, swap in a custom adapter that returns fixture data
    // instead of making a real HTTP request. The response interceptor
    // will still run, correctly unwrapping the envelope.
    if (isDemoMode()) {
      const method = (config.method || 'GET').toUpperCase();

      // Build the URL path (strip baseURL prefix if present)
      let url = config.url || '';
      if (config.baseURL && url.startsWith(config.baseURL)) {
        url = url.slice(config.baseURL.length);
      }

      // Append query params if present
      if (config.params) {
        const qs = new URLSearchParams(config.params).toString();
        if (qs) url = `${url}?${qs}`;
      }

      const result = handleDemoRequest(method, url, config.data);

      if (result) {
        // Override the adapter to return our mock data directly
        config.adapter = () =>
          Promise.resolve({
            data: result.responseData,
            status: result.status,
            statusText: 'OK',
            headers: {},
            config,
          });
      }
    }

    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Extract data envelope + handle 401 ──────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => {
    // Unwrap the { data: {...} } response envelope from the API.
    // Only unwrap if the response has a `data` key but NO `meta` key.
    // Paginated responses have { data: [...], meta: {...} } and must NOT be unwrapped
    // so that callers can access both the items and pagination metadata.
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      !('meta' in response.data)
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If not a 401 or already retried, reject immediately
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      // Call refresh endpoint directly (bypass interceptors to avoid loop)
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token } = response.data.data;

      // Update tokens
      useAuthStore.getState().setToken(access_token);
      await saveRefreshToken(refresh_token);

      // Retry the original request with new token
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
      }

      processQueue(null, access_token);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh failed — clear auth and redirect to welcome
      await useAuthStore.getState().logout();
      router.replace('/(auth)/welcome');

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
