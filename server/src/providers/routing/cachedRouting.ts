import type { LatLng } from '@golden-hour/shared';
import { haversineKm } from '../../lib/geo';
import { RouteCacheModel } from './routeCache.model';
import type { EtaResult, RoutingProvider } from './routing.provider';

const WINDING_FACTOR = 1.8;
const HILL_SPEED_KMH = 25;

/** ~110 m grid: nearby origins share a cache entry; donor anchors are already rounded to ~1 km. */
function cacheKey(from: LatLng, to: LatLng): string {
  const r = (n: number) => n.toFixed(3);
  return `${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`;
}

/**
 * Wraps a live provider with a route cache and a labelled fallback:
 *  1. fresh cache hit → `cached` (original `calculatedAt`, so the UI shows its age);
 *  2. live call → `live`, stored in the cache;
 *  3. provider failed → `rough_estimate` from straight-line distance, never shown as a road ETA.
 */
export class CachedRoutingProvider implements RoutingProvider {
  readonly name: string;

  constructor(
    private readonly inner: RoutingProvider,
    private readonly ttlMinutes: number,
  ) {
    this.name = inner.name;
  }

  async getEta(from: LatLng, to: LatLng, opts: { timeoutMs: number }): Promise<EtaResult> {
    const key = cacheKey(from, to);
    const cached = await RouteCacheModel.findOne({ key, expiresAt: { $gt: new Date() } }).lean().catch(() => null);
    if (cached) {
      return { status: 'ok', minutes: cached.minutes, distanceKm: cached.distanceKm, source: cached.source, calculatedAt: cached.calculatedAt, quality: 'cached' };
    }

    const live = await this.inner.getEta(from, to, opts);
    if (live.status === 'ok') {
      await RouteCacheModel.updateOne(
        { key },
        {
          $set: {
            minutes: live.minutes,
            distanceKm: live.distanceKm,
            source: live.source,
            calculatedAt: live.calculatedAt,
            expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000),
          },
        },
        { upsert: true },
      ).catch(() => undefined); // a cache write failure must not lose the live answer
      return live;
    }

    const distanceKm = haversineKm(from, to) * WINDING_FACTOR;
    return {
      status: 'rough_estimate',
      minutes: Math.max(1, Math.round((distanceKm / HILL_SPEED_KMH) * 60)),
      distanceKm: Math.round(distanceKm * 10) / 10,
      source: 'straight_line',
      calculatedAt: new Date(),
      quality: 'rough_estimate',
    };
  }
}
