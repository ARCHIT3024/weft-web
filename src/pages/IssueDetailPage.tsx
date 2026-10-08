import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assignIssue, fetchIssue, updateIssueStatus } from '../api/issues';
import { ErrorState, LoadingState, Spinner } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { parseApiError, type ApiError } from '../lib/apiError';
import { formatCoordinates, formatCount, formatDateTime, shortId } from '../lib/format';
import { categoryLabel, statusMeta } from '../lib/issueMeta';
import { mediaUrl } from '../lib/media';
import { ISSUE_STATUSES, type IssueDetail, type IssueStatus } from '../types/issue';

/**
 * Which moves the server will accept from a given status.
 *
 * Mirrors `LEGAL_TRANSITIONS` in `app/services/issue_service.py`. Duplicated
 * deliberately, and only to decide what to *offer*: the server is the authority
 * and rejects an illegal move with `INVALID_STATUS_TRANSITION` regardless. The
 * point is not to enforce anything here, it is to avoid presenting an operator
 * with a button whose only outcome is an error.
 *
 * If the two drift, the symptom is a disabled-looking UI or a surprising 400 —
 * not a data-integrity problem.
 */
const ALLOWED_NEXT: Record<string, readonly IssueStatus[]> = {
  REPORTED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['IN_PROGRESS'],
  REJECTED: [],
};

