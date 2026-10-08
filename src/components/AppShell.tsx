import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../lib/axios';
import { useAuthStore } from '../stores/authStore';

/**
 * Persistent chrome: navy sidebar + page header.
 *
 * Kept mounted across route changes (pages render into `<Outlet />`), so the
 * Leaflet map's tiles and the nav do not remount on every navigation.
 *
 * Layout follows `03_weft_uiux.jsx::DSidebar` — brand block, four nav items with
 * a teal active state, and the signed-in user with their role pinned to the
 * bottom. Rajan (persona C) manages one zone and needs to know at a glance which
 * account and department he is acting as; that is why identity is persistent
 * chrome rather than hidden behind an avatar menu.
 */

const NAV = [
  { to: '/dashboard', label: 'Dashboard', d: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5' },
  { to: '/issues', label: 'Issues', d: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/analytics', label: 'Analytics', d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/team', label: 'Team', d: 'M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 20v-2a3 3 0 0 0-2.5-3' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    // `logout()` revokes the refresh token server-side and clears the store
    // either way — a network failure must never leave someone apparently
    // signed in.
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Skip link: the sidebar is 4 links plus sign-out, and a keyboard user
          should not tab through them on every page load. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-button focus:bg-teal focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <aside className="flex w-56 shrink-0 flex-col border-r border-navy-dark bg-navy text-white">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-lg font-bold tracking-tight">Weft</p>
          <p className="text-xs text-white/60">Authority portal</p>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex cursor-pointer items-center gap-2.5 rounded-button px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? 'bg-teal text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <NavIcon d={item.d} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-bold"
            >
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-white/60">{user?.role}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={signingOut}
            className="w-full cursor-pointer rounded-button border border-white/20 px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-white/10 disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {/*
            Stated in the chrome, because it looks like a bug otherwise: tokens
            are in memory only (D-9), so a reload ends the session.
          */}
          <p className="mt-2 text-xs leading-snug text-white/40">
            Session is held in memory. Reloading signs you out.
          </p>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 p-5">
        <Outlet />
      </main>
    </div>
  );
}
