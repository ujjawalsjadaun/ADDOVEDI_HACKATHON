import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../lib/api/client';

interface StateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

function StatePanel({
  title,
  children,
  action,
  tone,
  icon,
}: StateProps & { tone: 'neutral' | 'danger' | 'warn'; icon?: ReactNode }) {
  const toneClass = {
    neutral: 'border-slate-200/90 bg-white shadow-xs',
    danger: 'border-rose-200 bg-rose-50/50 shadow-xs',
    warn: 'border-amber-200 bg-amber-50/50 shadow-xs',
  }[tone];

  return (
    <section className={`mx-auto max-w-lg rounded-2xl border p-8 sm:p-10 text-center ${toneClass}`}>
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      {children && <div className="mt-2 text-sm text-slate-600 leading-relaxed">{children}</div>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  );
}

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-slate-600">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute h-8 w-8 animate-ping rounded-full bg-brand-400/20" aria-hidden="true" />
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden="true" />
      </div>
      <span className="text-xs font-medium tracking-wide uppercase text-slate-500">{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: StateProps) {
  const emptyIcon = (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/60">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    </div>
  );

  return (
    <StatePanel tone="neutral" title={title} action={action} icon={emptyIcon}>
      {children}
    </StatePanel>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiErr = error instanceof ApiError ? error : undefined;
  const message = apiErr?.message ?? 'Something went wrong. Please check your connection and try again.';

  const errorIcon = (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-1 ring-rose-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
    </div>
  );

  return (
    <div role="alert">
      <StatePanel
        tone="danger"
        title="Unable to load this information"
        icon={errorIcon}
        action={
          onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary">
              Try again
            </button>
          )
        }
      >
        <p>{message}</p>
        {apiErr?.requestId && (
          <p className="mt-2 font-mono text-[11px] text-slate-500">Correlation ID: {apiErr.requestId}</p>
        )}
      </StatePanel>
    </div>
  );
}

export function UnauthorizedState({ signedIn = false }: { signedIn?: boolean }) {
  const lockIcon = (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );

  return (
    <StatePanel
      tone="warn"
      title={signedIn ? "Access Restricted" : 'Sign In Required'}
      icon={lockIcon}
      action={
        <Link to={signedIn ? '/' : '/login'} className="btn-secondary">
          {signedIn ? 'Return to Home' : 'Sign in to Continue'}
        </Link>
      }
    >
      {signedIn
        ? 'Your account role does not have authorization to access this clinical or administrative area. Contact an administrator if you believe this is an error.'
        : 'This area is restricted to authorized hospital clinicians, verified donors, and emergency coordinators.'}
    </StatePanel>
  );
}
