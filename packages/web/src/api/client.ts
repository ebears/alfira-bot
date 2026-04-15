// ---------------------------------------------------------------------------
// Fetch client for API calls
//
// Uses relative URLs. In development, Bun's dev server proxies /api and /auth
// to the API server on :3001. In production, configure a reverse proxy
// (Caddy, etc.) to do the same thing.
//
// credentials: 'include' is set globally so the HttpOnly session cookie is
// sent on every request automatically.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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

function processQueue(error: Error | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
}

function redirectToLogin(): void {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function wrappedFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  const makeRequest = async (): Promise<Response> =>
    fetchWithTimeout(url, { ...options, credentials: 'include' });

  let response = await makeRequest();

  // Handle 401 with token refresh retry
  if (response.status === 401) {
    // Don't retry if this is already a refresh request
    if (url === '/auth/refresh') {
      redirectToLogin();
      throw new Error('Unauthorized');
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => makeRequest());
    }

    // Start refreshing
    isRefreshing = true;

    const ok = await refreshToken();

    if (ok) {
      // Refresh succeeded, process queue and retry
      processQueue(null);
      isRefreshing = false;
      response = await makeRequest();
    } else {
      // Refresh failed, reject queue and redirect
      processQueue(new Error('Token refresh failed'));
      isRefreshing = false;
      redirectToLogin();
      throw new Error('Unauthorized');
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  // 204 No Content has no body to parse
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// API client matching @alfira-bot/server/shared/api interface
// ---------------------------------------------------------------------------
export const client = {
  async get<T>(url: string): Promise<{ data: T }> {
    const data = await wrappedFetch(url);
    return { data: data as T };
  },
  async post<T>(url: string, data?: unknown): Promise<{ data: T }> {
    const body = data !== undefined ? JSON.stringify(data) : undefined;
    const result = await wrappedFetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    });
    return { data: result as T };
  },
  async patch<T>(url: string, data: unknown): Promise<{ data: T }> {
    const result = await wrappedFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { data: result as T };
  },
  async delete<T>(url: string): Promise<{ data: T }> {
    const response = await wrappedFetch(url, { method: 'DELETE' });
    // 204 No Content has no body to parse
    if (response === null) {
      return { data: undefined as T };
    }
    return { data: response as T };
  },
};
