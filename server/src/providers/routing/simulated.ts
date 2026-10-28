import type { LatLng } from '@golden-hour/shared';
import { haversineKm } from '../../lib/geo';
import type { EtaResult, RoutingProvider } from './routing.provider';

/** Hill roads are much longer than the straight line between two points. */
const WINDING_FACTOR = 1.8;
/** Average hill-road speed including stops. */
const HILL_SPEED_KMH = 25;

/**
 * Deterministic simulated road ETA (decision D-13). Always labelled `simulated` in the UI —
 * it is a demonstration stand-in, not road truth.
 */
export class SimulatedRoutingProvider implements RoutingProvider {
  readonly name = 'simulated';

  async getEta(from: LatLng, to: LatLng): Promise<EtaResult> {
    const distanceKm = haversineKm(from, to) * WINDING_FACTOR;
    return {
      status: 'ok',
      minutes: Math.max(1, Math.round((distanceKm / HILL_SPEED_KMH) * 60)),
      distanceKm: Math.round(distanceKm * 10) / 10,
      source: 'simulated',
      calculatedAt: new Date(),
      quality: 'simulated',
    };
  }
}
