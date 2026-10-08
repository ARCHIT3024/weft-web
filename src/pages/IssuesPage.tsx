import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchIssues, updateIssueStatus, type IssueListParams } from '../api/issues';
import CategoryIcon from '../components/CategoryIcon';
import SlaIndicator from '../components/SlaIndicator';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { parseApiError, type ApiError } from '../lib/apiError';
import { formatAge, formatCount, formatIsoTitle } from '../lib/format';
import { categoryColorVar, categoryLabel } from '../lib/issueMeta';
import { bySlaUrgency, slaFor } from '../lib/sla';
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  isIssueCategory,
  isIssueStatus,
  type Issue,
  type IssueCategory,
  type IssueStatus,
  type Paginated,
} from '../types/issue';

const PAGE_SIZE = 25;

/** Which moves the server accepts — mirrors `LEGAL_TRANSITIONS` server-side. */
const ALLOWED_NEXT: Record<string, readonly IssueStatus[]> = {
  REPORTED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['IN_PROGRESS'],
  REJECTED: [],
};

/**
 * One table row.
 *
 * `memo` here is a measured choice, not a reflex (React guidance: "use memo for
 * pure components with real render cost, not as a blanket default"). This row is
 * the one component that re-renders on every selection toggle across a 25-row
 * page, and it renders three sub-components; the rest of this page is not
 * memoised.
 */
const IssueRow = memo(function IssueRow({
  issue,
  selected,
  onToggle,
  onOpen,
}: {
  issue: Issue;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const breached = slaFor(issue).state === 'breached';

  return (
    <tr
      className={`border-b border-border last:border-0 odd:bg-surface-secondary/40 hover:bg-teal/5 ${
        breached ? 'bg-danger/6' : ''
      }`}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(issue.id)}
          aria-label={`Select ${issue.issue_number ?? issue.id.slice(0, 8)}`}
          className="size-4 cursor-pointer accent-[var(--color-teal)]"
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => onOpen(issue.id)}
          className="tabular cursor-pointer font-mono text-xs text-teal-dark underline-offset-2 hover:underline"
        >
          {issue.issue_number ?? issue.id.slice(0, 8)}
        </button>
      </td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" style={{ color: `var(${categoryColorVar(issue.category)})` }}>
            <CategoryIcon category={issue.category} decorative />
          </span>
          <span className="whitespace-nowrap">{categoryLabel(issue.category)}</span>
        </span>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={issue.status} />
      </td>
      <td className="px-3 py-2">
        <SlaIndicator issue={issue} variant="dot" />
      </td>
      <td className="tabular px-3 py-2 text-right">{formatCount(issue.upvote_count)}</td>
      <td className="px-3 py-2 whitespace-nowrap" title={formatIsoTitle(issue.created_at)}>
        {formatAge(issue.created_at)}
      </td>
      <td className="max-w-sm truncate px-3 py-2 text-text-secondary">
        {issue.description ?? '—'}
      </td>
    </tr>
  );
});

