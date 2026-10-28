import type { LatLng } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { CachedRoutingProvider } from './cachedRouting';
import { OpenRouteServiceProvider } from './openRouteService';
import { SimulatedRoutingProvider } from './simulated';

// Routing adapter boundary (docs/architecture.md §5). Every result carries its provenance;
// a failure is reported as `unavailable` (or a labelled rough estimate), never as an invented road ETA.

export type EtaResult =
  | { status: 'ok'; minutes: number; distanceKm: number; source: string; calculatedAt: Date; quality: 'live' | 'cached' | 'simulated' }
  | { status: 'rough_estimate'; minutes: number; distanceKm: number; source: 'straight_line'; calculatedAt: Date; quality: 'rough_estimate' }
  | { status: 'unavailable'; reason: string; calculatedAt: Date };

export interface RoutingProvider {
  readonly name: string;
  getEta(from: LatLng, to: LatLng, opts: { timeoutMs: number }): Promise<EtaResult>;
}

let provider: RoutingProvider | undefined;

export function getRoutingProvider(config: Config): RoutingProvider {
  if (!provider) {
    provider =
      config.ROUTING_PROVIDER === 'openrouteservice' && config.ORS_API_KEY
        ? new CachedRoutingProvider(new OpenRouteServiceProvider(config.ORS_API_KEY), config.ROUTE_CACHE_TTL_MIN)
        : new SimulatedRoutingProvider();
  }
  return provider;
}

export function isSimulatedRouting(config: Config): boolean {
  return !(config.ROUTING_PROVIDER === 'openrouteservice' && config.ORS_API_KEY);
}