export default function IssueDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchIssue(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result === null) {
          // 200 with a body this client cannot read — a contract problem, not a
          // network one, so it gets a synthetic code rather than a fake status.
          setError({
            code: 'MALFORMED_RESPONSE',
            message: 'The server returned an issue record this dashboard could not read.',
            status: null,
            retryAfterSeconds: null,
          });
          return;
        }
        setIssue(result);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(parseApiError(caught, 'Could not load this issue.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, reloadToken]);

  /** Refetch after a write when the endpoint did not return a full record. */
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  const onChangeStatus = async (next: IssueStatus) => {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const updated = await updateIssueStatus(id, next, note);
      if (updated !== null) setIssue(updated);
      else refresh();
      setNote('');
      setActionNotice(`Status changed to ${statusMeta(next).label}.`);
    } catch (caught) {
      setActionError(parseApiError(caught, 'Could not change the status.').message);
    } finally {
      setBusy(false);
    }
  };

  const onAssign = async () => {
    if (assignee.trim() === '') return;
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const updated = await assignIssue(id, assignee);
      if (updated !== null) setIssue(updated);
      else refresh();
      setAssignee('');
      setActionNotice('Issue assigned.');
    } catch (caught) {
      setActionError(parseApiError(caught, 'Could not assign the issue.').message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading issue…" />;
  if (error !== null) return <ErrorState error={error} onRetry={refresh} />;
  if (issue === null) {
    return (
      <ErrorState
        error={{ code: 'NOT_FOUND', message: 'Issue not found.', status: 404, retryAfterSeconds: null }}
      />
    );
  }

  const nextStates = ALLOWED_NEXT[issue.status ?? ''] ?? [];

  return (
    <div className="pb-12">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          to="/issues"
          className="text-sm text-teal-dark underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          ← Back to issues
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold text-navy">
            {issue.issue_number ?? shortId(issue.id)}
          </h1>
          <p className="mt-1 text-text-secondary">{categoryLabel(issue.category)}</p>
        </div>
        <StatusBadge status={issue.status} size="md" />
      </header>

      {/* Announced on change so the outcome is not visual-only. */}
      {actionNotice !== null && (
        <div
          role="status"
          className="mb-4 rounded-button border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success-dark"
        >
          {actionNotice}
        </div>
      )}
      {actionError !== null && (
        <div
          role="alert"
          className="mb-4 rounded-button border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger-dark"
        >
          {actionError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">
              Report
            </h2>
            <p className="mb-4 whitespace-pre-wrap text-text-primary">
              {issue.description ?? 'No description was provided.'}
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-text-secondary">Location</dt>
                <dd className="font-mono">{formatCoordinates(issue.latitude, issue.longitude)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Address</dt>
                <dd>{issue.address_text ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Reported</dt>
                <dd>{formatDateTime(issue.created_at)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Upvotes</dt>
                <dd className="tabular-nums">{formatCount(issue.upvote_count)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Assigned to</dt>
                <dd className="font-mono">{shortId(issue.assigned_to_id)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Resolved</dt>
                <dd>{issue.resolved_at !== null ? formatDateTime(issue.resolved_at) : '—'}</dd>
              </div>
            </dl>
          </section>

          {issue.images.length > 0 && (
            <section className="rounded-card border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">
                Photos
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {issue.images.filter((image) => image.cdn_url !== null).map((image) => (
                  <a
                    key={image.id}
                    href={mediaUrl(image.cdn_url) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-button border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <img
                      src={mediaUrl(image.cdn_url) as string}
                      alt={`${categoryLabel(issue.category)} report photo`}
                      loading="lazy"
                      className="aspect-4/3 w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">
              History
            </h2>
            {issue.status_history.length === 0 ? (
              <p className="text-sm text-text-secondary">No transitions recorded.</p>
            ) : (
              <ol className="space-y-3">
                {issue.status_history.map((entry) => (
                  <li key={entry.id} className="flex gap-3 border-l-2 border-border pl-4">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <StatusBadge status={entry.new_status} />
                        {entry.previous_status !== null && (
                          <span className="ml-2 text-text-secondary">
                            from {statusMeta(entry.previous_status).label}
                          </span>
                        )}
                      </p>
                      {entry.note !== null && (
                        <p className="mt-1 text-sm text-text-secondary">{entry.note}</p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        {formatDateTime(entry.created_at)}
                        {entry.changed_by_id !== null && ` · ${shortId(entry.changed_by_id)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">
              Change status
            </h2>

            {nextStates.length === 0 ? (
              <p className="text-sm text-text-secondary">
                {statusMeta(issue.status).label} is a final state. Reopening a rejected report is an
                administrative correction, not a triage action.
              </p>
            ) : (
              <>
                <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
                  Note <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <textarea
                  id="note"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                  placeholder="What changed, and why"
                  className="mb-3 w-full rounded-button border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal disabled:opacity-60"
                />
                <div className="flex flex-col gap-2">
                  {nextStates.map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busy}
                      onClick={() => void onChangeStatus(next)}
                      className="flex items-center justify-center gap-2 rounded-button border border-teal bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    >
                      {busy && <Spinner />}
                      Mark {statusMeta(next).label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">
              Assign
            </h2>
            <label htmlFor="assignee" className="mb-1.5 block text-sm font-medium">
              Authority user ID
            </label>
            <input
              id="assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              disabled={busy}
              placeholder="authority_users.id"
              className="mb-1 w-full rounded-button border border-border px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal disabled:opacity-60"
            />
            {/*
              A raw UUID field is not the finished experience. A staff picker
              needs an endpoint that lists authority users by department, which
              is task 1.11 and does not exist yet — so this is honest about
              what it is rather than pretending with a dropdown of nothing.
            */}
            <p className="mb-3 text-xs text-text-muted">
              A searchable staff picker arrives with the admin user directory (task 1.11).
            </p>
            <button
              type="button"
              disabled={busy || assignee.trim() === ''}
              onClick={() => void onAssign()}
              className="flex w-full items-center justify-center gap-2 rounded-button border border-border px-3 py-2 text-sm font-medium hover:border-teal disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              {busy && <Spinner />}
              Assign
            </button>
          </section>
        </aside>
      </div>

      <p className="sr-only">
        Statuses available from {statusMeta(issue.status).label}:{' '}
        {nextStates.length > 0 ? nextStates.join(', ') : 'none'}. All statuses:{' '}
        {ISSUE_STATUSES.join(', ')}.
      </p>
    </div>
  );
}
