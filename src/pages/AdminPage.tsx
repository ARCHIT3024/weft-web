/**
 * Admin — deliberately empty.
 *
 * Department, zone and authority-user management need `POST /admin/*`, which
 * are still Phase 0 mocks (tasks 1.11–1.12). Until those exist, forms here
 * would appear to save and silently do nothing.
 */
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-2xl font-semibold text-navy">Administration</h1>
      <p className="mt-3 text-text-secondary">
        Authority accounts, departments and zones are managed here once the admin endpoints land
        (tasks 1.11–1.12).
      </p>
      <p className="mt-4 rounded-card border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
        Departments and the category routing map are currently seeded by migration 014; demo
        accounts and zones come from <code className="font-mono">scripts/seed_dev_data.py</code>.
      </p>
    </div>
  );
}
