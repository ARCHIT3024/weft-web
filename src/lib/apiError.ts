import { isAxiosError } from 'axios';
import { isRecord, readNumber, readString } from './parse';

/**
 * Normalised, renderable form of any failure from the Weft API.
 *
 * The backend's contract (`app/schemas/common.py` → `ErrorResponse`) is a
 * stable `{ error: { code, message, details } }` envelope, emitted by the
 * `WeftException` handler registered in `app/main.py`. Three other shapes still
 * reach the client, and all four are folded into this one type:
 *
 *   1. `{ error: { code, message, details } }` — the contract envelope.
 *   2. `{ detail: { error: { ... } } }` — a `WeftException` raised somewhere the
 *      global handler does not cover, where FastAPI wraps `HTTPException.detail`.
 *   3. `{ detail: "..." }` — a plain `HTTPException` (FastAPI's own 401/404s).
 *   4. `{ detail: [{ loc, msg, ... }] }` — a 422 from Pydantic validation.
 *
 * Anything else — a proxy's HTML error page, a dead connection — falls back to
 * a status-derived message. The user always gets a sentence, never `[object
 * Object]` and never a blank alert box.
 */
export interface ApiError {
  /** Machine-readable code, e.g. `RATE_LIMIT_EXCEEDED`. Synthetic for transport failures. */
  code: string;
  /** Human-readable sentence, safe to render directly. */
  message: string;
  /** HTTP status, or `null` when the request never got a response. */
  status: number | null;
  /** Seconds to wait before retrying — populated for 429 only. */
  retryAfterSeconds: number | null;
}

/** No response at all: DNS failure, connection refused, CORS rejection, offline. */
const NETWORK_ERROR: ApiError = {
  code: 'NETWORK_ERROR',
  message:
    'Could not reach the Weft API. Check that the backend is running and that VITE_API_BASE_URL points at it.',
  status: null,
  retryAfterSeconds: null,
};

const TIMEOUT_ERROR: ApiError = {
  code: 'TIMEOUT',
  message: 'The Weft API did not respond in time. It may be starting up — try again in a moment.',
  status: null,
  retryAfterSeconds: null,
};

/** Last-resort wording when the body carries no usable message. */
const messageForStatus = (status: number, fallback: string): string => {
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'Your account does not have permission to do that.';
  if (status === 404) return 'That record could not be found. It may have been removed.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The Weft API returned a server error. Please try again shortly.';
  return fallback;
};

/** Flatten a Pydantic 422 body into one sentence naming the offending fields. */
const messageFromValidationErrors = (entries: unknown[]): string | null => {
  const parts = entries.filter(isRecord).map((entry) => {
    const msg = readString(entry, 'msg');
    const loc = Array.isArray(entry.loc)
      ? entry.loc.filter((part): part is string => typeof part === 'string').join('.')
      : null;
    if (msg && loc) return `${loc}: ${msg}`;
    return msg ?? loc;
  });

  const usable = parts.filter((part): part is string => part !== null);
  return usable.length > 0 ? usable.join('; ') : null;
};

/** Pull `{ code, message }` out of an `ErrorDetail`-shaped object. */
const readErrorDetail = (
  candidate: unknown,
): { code: string | null; message: string | null; details: Record<string, unknown> } | null => {
  if (!isRecord(candidate)) return null;
  return {
    code: readString(candidate, 'code'),
    message: readString(candidate, 'message'),
    details: isRecord(candidate.details) ? candidate.details : {},
  };
};

/**
 * Convert any thrown value into an {@link ApiError}.
 *
 * @param error    The caught value — an `AxiosError`, an `Error`, or anything.
 * @param fallback Wording for the case where nothing better can be extracted.
 *                 Phrase it in terms of the action that failed, e.g.
 *                 "Could not load issues."
 */
export const parseApiError = (error: unknown, fallback: string): ApiError => {
  if (!isAxiosError(error)) {
    // A bug in our own code, or a rejection from somewhere that is not axios.
    // Surface the message but keep the code distinguishable from an API fault.
    return {
      code: 'CLIENT_ERROR',
      message: error instanceof Error && error.message ? error.message : fallback,
      status: null,
      retryAfterSeconds: null,
    };
  }

  if (!error.response) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? TIMEOUT_ERROR
      : NETWORK_ERROR;
  }

  const status = error.response.status;
  const body: unknown = error.response.data;

  let code: string | null = null;
  let message: string | null = null;
  let details: Record<string, unknown> = {};

  if (isRecord(body)) {
    // Shapes 1 and 2: the contract envelope, bare or wrapped in `detail`.
    const envelope = readErrorDetail(body.error) ?? readErrorDetail(isRecord(body.detail) ? body.detail.error : null);
    if (envelope) {
      code = envelope.code;
      message = envelope.message;
      details = envelope.details;
    } else if (typeof body.detail === 'string') {
      // Shape 3: a plain FastAPI HTTPException.
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      // Shape 4: Pydantic validation errors.
      code = 'VALIDATION_ERROR';
      message = messageFromValidationErrors(body.detail);
    } else {
      // A `WeftException` detail that reached us unwrapped.
      const bare = readErrorDetail(body.detail);
      if (bare) {
        code = bare.code;
        message = bare.message;
        details = bare.details;
      }
    }
  }

  // 429 carries the wait in the body (`RateLimitError` in core/exceptions.py)
  // and, when a proxy sits in front, in the standard header. Prefer the body.
  let retryAfterSeconds: number | null = status === 429 ? readNumber(details, 'retry_after_seconds') : null;
  if (retryAfterSeconds === null && status === 429) {
    const header = error.response.headers['retry-after'];
    if (typeof header === 'string' || typeof header === 'number') {
      const parsed = Number(header);
      retryAfterSeconds = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return {
    code: code ?? `HTTP_${status}`,
    message: message ?? messageForStatus(status, fallback),
    status,
    retryAfterSeconds,
  };
};
