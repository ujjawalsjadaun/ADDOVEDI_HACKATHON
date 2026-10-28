import type { EtaSnapshot } from '@golden-hour/shared';

const QUALITY_LABEL: Record<EtaSnapshot['quality'], string> = {
  live: 'live road routing',
  cached: 'cached road routing',
  simulated: 'simulated routing',
  rough_estimate: 'straight-line approximation',
  unavailable: 'routing unavailable',
};

function weatherText(w: EtaSnapshot['weatherAdjustment']): string {
  if (w === 'unavailable') return ' · weather unavailable';
  if (w === 'none') return '';
  return ` · +${w} rain penalty`;
}

/** Travel time is always clearly attributed to its data origin (Decision D-13/D-34). */
export function EtaBadge({ eta, showWarnings = true }: { eta: EtaSnapshot | null; showWarnings?: boolean }) {
  const warnings = showWarnings ? (eta?.warnings ?? []) : [];

  if (!eta || eta.minutes === null) {
    return (
      <div className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          ETA Unknown · Manual Dispatch Required
        </span>
        {warnings.length > 0 && <Warnings items={warnings} />}
      </div>
    );
  }

  const h = Math.floor(eta.minutes / 60);
  const m = eta.minutes % 60;
  const timeFormatted = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const isHighQuality = eta.quality === 'live' || eta.quality === 'cached';

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-0.5 font-bold tabular-nums text-slate-900 shadow-2xs">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-slate-500" aria-hidden="true">
            <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 .375.65l2.75 1.5a.75.75 0 1 0 .75-1.3l-2.375-1.3V4.75Z" clipRule="evenodd" />
          </svg>
          ~{timeFormatted}
          {eta.distanceKm !== null && <span className="font-normal text-slate-500">({eta.distanceKm} km)</span>}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${isHighQuality ? 'bg-slate-100 text-slate-600' : 'bg-amber-100/80 text-amber-900'}`}>
          {QUALITY_LABEL[eta.quality]}
          {weatherText(eta.weatherAdjustment)}
        </span>
      </div>
      {warnings.length > 0 && <Warnings items={warnings} />}
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  return (
    <div className="space-y-1">
      {items.map((w) => (
        <span key={w} className="flex items-center gap-1.5 rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          <span aria-hidden="true">⚠</span>
          {w}
        </span>
      ))}
    </div>
  );
}
