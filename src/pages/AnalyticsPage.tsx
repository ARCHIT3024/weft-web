import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchIssues } from '../api/issues';

import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { parseApiError, type ApiError } from '../lib/apiError';
import { formatCount } from '../lib/format';
import { categoryColorVar, categoryLabel } from '../lib/issueMeta';
import { DEFAULT_SLA_HOURS, slaFor } from '../lib/sla';
import { ISSUE_CATEGORIES, type Issue } from '../types/issue';

/**
 * Analytics computed from real issue data.
 *
 * **Why this does not call `/analytics/*`.** Those endpoints are still Phase 0
 * mocks returning fixed placeholder numbers. A chart drawn from them would look
 * like municipal performance data and be fiction — worse than an empty page for
 * a screen someone might put in front of a commissioner. Every number here is
 * derived from `GET /issues`, which is real.
 *
 * **The honest limitation:** the client pages through at most `MAX_PAGES × 100`
 * issues, so on a large dataset these are statistics over the most recent N
 * reports, not the whole corpus. That is stated on the page rather than hidden,
 * and it is why "Export CSV" exports exactly the rows the charts were computed
 * from — the export and the chart can never disagree.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

interface Analysis {
  issues: Issue[];
  truncated: boolean;
  total: number;
}

const fetchAll = async (signal: AbortSignal): Promise<Analysis> => {
  const collected: Issue[] = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;

  while (page <= Math.min(totalPages, MAX_PAGES)) {
    const result = await fetchIssues({ page, page_size: PAGE_SIZE }, signal);
    collected.push(...result.items);
    totalPages = result.total_pages;
    total = result.total;
    page += 1;
  }

  return { issues: collected, truncated: totalPages > MAX_PAGES, total };
};

/** Whole days between two ISO timestamps, or null if either is unusable. */
const hoursBetween = (from: string | null, to: string | null): number | null => {
  if (from === null || to === null) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return (b - a) / 36e5;
};

