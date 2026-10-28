import type { LatLng } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { SimulatedRoutingProvider } from './simulated';

// Routing adapter boundary (docs/architecture.md §5). Every result carries its provenance;
// a failure is reported as `unavailable`, never as an invented number.

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
    switch (config.ROUTING_PROVIDER) {
      case 'simulated':
        provider = new SimulatedRoutingProvider();
        break;
      default:
        // Real providers arrive in Phase 7; until then fall back to the labelled simulation.
        provider = new SimulatedRoutingProvider();
    }
  }
  return provider;
}
