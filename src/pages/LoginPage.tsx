import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { login } from '../api/auth';
import { parseApiError } from '../lib/apiError';
import { Spinner } from '../components/States';
import { useAuthStore } from '../stores/authStore';

/**
 * Authority sign-in.
 *
 * Two things here are deliberate rather than incidental:
 *
 * - **Citizens are turned away after a successful login, not before it.** The
 *   dashboard is authority-only, but the server cannot refuse credentials on
 *   role grounds without telling an attacker which accounts are staff accounts.
 *   So the credential check succeeds, and the *page* declines — and clears the
 *   session it just created, so a CITIZEN token is never left sitting in
 *   memory.
 * - **A 429 is reported as a rate limit, not as a bad password.** Login is
 *   capped at 5 attempts/minute/IP; without this the fifth wrong guess and the
 *   sixth correct one look identical, and the operator retypes a password that
 *   was right all along.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Where the user was headed before the redirect, if anywhere.
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (isAuthenticated) return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.user.role === 'CITIZEN') {
        clearAuth();
        setError(
          'This dashboard is for municipal staff. Citizen accounts report issues through the Weft mobile app.',
        );
        return;
      }

      setAuth(result.accessToken, result.refreshToken, result.user);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(parseApiError(caught, 'Could not sign in. Please try again.').message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-surface p-8 shadow-lg">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-navy">Weft</h1>
          <p className="mt-1 text-sm text-text-secondary">Authority Dashboard</p>
        </header>

        <form onSubmit={onSubmit} noValidate>
          {/*
            role="alert" so the message is announced when it appears; without it
            a screen-reader user submits the form and hears nothing at all.
          */}
          {error !== null && (
            <div
              role="alert"
              className="mb-5 rounded-button border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-dark"
            >
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-text-primary focus-visible:border-teal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal disabled:opacity-60"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text-primary">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-text-primary focus-visible:border-teal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || email.trim() === '' || password === ''}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-teal px-4 py-2.5 font-medium text-white transition-colors hover:bg-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/*
          Stated up front because it looks like a bug otherwise. Tokens are held
          in memory only (D-9), so refreshing the tab ends the session.
        */}
        <p className="mt-6 border-t border-border pt-4 text-center text-xs text-text-muted">
          For security, your session is not stored in the browser. Reloading the page signs you out.
        </p>
      </div>
    </div>
  );
}
