import { useQuery } from '@tanstack/react-query';
import type { HealthReady } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

export function ApiStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: () => api<HealthReady>('/health/ready', { acceptStatus: [503], timeoutMs: 5000 }),
    refetchInterval: 30_000,
    retry: false,
  });

  let dot = 'bg-slate-400';
  let text = 'Checking server…';
  let isReady = false;

  if (isError) {
    dot = 'bg-rose-600';
    text = 'Server unreachable';
  } else if (data) {
    isReady = data.data.status === 'ready';
    dot = isReady ? 'bg-emerald-600' : 'bg-amber-500';
    text = isReady ? 'Server connected' : 'Server degraded — database unavailable';
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 font-medium text-slate-700 shadow-2xs" role="status">
        <span className="relative flex h-2 w-2">
          {isReady && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" aria-hidden="true" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        </span>
        {isPending ? 'Checking server…' : text}
      </span>
      {data?.data.demoMode && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Demo mode · synthetic data · simulated SMS
        </span>
      )}
    </div>
  );
}
