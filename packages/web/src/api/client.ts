import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Axios instance
//
// Uses relative URLs so Vite's dev proxy forwards /api and /auth requests to
// the Express server on :3001. In production, configure a reverse proxy
// (nginx, Caddy, etc.) to do the same thing.
//
// withCredentials is set globally so the HttpOnly session cookie is sent on
// every request automatically.
// ---------------------------------------------------------------------------
const client = axios.create({
  withCredentials: true,
  timeout: 10_000, // 10 seconds — prevents indefinite hangs on slow/unresponsive servers
});

// ---------------------------------------------------------------------------
// Token refresh state
//
// We need to prevent multiple concurrent refresh attempts. If multiple
// requests fail with 401 at the same time, we want them to all wait for
// the same refresh promise rather than triggering multiple refresh calls.
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

// ---------------------------------------------------------------------------
// Process the failed queue
//
// After a refresh attempt (success or failure), resolve or reject all
// queued requests that were waiting for the refresh.
// ---------------------------------------------------------------------------
function processQueue(error: AxiosError | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
}

// ---------------------------------------------------------------------------
// Response interceptor for automatic token refresh
//
// When a request fails with 401:
// 1. If we're not already refreshing, attempt to refresh the token
// 2. If refresh succeeds, retry the original request
// 3. If refresh fails, redirect to login
//
// Multiple concurrent 401s will all wait for the same refresh promise,
// preventing multiple refresh calls.
// ---------------------------------------------------------------------------
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401 errors
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Don't retry if this is already a retry
    if (originalRequest._retry) {
      // Refresh failed, redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // If this is a refresh request that failed, don't try to refresh again
    if (originalRequest.url === '/auth/refresh') {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => {
        // Retry the original request after refresh completes
        return client(originalRequest);
      });
    }

    // Start refreshing
    isRefreshing = true;
    originalRequest._retry = true;

    try {
      // Attempt to refresh the token
      await client.post('/auth/refresh');

      // Refresh succeeded, process queued requests
      processQueue(null);

      // Retry the original request
      return client(originalRequest);
    } catch (refreshError) {
      // Refresh failed, reject queued requests and redirect to login
      processQueue(refreshError as AxiosError);

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