const toCsv = (issues: Issue[]): string => {
  const headers = [
    'issue_number',
    'id',
    'category',
    'status',
    'latitude',
    'longitude',
    'address_text',
    'upvote_count',
    'created_at',
    'resolved_at',
    'resolution_hours',
    'sla_state',
    'description',
  ];
  // Quote every field and double internal quotes: descriptions are free text
  // from the public and will contain commas, quotes and newlines.
  const escape = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const rows = issues.map((i) => {
    const hours = hoursBetween(i.created_at, i.resolved_at);
    return [
      i.issue_number,
      i.id,
      i.category,
      i.status,
      i.latitude,
      i.longitude,
      i.address_text,
      i.upvote_count,
      i.created_at,
      i.resolved_at,
      hours === null ? '' : hours.toFixed(1),
      slaFor(i).state,
      i.description,
    ]
      .map(escape)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

function KpiCard({
  label,
  value,
  accent = 'navy',
  hint,
}: {
  label: string;
  value: string;
  accent?: 'navy' | 'teal' | 'orange' | 'success' | 'danger';
  hint?: string;
}) {
  const ring: Record<string, string> = {
    navy: 'border-border',
    teal: 'border-teal/40 bg-teal/6',
    orange: 'border-orange/40 bg-orange/6',
    success: 'border-success/40 bg-success/6',
    danger: 'border-danger/40 bg-danger/8',
  };
  return (
    <div className={`rounded-card border px-3 py-2.5 ${ring[accent]}`}>
      <p className="text-xs font-bold tracking-wider text-text-secondary uppercase">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint !== undefined && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAll(controller.signal)
      .then(setData)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(parseApiError(caught, 'Could not load analytics.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken]);

  const issues = useMemo(() => data?.issues ?? [], [data]);

  const kpis = useMemo(() => {
    const by = (s: string) => issues.filter((i) => i.status === s).length;
    const resolutionHours = issues
      .map((i) => hoursBetween(i.created_at, i.resolved_at))
      .filter((h): h is number => h !== null);
    const avg =
      resolutionHours.length > 0
        ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
        : null;

    return {
      total: issues.length,
      reported: by('REPORTED'),
      inProgress: by('IN_PROGRESS'),
      resolved: by('RESOLVED'),
      rejected: by('REJECTED'),
      avgResolutionHours: avg,
      resolvedSample: resolutionHours.length,
      breached: issues.filter((i) => slaFor(i).state === 'breached').length,
    };
  }, [issues]);

  /** Horizontal bar — the spec's chosen form for category breakdown. */
  const byCategory = useMemo(
    () =>
      ISSUE_CATEGORIES.map((category) => ({
        category,
        label: categoryLabel(category),
        count: issues.filter((i) => i.category === category).length,
      })).filter((row) => row.count > 0),
    [issues],
  );

  /** Reports per day — a line needs a time axis and ≥4 points to be worth drawing. */
  const trend = useMemo(() => {
    const perDay = new Map<string, { day: string; reported: number; resolved: number }>();
    for (const issue of issues) {
      if (issue.created_at === null) continue;
      const day = issue.created_at.slice(0, 10);
      const row = perDay.get(day) ?? { day, reported: 0, resolved: 0 };
      row.reported += 1;
      if (issue.status === 'RESOLVED') row.resolved += 1;
      perDay.set(day, row);
    }
    return [...perDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [issues]);

  const downloadCsv = () => {
    const blob = new Blob([toCsv(issues)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weft-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState label="Computing analytics…" />;
  if (error !== null) return <ErrorState error={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (issues.length === 0) {
    return (
      <EmptyState title="No data to analyse yet">
        Metrics are computed from submitted reports. Once issues arrive, this page fills in.
      </EmptyState>
    );
  }

  return (
    <div className="pb-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Computed from {formatCount(issues.length)} report
            {issues.length === 1 ? '' : 's'}
            {data?.truncated === true && ` of ${formatCount(data.total)} total`}.
          </p>
        </div>
        {/* Secondary buttons — "accessible but not dominant", per the spec. */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="cursor-pointer rounded-button border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors duration-200 hover:border-teal"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled
            title="PDF export renders server-side (task 4.18) and is not built yet."
            className="cursor-not-allowed rounded-button border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted opacity-60"
          >
            Export PDF
          </button>
        </div>
      </header>

      {data?.truncated === true && (
        <p className="mb-4 rounded-button border border-orange/40 bg-orange/8 px-3 py-2 text-sm text-orange-dark">
          Showing the most recent {formatCount(issues.length)} of {formatCount(data.total)} reports.
          These figures describe that sample, not the full dataset — server-side aggregation arrives
          with the analytics endpoints (task 1.29).
        </p>
      )}

      <section aria-label="Key metrics" className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <KpiCard label="Total" value={formatCount(kpis.total)} />
        <KpiCard label="Reported" value={formatCount(kpis.reported)} accent="orange" />
        <KpiCard label="In progress" value={formatCount(kpis.inProgress)} accent="teal" />
        <KpiCard label="Resolved" value={formatCount(kpis.resolved)} accent="success" />
        <KpiCard
          label="Avg resolution"
          value={kpis.avgResolutionHours === null ? '—' : `${kpis.avgResolutionHours.toFixed(1)}h`}
          hint={
            kpis.resolvedSample === 0
              ? 'No resolved issues yet'
              : `over ${kpis.resolvedSample} resolved`
          }
        />
        <KpiCard
          label="SLA breached"
          value={formatCount(kpis.breached)}
          accent={kpis.breached > 0 ? 'danger' : 'navy'}
          hint={`vs ${DEFAULT_SLA_HOURS}h default`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-bold text-navy">Reports by category</h2>
          <p className="mb-3 text-xs text-text-secondary">
            Horizontal bars, ordered as submitted. Each bar is directly labelled — category is never
            encoded by colour alone.
          </p>
          <div className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={Math.max(180, byCategory.length * 38)}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip cursor={{ fill: 'rgba(14,165,160,0.08)' }} />
                <Bar dataKey="count" name="Reports" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12 }}>
                  {byCategory.map((row) => (
                    <Cell
                      key={row.category}
                      fill={`var(${categoryColorVar(row.category)})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-bold text-navy">Reports over time</h2>
          {/* A line chart needs a real time axis and ≥4 points; below that a
              stat card is the honest form (chart guidance: "fewer than 4 data
              points — use stat card"). */}
          {trend.length < 4 ? (
            <div className="flex h-[220px] flex-col items-center justify-center text-center">
              <p className="tabular text-3xl font-bold text-navy">{formatCount(issues.length)}</p>
              <p className="mt-1 text-sm text-text-secondary">
                reports across {trend.length} day{trend.length === 1 ? '' : 's'}
              </p>
              <p className="mt-2 max-w-xs text-xs text-text-muted">
                A trend line needs at least four days of data to mean anything. Until then this
                stays a single figure rather than a line implying a pattern.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-text-secondary">
                Solid line: reported. Dashed: resolved. Series are distinguished by line style as
                well as colour.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="reported"
                    name="Reported"
                    stroke="#0EA5A0"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </section>
      </div>

      {/* Charts are not readable by a screen reader; the same figures as a table. */}
      <section className="mt-4 rounded-card border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold text-navy">Category breakdown (table)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <caption className="sr-only">
              The same figures as the category chart, in table form.
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-1.5 text-xs font-bold tracking-wider text-text-secondary uppercase">
                  Category
                </th>
                <th scope="col" className="py-1.5 text-right text-xs font-bold tracking-wider text-text-secondary uppercase">
                  Reports
                </th>
                <th scope="col" className="py-1.5 text-right text-xs font-bold tracking-wider text-text-secondary uppercase">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((row) => (
                <tr key={row.category} className="border-b border-border last:border-0">
                  <td className="py-1.5">{row.label}</td>
                  <td className="tabular py-1.5 text-right">{formatCount(row.count)}</td>
                  <td className="tabular py-1.5 text-right text-text-secondary">
                    {((row.count / issues.length) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
