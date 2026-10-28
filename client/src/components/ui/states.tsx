import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../lib/api/client';

interface StateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

function StatePanel({ title, children, action, tone }: StateProps & { tone: 'neutral' | 'danger' | 'warn' }) {
  const toneClass = {
    neutral: 'border-slate-200 bg-white',
    danger: 'border-red-200 bg-red-50',
    warn: 'border-amber-200 bg-amber-50',
  }[tone];
  return (
    <section className={`rounded-lg border p-6 text-center ${toneClass}`}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 p-8 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: StateProps) {
  return (
    <StatePanel tone="neutral" title={title} action={action}>
      {children}
    </StatePanel>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiErr = error instanceof ApiError ? error : undefined;
  const message = apiErr?.message ?? 'Something went wrong.';
  return (
    <div role="alert">
      <StatePanel
        tone="danger"
        title="Couldn't load this"
        action={
          onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary">
              Try again
            </button>
          )
        }
      >
        <p>{message}</p>
        {apiErr?.requestId && <p className="mt-1 text-xs text-slate-500">Reference: {apiErr.requestId}</p>}
      </StatePanel>
    </div>
  );
}

export function UnauthorizedState({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <StatePanel
      tone="warn"
      title={signedIn ? "You don't have access to this area" : 'Please sign in'}
      action={
        <Link to={signedIn ? '/' : '/login'} className="btn-secondary">
          {signedIn ? 'Go home' : 'Sign in'}
        </Link>
      }
    >
      {signedIn
        ? 'Your account role does not include this area. Contact an administrator if you think this is wrong.'
        : 'This area is for registered hospital staff, donors and coordinators.'}
    </StatePanel>
  );
}
