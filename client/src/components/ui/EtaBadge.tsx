import type { EtaSnapshot } from '@golden-hour/shared';

const QUALITY_LABEL: Record<EtaSnapshot['quality'], string> = {
  live: 'live road estimate',
  cached: 'cached road estimate',
  simulated: 'simulated estimate',
  rough_estimate: 'rough straight-line guess',
  unavailable: 'travel time unknown',
};

/** Travel time is always shown with where it came from — never as a bare promise. */
export function EtaBadge({ eta }: { eta: EtaSnapshot | null }) {
  if (!eta || eta.minutes === null) {
    return <span className="text-sm text-amber-800">Travel time unknown — check manually</span>;
  }
  const h = Math.floor(eta.minutes / 60);
  const m = eta.minutes % 60;
  return (
    <span className="text-sm text-slate-700">
      ~{h > 0 ? `${h} h ${m} min` : `${m} min`}
      {eta.distanceKm !== null && ` · ${eta.distanceKm} km`}{' '}
      <span className={`text-xs ${eta.quality === 'live' || eta.quality === 'cached' ? 'text-slate-500' : 'text-amber-700'}`}>
        ({QUALITY_LABEL[eta.quality]}
        {eta.weatherAdjustment === 'unavailable' ? ', weather not included' : eta.weatherAdjustment !== 'none' ? `, ${eta.weatherAdjustment} rain delay added` : ''})
      </span>
    </span>
  );
}
