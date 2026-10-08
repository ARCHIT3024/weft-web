/**
 * Weft Web Dashboard — route table.
 *
 * Layering, outermost first:
 *
 *   /login                    public
 *   ProtectedRoute            requires a session (see D-9: a reload has none)
 *     └── AppShell            nav + header, kept mounted across pages so the
 *                             map's tiles do not remount on every navigation
 *         ├── /dashboard      map
 *         ├── /issues         list
 *         ├── /issues/:id     detail + triage actions
 *         ├── /analytics      real metrics computed from GET /issues
 *         ├── /team           states what the missing admin endpoints block
 *         └── RequireAdmin
 *             └── /admin      placeholder (Phase 3, admin only)
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';
import RequireAdmin from '../components/RequireAdmin';
import AdminPage from '../pages/AdminPage';
import DashboardPage from '../pages/DashboardPage';
import IssueDetailPage from '../pages/IssueDetailPage';
import IssuesPage from '../pages/IssuesPage';
import LoginPage from '../pages/LoginPage';
import AnalyticsRoute from '../pages/AnalyticsRoute';
import TeamPage from '../pages/TeamPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/issues', element: <IssuesPage /> },
          { path: '/issues/:id', element: <IssueDetailPage /> },
          { path: '/analytics', element: <AnalyticsRoute /> },
          { path: '/team', element: <TeamPage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
