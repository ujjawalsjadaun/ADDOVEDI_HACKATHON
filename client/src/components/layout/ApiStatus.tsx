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
  if (isError) {
    dot = 'bg-red-600';
    text = 'Server unreachable';
  } else if (data) {
    const ready = data.data.status === 'ready';
    dot = ready ? 'bg-emerald-600' : 'bg-amber-500';
    text = ready ? 'Server connected' : 'Server degraded — database unavailable';
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5" role="status">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        {isPending ? 'Checking server…' : text}
      </span>
      {data?.data.demoMode && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
          Demo mode · synthetic data · simulated SMS
        </span>
      )}
    </div>
  );
}
