import type { TimelineEvent } from '@golden-hour/shared';
import { formatDateTime } from '../../../lib/format';

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">No events yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900">{e.label}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(e.at)}
            {e.actor?.name && ` · ${e.actor.name}`}
          </p>
          {e.reason && <p className="mt-0.5 text-sm text-slate-600">“{e.reason}”</p>}
        </li>
      ))}
    </ol>
  );
}
