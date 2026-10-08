import { isRecord, readNumber, readRecordArray, readString } from '../lib/parse';
import type {
  Issue,
  IssueDetail,
  IssueImage,
  IssueStatusHistoryEntry,
  Paginated,
} from '../types/issue';

/**
 * Wire → domain normalisation for the issues endpoints.
 *
 * `GET /issues` and `GET /issues/{id}` are being implemented while this
 * dashboard is written, and at the time of writing the deployed routes are
 * still the Phase 0 mocks in `app/routers/issues.py`. Everything below is
 * therefore written to *survive* a shape that is close but not identical:
 * unknown fields are ignored, missing fields become `null`, and a malformed
 * item in a list is dropped rather than taking the page down with it.
 *
 * The one field treated as mandatory is `id` — without it the row cannot be
 * linked to, opened, or acted on, so an item lacking one is not a usable issue.
 */

const normaliseImage = (raw: Record<string, unknown>): IssueImage | null => {
  const id = readString(raw, 'id');
  if (!id) return null;
  return {
    id,
    // `cdn_url` per the contract; `url` accepted because the local-disk media
    // stand-in in `app/main.py` may serve a plain path instead.
    cdn_url: readString(raw, 'cdn_url') ?? readString(raw, 'url'),
    image_type: readString(raw, 'image_type'),
    created_at: readString(raw, 'created_at'),
  };
};

const normaliseHistoryEntry = (
  raw: Record<string, unknown>,
  index: number,
): IssueStatusHistoryEntry => ({
  // History entries are rendered as a list and never addressed individually, so
  // a synthetic key is an acceptable substitute for a missing id.
  id: readString(raw, 'id') ?? `history-${index}`,
  previous_status: readString(raw, 'previous_status'),
  new_status: readString(raw, 'new_status'),
  changed_by_id: readString(raw, 'changed_by_id'),
  note: readString(raw, 'note'),
  created_at: readString(raw, 'created_at'),
});

/** Normalise a list-shaped issue. Returns `null` when the payload is unusable. */
export const normaliseIssue = (raw: unknown): Issue | null => {
  if (!isRecord(raw)) return null;

  // `POST /issues` answers with `issue_id`; the read endpoints use `id`.
  const id = readString(raw, 'id') ?? readString(raw, 'issue_id');
  if (!id) return null;

  return {
    id,
    issue_number: readString(raw, 'issue_number'),
    category: readString(raw, 'category'),
    description: readString(raw, 'description'),
    status: readString(raw, 'status'),
    latitude: readNumber(raw, 'latitude'),
    longitude: readNumber(raw, 'longitude'),
    address_text: readString(raw, 'address_text'),
    upvote_count: readNumber(raw, 'upvote_count'),
    zone_id: readString(raw, 'zone_id'),
    department_id: readString(raw, 'department_id'),
    assigned_to_id: readString(raw, 'assigned_to_id'),
    created_at: readString(raw, 'created_at'),
    updated_at: readString(raw, 'updated_at'),
    resolved_at: readString(raw, 'resolved_at'),
  };
};

/** Normalise a detail-shaped issue, including photos and the audit trail. */
export const normaliseIssueDetail = (raw: unknown): IssueDetail | null => {
  const base = normaliseIssue(raw);
  if (!base || !isRecord(raw)) return null;

  const images = readRecordArray(raw, 'images')
    .map(normaliseImage)
    .filter((image): image is IssueImage => image !== null);

  const history = readRecordArray(raw, 'status_history').map(normaliseHistoryEntry);

  return {
    ...base,
    assigned_at: readString(raw, 'assigned_at'),
    images,
    status_history: history,
  };
};

/**
 * Normalise a `PaginatedResponse[Issue]`.
 *
 * The envelope's counters are reconstructed when absent so the pager always has
 * something coherent to render: `total` falls back to the number of items
 * returned, and `total_pages` to at least one.
 */
export const normaliseIssuePage = (
  raw: unknown,
  requestedPage: number,
  requestedPageSize: number,
): Paginated<Issue> => {
  const body = isRecord(raw) ? raw : {};
  const items = readRecordArray(body, 'items')
    .map(normaliseIssue)
    .filter((issue): issue is Issue => issue !== null);

  const total = readNumber(body, 'total') ?? items.length;
  const page = readNumber(body, 'page') ?? requestedPage;
  const pageSize = readNumber(body, 'page_size') ?? requestedPageSize;
  const totalPages = readNumber(body, 'total_pages') ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return { items, total, page, page_size: pageSize, total_pages: Math.max(1, totalPages) };
};
