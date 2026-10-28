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
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
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
    : `Updated ${ago(age)}${!online ? ' · you are offline' : isError ? ' · last refresh failed' : stale ? ' · may be out of date' : ''}`;

  return (
    <p role="status" className={`flex items-center gap-2 text-xs ${stale ? 'font-medium text-amber-800' : 'text-slate-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
      {text}
      <button type="button" className="underline disabled:no-underline disabled:opacity-60" onClick={onRefresh} disabled={isFetching || !online}>
        {isFetching ? 'Refreshing…' : 'Refresh'}
      </button>
    </p>
  );
}
