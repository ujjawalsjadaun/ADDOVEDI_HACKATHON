import type { LatLng } from '@golden-hour/shared';
import { fetchJson } from '../../lib/fetchJson';
import type { EtaResult, RoutingProvider } from './routing.provider';

interface OrsResponse {
  routes?: { summary?: { distance?: number; duration?: number } }[];
}

/** OpenRouteService driving directions. Live road ETA; any failure is reported as `unavailable`. */
export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = 'openrouteservice';

  constructor(private readonly apiKey: string) {}

  async getEta(from: LatLng, to: LatLng, opts: { timeoutMs: number }): Promise<EtaResult> {
    const calculatedAt = new Date();
    try {
      const body = await fetchJson<OrsResponse>('https://api.openrouteservice.org/v2/directions/driving-car', {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        // ORS expects [lng, lat].
        body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
        timeoutMs: opts.timeoutMs,
      });
      const summary = body.routes?.[0]?.summary;
      if (!summary || typeof summary.duration !== 'number' || typeof summary.distance !== 'number') {
        return { status: 'unavailable', reason: 'no route found', calculatedAt };
      }
      return {
        status: 'ok',
        minutes: Math.max(1, Math.round(summary.duration / 60)),
        distanceKm: Math.round(summary.distance / 100) / 10,
        source: this.name,
        calculatedAt,
        quality: 'live',
      };
    } catch (err) {
      return { status: 'unavailable', reason: err instanceof Error ? err.message : 'routing request failed', calculatedAt };
    }
  }
}
