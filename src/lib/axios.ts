import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

/**
 * Axios instance configured for the Weft API.
 *
 * Features:
 * - Base URL from environment variable
 * - JWT Authorization header injection, read from the in-memory auth store
 * - 401 → single serialised token refresh → retry the original request
 * - Request/response error handling
 *
 * Tokens are never read from or written to `localStorage`/`sessionStorage`;
 * the Zustand store in `src/stores/authStore.ts` is the only holder, and it
 * keeps them in memory. See that file for the rationale.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Endpoints that must never trigger the refresh-and-retry flow.
 *
 * A 401 from `/auth/login` means "wrong password", not "expired token", and
 * `/auth/refresh` and `/auth/logout` failing with a 401 means the session is
 * simply over. Attempting a refresh for any of these would either bounce the
 * user off the login page mid-typing or recurse.
 */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/oauth', '/auth/refresh', '/auth/logout'];

const isAuthEndpoint = (url: string | undefined): boolean =>
  url !== undefined && AUTH_PATHS.some((path) => url.includes(path));

// ── Request Interceptor ──────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ── Response Interceptor ─────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || token === null) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

const redirectToLogin = (): void => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

/**
 * Exchange the in-memory refresh token for a new token pair.
 *
 * Deliberately uses the bare `axios` module, not `apiClient`: the refresh call
 * therefore carries none of this file's interceptors and a 401 on refresh
 * cannot recurse back into the handler below.
 */
const requestNewTokens = async (): Promise<TokenResponse> => {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });

  if (!data?.access_token) {
    throw new Error('Refresh response did not contain an access token');
  }
  return data;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      originalRequest !== undefined &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (shouldAttemptRefresh) {
      // A refresh is already in flight: park this request and replay it with
      // the token that refresh produces, rather than starting a second one.
      if (isRefreshing) {
        originalRequest._retry = true;
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const tokens = await requestNewTokens();
        useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

        processQueue(null, tokens.access_token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * End the session: revoke the refresh token server-side, then drop all
 * in-memory auth state.
 *
 * The refresh token is sent in the JSON body because the access token's `jti`
 * identifies the access token, not the refresh token, so the token to revoke
 * must be named explicitly. A network or server failure is still treated as a
 * successful local logout — the user must never be left apparently signed in.
 */
export const logout = async (): Promise<void> => {
  const { refreshToken } = useAuthStore.getState();
  try {
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refresh_token: refreshToken });
    }
  } catch {
    // Ignored on purpose: local state is cleared either way.
  } finally {
    useAuthStore.getState().clearAuth();
  }
};

export default apiClient;
