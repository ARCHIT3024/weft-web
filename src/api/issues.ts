import apiClient from '../lib/axios';
import { normaliseIssueDetail, normaliseIssuePage } from './issueSchema';
import type { Issue, IssueCategory, IssueDetail, IssueStatus, Paginated } from '../types/issue';

/**
 * Issue endpoints.
 *
 * Every call goes through the shared `apiClient` so it inherits the bearer
 * header and the 401 → refresh → retry flow in `src/lib/axios.ts`; none of that
 * is reimplemented here. Responses are handed to the normalisers in
 * `issueSchema.ts` rather than cast, because these routes are being written in
 * parallel with this client.
 */

/** Filters accepted by `GET /issues`. Omitted keys are not sent at all. */
export interface IssueListParams {
  page: number;
  page_size: number;
  status?: IssueStatus[];
  category?: IssueCategory[];
  /** Inclusive lower bound on `created_at`, as `YYYY-MM-DD`. */
  from_date?: string;
  /** Inclusive upper bound on `created_at`, as `YYYY-MM-DD`. */
  to_date?: string;
  min_upvotes?: number;
  zone_id?: string;
  sort?: string;
}

/**
 * `status` and `category` repeat rather than being indexed or comma-joined.
 *
 * FastAPI binds a `list[...]` query parameter from repeated keys —
 * `?status=REPORTED&status=IN_PROGRESS`. Axios's default array serialisation
 * emits `status[]=REPORTED`, which FastAPI reads as a differently-named
 * parameter and silently ignores, so the request would come back unfiltered
 * with no error anywhere. `indexes: null` selects the repeated-key form.
 */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

/** Drop empty values so the query string carries only filters actually set. */
const toQuery = (params: IssueListParams): Record<string, string | number | string[]> => {
  const query: Record<string, string | number | string[]> = {
    page: params.page,
    page_size: params.page_size,
  };

  if (params.status && params.status.length > 0) query.status = [...params.status];
  if (params.category && params.category.length > 0) query.category = [...params.category];
  if (params.from_date) query.from_date = params.from_date;
  if (params.to_date) query.to_date = params.to_date;
  if (typeof params.min_upvotes === 'number' && params.min_upvotes > 0) {
    query.min_upvotes = params.min_upvotes;
  }
  if (params.zone_id) query.zone_id = params.zone_id;
  if (params.sort) query.sort = params.sort;

  return query;
};

export const fetchIssues = async (
  params: IssueListParams,
  signal?: AbortSignal,
): Promise<Paginated<Issue>> => {
  const { data } = await apiClient.get<unknown>('/issues', {
    params: toQuery(params),
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return normaliseIssuePage(data, params.page, params.page_size);
};

export const fetchIssue = async (id: string, signal?: AbortSignal): Promise<IssueDetail | null> => {
  const { data } = await apiClient.get<unknown>(`/issues/${encodeURIComponent(id)}`, { signal });
  return normaliseIssueDetail(data);
};

/**
 * `PATCH /issues/{id}/status`.
 *
 * Returns the updated issue when the response carries one. A `null` return is
 * not a failure — it means the endpoint answered with something other than a
 * full issue (a 204, or a thin acknowledgement), and the caller should refetch
 * rather than assume the write did not happen.
 */
export const updateIssueStatus = async (
  id: string,
  status: IssueStatus,
  note?: string,
): Promise<IssueDetail | null> => {
  const trimmedNote = note?.trim();
  const { data } = await apiClient.patch<unknown>(`/issues/${encodeURIComponent(id)}/status`, {
    status,
    ...(trimmedNote ? { note: trimmedNote } : {}),
  });
  return normaliseIssueDetail(data);
};

/**
 * `PATCH /issues/{id}/assign`.
 *
 * The request body is `{ assigned_to_id }`, mirroring the field name the issue
 * record itself uses. The endpoint was still a no-body mock when this was
 * written, so if the implementation lands on a different key the fix is one
 * line here.
 */
export const assignIssue = async (
  id: string,
  assignedToId: string,
): Promise<IssueDetail | null> => {
  const { data } = await apiClient.patch<unknown>(`/issues/${encodeURIComponent(id)}/assign`, {
    assigned_to_id: assignedToId.trim(),
  });
  return normaliseIssueDetail(data);
};
