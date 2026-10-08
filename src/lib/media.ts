/**
 * Resolve a media URL returned by the API into one the browser can fetch.
 *
 * The API returns image paths root-relative — `/media/issues/<id>/<uuid>.jpg`.
 * A browser resolves that against the *page* origin, which in development is
 * the Vite dev server on :5173, where nothing is mounted. The bytes are served
 * by the API on :8000. Left alone, every report photo renders as a broken
 * image, and the only symptom is a 404 in the network tab.
 *
 * In production the API is expected to return an absolute CloudFront URL, so
 * anything already absolute is passed through untouched — this helper is the
 * seam that lets both work without a second code path.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

/** Origin of the API, with the `/v1` (or any) path segment stripped. */
const apiOrigin = (): string => {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    // A malformed VITE_API_BASE_URL should not take the page down; falling back
    // to the page origin restores the old (broken-image) behaviour rather than
    // throwing during render.
    return window.location.origin;
  }
};

export const mediaUrl = (url: string | null): string | null => {
  if (url === null || url === '') return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${apiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
};
