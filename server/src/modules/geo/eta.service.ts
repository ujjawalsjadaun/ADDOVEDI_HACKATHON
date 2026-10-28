import type { EtaSnapshot, LatLng, WeatherAdjustment } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { distanceToSegmentKm, fromGeoPoint } from '../../lib/geo';
import { getRoutingProvider, type EtaResult } from '../../providers/routing/routing.provider';
import { getWeatherProvider, rainBand, rainDelayPct, type WeatherResult } from '../../providers/weather/weather.provider';
import { loadActiveRoadReports } from '../roads/roadReport.service';
import { affectsEta } from '../roads/roadReport.rules';

// Travel-time estimate = routing result → road-report check → weather band (docs/architecture.md §6).
// Every step that is missing or uncertain is labelled; nothing is invented.

export interface EtaContext {
  eta(from: LatLng, to: LatLng): Promise<EtaSnapshot>;
}

/**
 * Builds a context for many ETA calls (one matching run): loads current road reports once and
 * shares weather lookups per destination.
 */
export async function createEtaContext(config: Config): Promise<EtaContext> {
  const reports = (await loadActiveRoadReports()).map((r) => ({ doc: r, at: fromGeoPoint(r.location) }));
  const routing = getRoutingProvider(config);
  const weather = getWeatherProvider(config);
  const weatherByCell = new Map<string, Promise<WeatherResult>>();

  const weatherAt = (p: LatLng) => {
    const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
    let pending = weatherByCell.get(key);
    if (!pending) {
      pending = weather
        .getConditions(p, { timeoutMs: config.PROVIDER_TIMEOUT_MS })
        .catch((err: unknown): WeatherResult => ({ status: 'unavailable', reason: String(err) }));
      weatherByCell.set(key, pending);
    }
    return pending;
  };

  return {
    async eta(from, to) {
      const now = new Date();
      const warnings: string[] = [];

      const near = reports.filter((r) => distanceToSegmentKm(r.at, from, to) <= config.ROAD_REPORT_CORRIDOR_KM);
      const blocking = near.filter((r) => affectsEta(r.doc));
      if (blocking.length > 0) {
        return {
          minutes: null,
          distanceKm: null,
          quality: 'unavailable',
          source: 'road_report',
          calculatedAt: now.toISOString(),
          weatherAdjustment: 'unavailable',
          warnings: [`Road reported blocked near the route (${blocking.map((r) => r.doc.label).join(', ')}). Confirm the route by phone.`],
        };
      }
      for (const r of near) {
        warnings.push(
          r.doc.condition === 'blocked'
            ? `Unconfirmed report of a blocked road near the route: ${r.doc.label}.`
            : `Road reported restricted near the route: ${r.doc.label}.`,
        );
      }

      const route: EtaResult = await routing
        .getEta(from, to, { timeoutMs: config.PROVIDER_TIMEOUT_MS })
        .catch((err: unknown): EtaResult => ({ status: 'unavailable', reason: String(err), calculatedAt: now }));

      if (route.status === 'unavailable') {
        return {
          minutes: null,
          distanceKm: null,
          quality: 'unavailable',
          source: 'none',
          calculatedAt: route.calculatedAt.toISOString(),
          weatherAdjustment: 'unavailable',
          warnings: [...warnings, 'Routing service unavailable — travel time unknown.'],
        };
      }
      if (route.status === 'rough_estimate') warnings.push('Routing service unavailable — rough straight-line guess, not a road estimate.');

      let minutes = route.minutes;
      let weatherAdjustment: WeatherAdjustment = 'unavailable';
      const w = await weatherAt(to);
      if (w.status === 'ok') {
        weatherAdjustment = rainBand(w.rainMmPerHour);
        const pct = rainDelayPct(weatherAdjustment, config);
        if (pct > 0) minutes = Math.round(minutes * (1 + pct / 100));
        if (w.quality === 'simulated' && weatherAdjustment !== 'none') warnings.push('Rain delay is from simulated weather.');
      } else {
        warnings.push('Weather unavailable — no rain delay included.');
      }

      return {
        minutes,
        distanceKm: route.distanceKm,
        quality: route.quality,
        source: route.source,
        calculatedAt: route.calculatedAt.toISOString(),
        weatherAdjustment,
        warnings,
      };
    },
  };
}
