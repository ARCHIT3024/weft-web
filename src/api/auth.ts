import apiClient from '../lib/axios';
import { isRecord, readNumber, readString } from '../lib/parse';
import type { User } from '../stores/authStore';

/**
 * Authentication endpoints.
 *
 * Logout is deliberately *not* here: `logout()` already lives in
 * `src/lib/axios.ts`, next to the interceptors that own the token lifecycle,
 * and duplicating it would create a second place where session teardown could
 * drift.
 */

/** A successfully authenticated session, ready to hand to the auth store. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const ROLES = ['CITIZEN', 'AUTHORITY', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

const isRole = (value: string | null): value is Role =>
  value !== null && (ROLES as readonly string[]).includes(value);

/**
 * Raised when `POST /auth/login` returns 200 with a body this client cannot
 * use. Distinct from an `ApiError` because there is nothing the operator can do
 * about it and no server-supplied message to show — the UI says so plainly
 * rather than reporting it as a credential problem.
 */
export class MalformedAuthResponseError extends Error {
  constructor(detail: string) {
    super(`The sign-in response was not in the expected format (${detail}).`);
    this.name = 'MalformedAuthResponseError';
  }
}

const normaliseUser = (raw: unknown): User => {
  if (!isRecord(raw)) throw new MalformedAuthResponseError('no user object');

  const id = readString(raw, 'id');
  const email = readString(raw, 'email');
  const role = readString(raw, 'role');

  if (!id) throw new MalformedAuthResponseError('user has no id');
  if (!isRole(role)) throw new MalformedAuthResponseError('user has no recognised role');

  return {
    id,
    email: email ?? '',
    // Falling back to the email keeps the header from rendering an empty name.
    name: readString(raw, 'name') ?? email ?? 'Unnamed user',
    role,
    trust_score: readNumber(raw, 'trust_score') ?? undefined,
    total_points: readNumber(raw, 'total_points') ?? undefined,
    title: readString(raw, 'title') ?? undefined,
  };
};

/**
 * Exchange credentials for a token pair and the caller's profile.
 *
 * Rate limited server-side to 5 attempts per minute per IP (TRD §6), which
 * surfaces as a 429 with `RATE_LIMIT_EXCEEDED` and a `retry_after_seconds`
 * detail — see `parseApiError` and the login form's handling of it.
 */
export const login = async (
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<LoginResult> => {
  const { data } = await apiClient.post<unknown>(
    '/auth/login',
    { email: email.trim(), password },
    { signal },
  );

  if (!isRecord(data)) throw new MalformedAuthResponseError('response was not an object');

  const accessToken = readString(data, 'access_token');
  const refreshToken = readString(data, 'refresh_token');
  if (!accessToken) throw new MalformedAuthResponseError('no access token');
  if (!refreshToken) throw new MalformedAuthResponseError('no refresh token');

  return { accessToken, refreshToken, user: normaliseUser(data.user) };
};
