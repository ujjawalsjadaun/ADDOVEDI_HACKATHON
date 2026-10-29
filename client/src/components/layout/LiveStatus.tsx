import { useRealtimeStatus } from '../../lib/realtime/RealtimeProvider';

const TEXT = {
  live: { dot: 'bg-emerald-600', text: 'Live updates on' },
  connecting: { dot: 'bg-slate-400', text: 'Connecting live updates…' },
  reconnecting: { dot: 'bg-amber-500', text: 'Live updates interrupted — refreshing every 15–60 s' },
} as const;

/** Footer indicator; hidden when signed out (no realtime for anonymous visitors). */
export function LiveStatus() {
  const status = useRealtimeStatus();
  if (status === 'off') return null;
  const s = TEXT[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300" role="status">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.text}
    </span>
  );
}
