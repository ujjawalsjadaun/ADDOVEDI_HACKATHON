import type { EtaSnapshot } from '@golden-hour/shared';

const QUALITY_LABEL: Record<EtaSnapshot['quality'], string> = {
  live: 'live road estimate',
  cached: 'cached road estimate',
  simulated: 'simulated estimate',
  rough_estimate: 'rough straight-line guess',
  unavailable: 'travel time unknown',
};

function weatherText(w: EtaSnapshot['weatherAdjustment']): string {
  if (w === 'unavailable') return ', weather not included';
  if (w === 'none') return ', no rain delay';
  return `, ${w} rain delay added`;
}

/** Travel time is always shown with where it came from — never as a bare promise. Warnings are listed under it. */
export function EtaBadge({ eta, showWarnings = true }: { eta: EtaSnapshot | null; showWarnings?: boolean }) {
  const warnings = showWarnings ? (eta?.warnings ?? []) : [];
  if (!eta || eta.minutes === null) {
    return (
      <span className="text-sm text-amber-800">
        Travel time unknown — check manually
        {warnings.length > 0 && <Warnings items={warnings} />}
      </span>
    );
  }
  const h = Math.floor(eta.minutes / 60);
  const m = eta.minutes % 60;
  return (
    <span className="text-sm text-slate-700">
      ~{h > 0 ? `${h} h ${m} min` : `${m} min`}
      {eta.distanceKm !== null && ` · ${eta.distanceKm} km`}{' '}
      <span className={`text-xs ${eta.quality === 'live' || eta.quality === 'cached' ? 'text-slate-500' : 'text-amber-700'}`}>
        ({QUALITY_LABEL[eta.quality]}
        {weatherText(eta.weatherAdjustment)})
      </span>
      {warnings.length > 0 && <Warnings items={warnings} />}
    </span>
  );
}

function Warnings({ items }: { items: string[] }) {
  return (
    <span className="mt-0.5 block space-y-0.5">
      {items.map((w) => (
        <span key={w} className="block text-xs font-medium text-amber-800">
          ⚠ {w}
        </span>
      ))}
    </span>
  );
}
