import type { ReactNode } from 'react';
import type { ApiError } from '../lib/apiError';

/**
 * The loading / error / empty triple every network-backed view needs.
 *
 * Centralised so that all three read the same way everywhere, and so that the
 * "the issues API may not be up yet" case has one honest presentation instead
 * of a blank panel per page.
 */

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * `role="status"` rather than `role="alert"`: a load in progress is polite
 * news, and should not interrupt whatever a screen reader is already saying.
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-6 py-12 text-text-secondary"
    >
      <Spinner className="size-5 text-teal" />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  error: ApiError;
  /** Rendered as a retry button when supplied. */
  onRetry?: () => void;
  /** Extra guidance shown under the message. */
  children?: ReactNode;
}

/**
 * A failed request, explained.
 *
 * Shows the server's own sentence when there is one — the backend's error
 * envelope carries messages written for humans — and the machine code
 * underneath, because "which error code did it give you?" is the first question
 * anyone debugging this will ask.
 */
export function ErrorState({ error, onRetry, children }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-card border border-danger/40 bg-danger/8 px-5 py-4 text-text-primary"
    >
      <p className="font-semibold text-danger-dark">Something went wrong</p>
      <p className="mt-1 text-sm">{error.message}</p>
      {children ? <div className="mt-2 text-sm text-text-secondary">{children}</div> : null}
      <p className="mt-2 font-mono text-xs text-text-muted">
        {error.code}
        {error.status === null ? '' : ` · HTTP ${error.status}`}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-button border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger-dark hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-border bg-white px-6 py-12 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-prose text-sm text-text-secondary">{children}</div> : null}
    </div>
  );
}
