/**
 * Issue domain types.
 *
 * A deliberate choice runs through this file: `status` and `category` are typed
 * as `string`, not as the closed unions below. The unions drive the filter
 * controls — those must offer a fixed, known set — but a value arriving from
 * the API is only ever *displayed*, and typing it closed would mean either
 * discarding an unrecognised value (losing information the user needs) or
 * lying to the type checker. `statusMeta()` and `categoryLabel()` in
 * `src/lib/issueMeta.ts` both degrade to a readable neutral rendering, so a
 * status the backend adds next week shows up as itself rather than as a hole.
 */

/** Statuses the dashboard can filter by and transition to. */
export const ISSUE_STATUSES = ['REPORTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Statuses an authority user may move an issue *into* from this dashboard. */
export const ASSIGNABLE_STATUSES: readonly IssueStatus[] = [
  'REPORTED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
];

/** Categories issues are routed by. */
export const ISSUE_CATEGORIES = [
  'POTHOLE',
  'GARBAGE_ACCUMULATION',
  'WATER_LOGGING',
  'BROKEN_STREET_LIGHT',
  'DAMAGED_FOOTPATH',
  'SEWAGE_OVERFLOW',
  'OTHER',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const isIssueStatus = (value: string): value is IssueStatus =>
  (ISSUE_STATUSES as readonly string[]).includes(value);

export const isIssueCategory = (value: string): value is IssueCategory =>
  (ISSUE_CATEGORIES as readonly string[]).includes(value);

/** A photo attached to an issue — the citizen's report shot, or resolution proof. */
export interface IssueImage {
  id: string;
  cdn_url: string | null;
  /** `REPORT` or `RESOLUTION_PROOF`; other values are rendered verbatim. */
  image_type: string | null;
  created_at: string | null;
}

/** One transition in an issue's audit trail. */
export interface IssueStatusHistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string | null;
  changed_by_id: string | null;
  note: string | null;
  created_at: string | null;
}

/** An issue as it appears in a list response. */
export interface Issue {
  id: string;
  issue_number: string | null;
  category: string | null;
  description: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  upvote_count: number | null;
  zone_id: string | null;
  department_id: string | null;
  assigned_to_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
}

/** An issue as returned by `GET /issues/{id}` — adds photos and the audit trail. */
export interface IssueDetail extends Issue {
  assigned_at: string | null;
  images: IssueImage[];
  status_history: IssueStatusHistoryEntry[];
}

/** `PaginatedResponse[T]` from `app/schemas/common.py`. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