export default function IssuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<Paginated<Issue> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const statuses = useMemo(
    () => searchParams.getAll('status').filter(isIssueStatus),
    [searchParams],
  );
  const categories = useMemo(
    () => searchParams.getAll('category').filter(isIssueCategory),
    [searchParams],
  );
  const minUpvotes = searchParams.get('min_upvotes') ?? '';
  const slaOnly = searchParams.get('sla') === 'breached';

  const params = useMemo<IssueListParams>(
    () => ({
      page,
      page_size: PAGE_SIZE,
      status: statuses.length > 0 ? statuses : undefined,
      category: categories.length > 0 ? categories : undefined,
      min_upvotes: minUpvotes ? Number(minUpvotes) : undefined,
    }),
    [page, statuses, categories, minUpvotes],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchIssues(params, controller.signal)
      .then(setData)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(parseApiError(caught, 'Could not load issues.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [params, reloadToken]);

  const setFilter = useCallback(
    (key: string, values: string[]) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      values.filter((v) => v !== '').forEach((v) => next.append(key, v));
      next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const toggleFilter = useCallback(
    (key: string, value: string, current: readonly string[]) => {
      setFilter(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    },
    [setFilter],
  );

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openIssue = useCallback((id: string) => navigate(`/issues/${id}`), [navigate]);

  /**
   * SLA filtering happens client-side because the API has no SLA concept — the
   * threshold is derived here (see `lib/sla.ts`). It therefore filters *within
   * the current page*, not across the whole result set, and the UI says so
   * rather than implying a server-side filter.
   */
  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const filtered = slaOnly ? items.filter((i) => slaFor(i).state === 'breached') : items;
    return [...filtered].sort((a, b) => bySlaUrgency(a, b));
  }, [data, slaOnly]);

  const selectedOnPage = rows.filter((r) => selected.has(r.id));

  /** Statuses legal for *every* selected issue — offering more would half-fail. */
  const bulkOptions = useMemo(() => {
    if (selectedOnPage.length === 0) return [];
    return ISSUE_STATUSES.filter((s) =>
      selectedOnPage.every((i) => (ALLOWED_NEXT[i.status ?? ''] ?? []).includes(s)),
    );
  }, [selectedOnPage]);

  const applyBulk = async (status: IssueStatus) => {
    setBulkBusy(true);
    setBulkResult(null);
    const targets = [...selectedOnPage];
    const results = await Promise.allSettled(
      targets.map((i) => updateIssueStatus(i.id, status, 'Bulk update from issue queue')),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setBulkBusy(false);
    setSelected(new Set());
    setReloadToken((n) => n + 1);
    // Report partial failure honestly — "12 updated" when 3 failed is a lie the
    // supervisor would only discover later, from the wrong list.
    setBulkResult(
      failed === 0
        ? `${targets.length} issue${targets.length === 1 ? '' : 's'} moved to ${status.replace('_', ' ')}.`
        : `${targets.length - failed} of ${targets.length} updated — ${failed} failed and were left unchanged.`,
    );
  };

  const activeFilters = statuses.length + categories.length + (minUpvotes ? 1 : 0) + (slaOnly ? 1 : 0);
  const breachedOnPage = (data?.items ?? []).filter((i) => slaFor(i).state === 'breached').length;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Issue queue</h1>
          <p className="text-sm text-text-secondary">
            Sorted by urgency — breached SLA first, then oldest.
          </p>
        </div>
        {data !== null && (
          <p className="tabular text-sm text-text-secondary" aria-live="polite">
            {formatCount(data.total)} matching
            {breachedOnPage > 0 && (
              <span className="ml-2 font-semibold text-danger-dark">
                · {breachedOnPage} breached on this page
              </span>
            )}
          </p>
        )}
      </header>

      <section
        aria-label="Filters"
        className="mb-4 rounded-card border border-border bg-surface p-3"
      >
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold tracking-wider text-text-secondary uppercase">
              Status
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ISSUE_STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statuses.includes(value)}
                  onClick={() => toggleFilter('status', value, statuses)}
                  className={`cursor-pointer rounded-badge border px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${
                    statuses.includes(value)
                      ? 'border-teal bg-teal text-white'
                      : 'border-border bg-surface text-text-secondary hover:border-teal'
                  }`}
                >
                  {value.replace('_', ' ')}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold tracking-wider text-text-secondary uppercase">
              Category
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ISSUE_CATEGORIES.map((value: IssueCategory) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={categories.includes(value)}
                  onClick={() => toggleFilter('category', value, categories)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-badge border px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${
                    categories.includes(value)
                      ? 'border-teal bg-teal text-white'
                      : 'border-border bg-surface text-text-secondary hover:border-teal'
                  }`}
                >
                  <CategoryIcon category={value} className="size-3.5" decorative />
                  {categoryLabel(value)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="min_upvotes"
                className="mb-1.5 block text-xs font-bold tracking-wider text-text-secondary uppercase"
              >
                Min upvotes
              </label>
              <input
                id="min_upvotes"
                type="number"
                min={0}
                value={minUpvotes}
                onChange={(e) => setFilter('min_upvotes', [e.target.value])}
                className="tabular w-24 rounded-button border border-border px-2 py-1 text-sm"
              />
            </div>
            <button
              type="button"
              aria-pressed={slaOnly}
              onClick={() => setFilter('sla', slaOnly ? [] : ['breached'])}
              title="Filters within the loaded page only — the API has no SLA field yet."
              className={`cursor-pointer rounded-badge border px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                slaOnly
                  ? 'border-danger bg-danger text-white'
                  : 'border-border text-text-secondary hover:border-danger'
              }`}
            >
              ▲ Breached only
            </button>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                className="cursor-pointer px-1 py-1.5 text-sm text-teal-dark underline underline-offset-2"
              >
                Clear {activeFilters}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Bulk action bar — appears only with a selection, so it never competes
          with the table for attention when unused. */}
      {selectedOnPage.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-teal bg-teal/8 px-3 py-2">
          <span className="text-sm font-semibold">
            {selectedOnPage.length} selected
          </span>
          {bulkOptions.length > 0 ? (
            <>
              <span className="text-sm text-text-secondary">Move to:</span>
              {bulkOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void applyBulk(s)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-button bg-teal px-2.5 py-1 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                >
                  {bulkBusy && <Spinner />}
                  {s.replace('_', ' ')}
                </button>
              ))}
            </>
          ) : (
            <span className="text-sm text-text-secondary">
              No status is legal for every selected issue — narrow the selection.
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto cursor-pointer text-sm text-teal-dark underline underline-offset-2"
          >
            Clear selection
          </button>
        </div>
      )}

      {bulkResult !== null && (
        <div
          role="status"
          className="mb-3 rounded-button border border-border bg-surface px-3 py-2 text-sm"
        >
          {bulkResult}
        </div>
      )}

      {loading && <LoadingState label="Loading issues…" />}
      {!loading && error !== null && (
        <ErrorState error={error} onRetry={() => setReloadToken((n) => n + 1)} />
      )}

      {!loading && error === null && rows.length === 0 && (
        <EmptyState title="No issues match these filters">
          {activeFilters > 0
            ? 'Try clearing a filter — the SLA filter only applies to the loaded page.'
            : 'Reports submitted from the mobile app appear here.'}
        </EmptyState>
      )}

      {!loading && error === null && rows.length > 0 && (
        <>
          {/* Wide tables scroll inside their own container, never the page
              (UX guideline `Responsive / Table Handling`). */}
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <caption className="sr-only">
                Reported civic issues, sorted with SLA breaches first. Use the checkbox in each row
                to select issues for a bulk status change.
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left">
                  <th scope="col" className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all issues on this page"
                      checked={selectedOnPage.length === rows.length && rows.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                      className="size-4 cursor-pointer accent-[var(--color-teal)]"
                    />
                  </th>
                  {['Reference', 'Category', 'Status', 'SLA', 'Upvotes', 'Age', 'Description'].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-3 py-2 text-xs font-bold tracking-wider text-text-secondary uppercase ${
                          h === 'Upvotes' ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    selected={selected.has(issue.id)}
                    onToggle={toggleRow}
                    onOpen={openIssue}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {data !== null && (
            <nav aria-label="Pagination" className="mt-3 flex items-center justify-between">
              <p className="tabular text-sm text-text-secondary">
                Page {data.page} of {data.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const n = new URLSearchParams(searchParams);
                    n.set('page', String(page - 1));
                    setSearchParams(n);
                  }}
                  disabled={page <= 1}
                  className="cursor-pointer rounded-button border border-border px-3 py-1.5 text-sm hover:border-teal disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const n = new URLSearchParams(searchParams);
                    n.set('page', String(page + 1));
                    setSearchParams(n);
                  }}
                  disabled={page >= data.total_pages}
                  className="cursor-pointer rounded-button border border-border px-3 py-1.5 text-sm hover:border-teal disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
