import type { LatLng } from '@golden-hour/shared';
import { fetchJson } from '../../lib/fetchJson';
import type { WeatherProvider, WeatherResult } from './weather.provider';

interface OpenMeteoResponse {
  current?: { time?: string; precipitation?: number };
}

/** Open-Meteo current precipitation (keyless). In-memory cache per ~10 km cell. */
export class OpenMeteoProvider implements WeatherProvider {
  readonly name = 'open-meteo';
  readonly simulated = false;
  private readonly cache = new Map<string, { result: WeatherResult & { status: 'ok' }; until: number }>();

  constructor(private readonly ttlMinutes: number) {}

  async getConditions(at: LatLng, opts: { timeoutMs: number }): Promise<WeatherResult> {
    const key = `${at.lat.toFixed(1)},${at.lng.toFixed(1)}`;
    const hit = this.cache.get(key);
    if (hit && hit.until > Date.now()) return { ...hit.result, quality: 'cached' };

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(4)}&longitude=${at.lng.toFixed(4)}&current=precipitation&timezone=UTC`;
      const body = await fetchJson<OpenMeteoResponse>(url, { timeoutMs: opts.timeoutMs, headers: { Accept: 'application/json' } });
      const mm = body.current?.precipitation;
      if (typeof mm !== 'number') return { status: 'unavailable', reason: 'no precipitation in response' };
      // Open-Meteo "current" precipitation is the amount over the preceding 15 min; scale to mm/h.
      const result = {
        status: 'ok' as const,
        rainMmPerHour: Math.round(mm * 4 * 10) / 10,
        source: this.name,
        observedAt: body.current?.time ? new Date(`${body.current.time}Z`) : new Date(),
        quality: 'live' as const,
      };
      this.cache.set(key, { result, until: Date.now() + this.ttlMinutes * 60_000 });
      return result;
    } catch (err) {
      return { status: 'unavailable', reason: err instanceof Error ? err.message : 'weather request failed' };
    }
  }
}
