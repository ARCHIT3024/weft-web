/**
 * Defensive readers for JSON arriving off the wire.
 *
 * The issues API is being written in parallel with this dashboard, so field
 * names, nullability and even the enum members can move under us. Rather than
 * `as`-casting a response into an interface and discovering the mismatch as a
 * blank screen or a `TypeError` in front of a user, every response is walked
 * through these helpers: an absent or wrongly-typed field becomes `null`, and
 * the UI renders a dash instead of crashing.
 *
 * Nothing here narrows to a domain type — that is the job of the normalisers
 * in `src/api/issueSchema.ts`. These are only the primitive reads.
 */

/** True for plain JSON objects — arrays and `null` are excluded. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read a non-empty string field, or `null`. */
export const readString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

/**
 * Read a finite number field, or `null`.
 *
 * Numeric strings are accepted: PostGIS numerics and large integers are
 * routinely serialised as strings by JSON encoders, and a latitude arriving as
 * `"13.0827"` should still put a pin on the map.
 */
export const readNumber = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key];
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Read an array field as `unknown[]`, or an empty array when absent. */
export const readArray = (source: Record<string, unknown>, key: string): unknown[] => {
  const value = source[key];
  return Array.isArray(value) ? value : [];
};

/** Read an array field and keep only the entries that are JSON objects. */
export const readRecordArray = (
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] => readArray(source, key).filter(isRecord);
