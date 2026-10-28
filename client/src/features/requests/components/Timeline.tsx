import type { TimelineEvent } from '@golden-hour/shared';
import { formatDateTime } from '../../../lib/format';

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-slate-500 italic py-2">No lifecycle events recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-100 ml-3 pl-6">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative group">
          <span
            className="absolute -left-[1.85rem] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-600 shadow-xs ring-2 ring-brand-100 group-hover:scale-110 transition-transform"
            aria-hidden="true"
          />
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <p className="text-xs font-bold text-slate-900">{e.label}</p>
            <time className="text-2xs font-medium text-slate-500">
              {formatDateTime(e.at)}
            </time>
          </div>
          {e.actor?.name && (
            <p className="text-2xs text-slate-500 font-medium mt-0.5">
              By <span className="text-slate-700">{e.actor.name}</span>
            </p>
          )}
          {e.reason && (
            <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-700 italic">
              “{e.reason}”
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
