import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CITIZEN' | 'AUTHORITY' | 'ADMIN';
  trust_score?: number;
  total_points?: number;
  title?: string;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setUser: (user: User) => void;
}

/**
 * Zustand auth store for the Weft dashboard.
 *
 * Tokens live in memory only. Nothing here is ever written to
 * `localStorage` or `sessionStorage`.
 *
 * Why: the dashboard renders citizen-submitted issue text — free text from an
 * untrusted public source — to AUTHORITY/ADMIN users. That is a stored-XSS
 * path into a privileged UI, and a token in web storage is readable by any
 * injected script. Keeping tokens in a JS closure does not stop an attacker
 * who is already executing in the page, but it does stop the cheap
 * exfiltration of a long-lived credential that outlives the tab.
 *
 * Consequence, and it is intended: a page reload drops the tokens and the
 * user logs in again. This is a local MVP; there is deliberately no session
 * persistence and no silent-refresh-on-load bootstrap.
 *
 * The refresh token is held in memory too, and sent in the JSON body of
 * `POST /v1/auth/refresh` (see `src/lib/axios.ts`), the same way the native
 * clients do it. It is never persisted.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: (accessToken: string, refreshToken: string, user: User) =>
    set({ accessToken, refreshToken, user, isAuthenticated: true }),

  /** Replace both tokens after a successful refresh, keeping the profile. */
  setTokens: (accessToken: string, refreshToken: string) =>
    set({ accessToken, refreshToken, isAuthenticated: true }),

  clearAuth: () =>
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setUser: (user: User) => set({ user }),
}));
