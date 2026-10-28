import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus';

interface Props {
  /** `dataUpdatedAt` from the query (ms since epoch; 0 = never loaded). */
  updatedAt: number;
  /** After this long without a successful refresh, the data is flagged as possibly out of date. */
  staleAfterMs: number;
  isFetching: boolean;
  isError?: boolean;
  onRefresh: () => void;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/** "Updated 20s ago · Refresh" — turns into a warning when data may be out of date. Never claims to be live. */
export function DataFreshness({ updatedAt, staleAfterMs, isFetching, isError, onRefresh }: Props) {
  const online = useOnlineStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const age = updatedAt ? now - updatedAt : Infinity;
  const stale = !online || isError || age > staleAfterMs;
  const text = !updatedAt
    ? 'Not loaded yet'
    : `Updated ${ago(age)}${!online ? ' · offline' : isError ? ' · refresh failed' : stale ? ' · may be out of date' : ''}`;

  return (
    <div
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-2xs transition-colors ${
        stale
          ? 'border-amber-300/80 bg-amber-50/90 font-medium text-amber-900'
          : 'border-slate-200/90 bg-white text-slate-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
      <span>{text}</span>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
        onClick={onRefresh}
        disabled={isFetching || !online}
        title="Refresh data from server"
      >
        {isFetching ? (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-brand-600 border-t-transparent" />
            Syncing…
          </span>
        ) : (
          'Refresh'
        )}
      </button>
    </div>
  );
}
