import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchIssues } from '../api/issues';
import CategoryIcon from '../components/CategoryIcon';
import SlaIndicator from '../components/SlaIndicator';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { parseApiError, type ApiError } from '../lib/apiError';
import { formatAge, formatCount } from '../lib/format';
import { categoryColorVar, categoryLabel, statusMeta } from '../lib/issueMeta';
import { slaFor } from '../lib/sla';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, type Issue } from '../types/issue';

/** Central Bengaluru — the demo zones in `scripts/seed_dev_data.py`. */
const FALLBACK_CENTRE: [number, number] = [12.9716, 77.5946];

/** The API caps `page_size` at 100 (`Query(le=100)`); asking for more is a 422. */
const MAP_PAGE_SIZE = 100;

/**
 * Markers are coloured **by category**, per `03_weft_uiux.jsx`: "individual
 * markers are colour-coded by issue category". Status is carried by the badge in
 * the popup and by the summary cards, so the two dimensions never compete for
 * the same visual channel.
 *
 * A `divIcon` rather than Leaflet's default marker: the default is a bundled PNG
 * referenced by a URL Vite does not rewrite, so it 404s in a production build.
 */
const pinFor = (issue: Issue) =>
  divIcon({
    className: '',
    html:
      `<span class="weft-pin" style="background: var(${categoryColorVar(issue.category)})" ` +
      `title="${categoryLabel(issue.category)}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -9],
  });

export default function DashboardPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showDensity, setShowDensity] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchIssues({ page: 1, page_size: MAP_PAGE_SIZE }, controller.signal)
      .then((page) => setIssues(page.items))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(parseApiError(caught, 'Could not load the map.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken]);

  const all = useMemo(() => issues ?? [], [issues]);

  const mappable = useMemo(
    () =>
      all.filter(
        (i) => i.latitude !== null && i.longitude !== null && !hidden.has(i.category ?? 'OTHER'),
      ),
    [all, hidden],
  );

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const issue of all) {
      const key = issue.status ?? 'UNKNOWN';
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [all]);

  const breached = useMemo(() => all.filter((i) => slaFor(i).state === 'breached').length, [all]);

  const centre = useMemo<[number, number]>(() => {
    if (mappable.length === 0) return FALLBACK_CENTRE;
    const sum = mappable.reduce(
      (acc, i) => ({ lat: acc.lat + (i.latitude ?? 0), lng: acc.lng + (i.longitude ?? 0) }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / mappable.length, sum.lng / mappable.length];
  }, [mappable]);

  const toggleCategory = (category: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Live map</h1>
          <p className="text-sm text-text-secondary">
            {loading ? 'Loading reports…' : `${formatCount(all.length)} most recent reports`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showDensity}
            onClick={() => setShowDensity((v) => !v)}
            title="Overlays translucent circles so clusters read as darker areas"
            className={`cursor-pointer rounded-button border px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
              showDensity
                ? 'border-teal bg-teal text-white'
                : 'border-border bg-surface text-text-secondary hover:border-teal'
            }`}
          >
            Density overlay
          </button>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="cursor-pointer rounded-button border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors duration-200 hover:border-teal"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Zone summary — the spec's "summary card shows zone totals at a glance".
          Placed above the map rather than floating over it: an overlay covers the
          very markers it summarises, and at dashboard widths there is room. */}
      <section
        aria-label="Zone summary"
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {ISSUE_STATUSES.map((status) => (
          <div key={status} className="rounded-card border border-border bg-surface px-3 py-2">
            <p className="text-xs font-bold tracking-wider text-text-secondary uppercase">
              {statusMeta(status).label}
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-navy">
              {loading ? '—' : formatCount(counts[status] ?? 0)}
            </p>
          </div>
        ))}
        <div
          className={`rounded-card border px-3 py-2 ${
            breached > 0 ? 'border-danger bg-danger/8' : 'border-border bg-surface'
          }`}
        >
          <p className="text-xs font-bold tracking-wider text-text-secondary uppercase">
            SLA breached
          </p>
          <p
            className={`tabular mt-0.5 text-2xl font-bold ${
              breached > 0 ? 'text-danger-dark' : 'text-navy'
            }`}
          >
            {loading ? '—' : formatCount(breached)}
          </p>
        </div>
      </section>

      {loading && <LoadingState label="Loading map…" />}
      {!loading && error !== null && (
        <ErrorState error={error} onRetry={() => setReloadToken((n) => n + 1)} />
      )}

      {!loading && error === null && all.length === 0 && (
        <EmptyState title="Nothing to plot yet">
          Reports submitted from the mobile app appear here as pins, coloured by category.
        </EmptyState>
      )}

      {!loading && error === null && all.length > 0 && (
        <>
          {/* The legend doubles as a filter. Each entry carries the glyph as well
              as the colour, so it stays readable without colour vision. */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-bold tracking-wider text-text-secondary uppercase">
              Categories
            </span>
            {ISSUE_CATEGORIES.map((category) => {
              const off = hidden.has(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggleCategory(category)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-badge border px-2 py-1 text-xs font-semibold transition-colors duration-200 ${
                    off
                      ? 'border-border bg-surface text-text-muted line-through'
                      : 'border-border bg-surface text-text-primary hover:border-teal'
                  }`}
                >
                  <span style={{ color: `var(${categoryColorVar(category)})` }} aria-hidden="true">
                    <CategoryIcon category={category} className="size-3.5" decorative />
                  </span>
                  {categoryLabel(category)}
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-card border border-border">
            <MapContainer
              center={centre}
              zoom={13}
              scrollWheelZoom
              style={{ height: '30rem', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/*
                Density overlay — NOT a true Leaflet.heat heatmap. That needs a
                plugin this project does not depend on. These are translucent
                circles whose overlap darkens where reports cluster: an honest
                density encoding. Named "Density overlay" rather than "Heatmap"
                so nobody tries to read gradient values off it.
              */}
              {showDensity &&
                mappable.map((issue) => (
                  <CircleMarker
                    key={`density-${issue.id}`}
                    center={[issue.latitude as number, issue.longitude as number]}
                    radius={26}
                    pathOptions={{ color: 'transparent', fillColor: '#EF4444', fillOpacity: 0.14 }}
                    interactive={false}
                  />
                ))}

              {mappable.map((issue) => (
                <Marker
                  key={issue.id}
                  position={[issue.latitude as number, issue.longitude as number]}
                  icon={pinFor(issue)}
                >
                  <Popup>
                    <span className="tabular mb-1 block font-mono text-xs">
                      {issue.issue_number ?? issue.id.slice(0, 8)}
                    </span>
                    <span className="mb-1 block font-semibold">
                      {categoryLabel(issue.category)}
                    </span>
                    <span className="mb-1 flex flex-wrap items-center gap-1">
                      <StatusBadge status={issue.status} />
                      <SlaIndicator issue={issue} variant="dot" />
                    </span>
                    <span className="block text-xs text-text-muted">
                      {formatAge(issue.created_at)} · {formatCount(issue.upvote_count)} upvotes
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      className="mt-2 cursor-pointer text-teal-dark underline underline-offset-2"
                    >
                      Open issue
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/*
            The map is not usefully reachable by keyboard or screen reader, so
            the same reports are listed beneath it. This is the accessible
            equivalent of the map, not a debug aid — do not remove it.
          */}
          <section className="mt-4">
            <h2 className="mb-2 text-xs font-bold tracking-wider text-text-secondary uppercase">
              Plotted reports ({formatCount(mappable.length)})
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {mappable.slice(0, 15).map((issue) => (
                <li key={issue.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                    className="tabular cursor-pointer font-mono text-xs text-teal-dark underline-offset-2 hover:underline"
                  >
                    {issue.issue_number ?? issue.id.slice(0, 8)}
                  </button>
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ color: `var(${categoryColorVar(issue.category)})` }}
                      aria-hidden="true"
                    >
                      <CategoryIcon category={issue.category} className="size-3.5" decorative />
                    </span>
                    {categoryLabel(issue.category)}
                  </span>
                  <StatusBadge status={issue.status} />
                  <SlaIndicator issue={issue} variant="dot" />
                  <span className="text-text-muted">{formatAge(issue.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
