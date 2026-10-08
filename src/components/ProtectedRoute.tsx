import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Gate for every authenticated route.
 *
 * There is no "checking session…" state here, and that is a consequence of D-9
 * rather than an omission: tokens live only in the Zustand closure, so on a
 * fresh page load `isAuthenticated` is synchronously `false` and the redirect
 * happens on the first render. No dashboard chrome flashes, no request is fired
 * that could 401, and there is nothing to await. If session restore were ever
 * added, this component would need a pending state — that is the tell.
 *
 * The attempted path is carried in navigation state so the login form can send
 * the user back to where they were headed.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
