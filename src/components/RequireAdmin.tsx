import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Role gate for `/admin`.
 *
 * Renders an explicit refusal rather than bouncing to `/dashboard`. A silent
 * redirect leaves someone who followed a link or typed the URL wondering
 * whether the page moved, is broken, or does not exist; naming the reason costs
 * one screen and answers it. The route is not the security boundary either way
 * — the backend enforces admin-only operations — so there is nothing gained by
 * being coy about the page's existence.
 */
export default function RequireAdmin() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold text-navy">Admin access required</h1>
        <p className="mt-3 text-text-secondary">
          This section manages authority accounts and departments, and is limited to users with the
          ADMIN role. Your account is signed in as{' '}
          <span className="font-medium text-text-primary">{user?.role ?? 'unknown'}</span>.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-button bg-teal px-4 py-2 font-medium text-white hover:bg-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
