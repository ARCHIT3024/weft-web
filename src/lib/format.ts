/**
 * Display formatting. Every function takes the nullable shape the API actually
 * returns and hands back a string that is always safe to drop into JSX.
 */

/** Rendered in place of any value the API did not supply. */
export const EMPTY = '—';

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const parseDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (iso: string | null): string => {
  const date = parseDate(iso);
  return date ? DATE_TIME.format(date) : EMPTY;
};

export const formatDate = (iso: string | null): string => {
  const date = parseDate(iso);
  return date ? DATE_ONLY.format(date) : EMPTY;
};

/** The full timestamp, for a `title`/`aria-label` alongside a relative one. */
export const formatIsoTitle = (iso: string | null): string | undefined => {
  const date = parseDate(iso);
  return date ? date.toISOString() : undefined;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 h ago", "2 d ago" — coarse on purpose; triage cares about age, not seconds. */
export const formatAge = (iso: string | null, now: number = Date.now()): string => {
  const date = parseDate(iso);
  if (!date) return EMPTY;

  const elapsed = now - date.getTime();
  if (elapsed < 0) return 'just now';
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

/**
 * `BROKEN_STREET_LIGHT` → `Broken Street Light`.
 *
 * Used for any SCREAMING_SNAKE_CASE enum member, including ones this build has
 * never heard of, so a new backend category still reads as English.
 */
export const humaniseToken = (token: string): string =>
  token
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Shorten a UUID for dense table cells, keeping it recognisable. */
export const shortId = (id: string | null): string => (id ? `${id.slice(0, 8)}…` : EMPTY);

export const formatCount = (value: number | null): string =>
  value === null ? EMPTY : value.toLocaleString();

/** Coordinates for display; both must be present or the pair is meaningless. */
export const formatCoordinates = (lat: number | null, lng: number | null): string =>
  lat === null || lng === null ? EMPTY : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
