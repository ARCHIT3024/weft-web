import { useAuthStore } from '../stores/authStore';

/**
 * Team — deliberately not built.
 *
 * The spec's sidebar has a Team item and PRD US-011 defines the workflow
 * (create authority accounts with name/employee ID/department/designation;
 * deactivate, never delete; self-registration forbidden). None of it is
 * reachable: `POST /admin/authority-users` and its sibling endpoints are still
 * Phase 0 mocks returning static JSON, and there is no endpoint that *lists*
 * authority users at all.
 *
 * A form here would appear to save and silently do nothing — the worst outcome
 * for a screen whose whole purpose is controlling who has access. So this states
 * what is missing and what it blocks.
 */
export default function TeamPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-xl font-bold text-navy">Team</h1>
      <p className="mt-2 text-text-secondary">
        Authority accounts for your department are managed here once the admin endpoints exist
        (tasks 1.11–1.12).
      </p>

      <div className="mt-5 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-bold text-navy">What this page needs</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
          <li>
            <code className="font-mono text-xs">GET /admin/authority-users</code> — does not exist
            in the contract at all. Without it there is no directory to show, and no staff picker on
            the issue detail page either, which is why assignment currently takes a raw UUID.
          </li>
          <li>
            <code className="font-mono text-xs">POST /admin/authority-users</code> and{' '}
            <code className="font-mono text-xs">PATCH .../deactivate</code> — present in the
            contract, still mock handlers returning fixed JSON.
          </li>
        </ul>
        <p className="mt-3 text-sm text-text-secondary">
          Per PRD US-011, accounts are <strong>deactivated, never deleted</strong>, and authority
          accounts are never self-registered — they are provisioned by an admin.
        </p>
      </div>

      {user?.role !== 'ADMIN' && (
        <p className="mt-4 text-sm text-text-muted">
          You are signed in as {user?.role}. Account management is limited to ADMIN users; an
          AUTHORITY user will only ever manage their own department.
        </p>
      )}
    </div>
  );
}
