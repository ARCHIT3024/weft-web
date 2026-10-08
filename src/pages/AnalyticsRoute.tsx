import { lazy, Suspense } from 'react';
import { LoadingState } from '../components/States';

/**
 * Route wrapper that code-splits Analytics.
 *
 * Analytics is the only screen using Recharts, which is ~380 kB of the bundle.
 * Loading it eagerly makes every supervisor who only opens the map and the queue
 * pay for a page they never visit, so it is fetched on first navigation instead.
 *
 * The `lazy()` call lives here rather than in the router because that file
 * exports `router` (not a component); mixing the two breaks Fast Refresh.
 */
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));

export default function AnalyticsRoute() {
  return (
    <Suspense fallback={<LoadingState label="Loading analytics…" />}>
      <AnalyticsPage />
    </Suspense>
  );
}
