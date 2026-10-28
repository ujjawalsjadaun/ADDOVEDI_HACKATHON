import type { LatLng, WeatherAdjustment } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { OpenMeteoProvider } from './openMeteo';
import { SimulatedWeatherProvider } from './simulated';

// Weather adapter boundary (docs/architecture.md §5–6). Weather is a transparent delay band,
// not a calibrated model; when unavailable the base ETA is used and labelled as such.

export type WeatherResult =
  | { status: 'ok'; rainMmPerHour: number; source: string; observedAt: Date; quality: 'live' | 'cached' | 'simulated' }
  | { status: 'unavailable'; reason: string };

export interface WeatherProvider {
  readonly name: string;
  readonly simulated: boolean;
  getConditions(at: LatLng, opts: { timeoutMs: number }): Promise<WeatherResult>;
}

/** Rain bands: < 2.5 mm/h none, 2.5–7.6 moderate, > 7.6 heavy. */
export function rainBand(mmPerHour: number): Exclude<WeatherAdjustment, 'unavailable'> {
  if (mmPerHour > 7.6) return 'heavy';
  if (mmPerHour >= 2.5) return 'moderate';
  return 'none';
}

export function rainDelayPct(band: WeatherAdjustment, config: Config): number {
  if (band === 'heavy') return config.RAIN_DELAY_HEAVY_PCT;
  if (band === 'moderate') return config.RAIN_DELAY_MODERATE_PCT;
  return 0;
}

let provider: WeatherProvider | undefined;

export function getWeatherProvider(config: Config): WeatherProvider {
  if (!provider) {
    provider =
      config.WEATHER_PROVIDER === 'open-meteo'
        ? new OpenMeteoProvider(config.WEATHER_CACHE_TTL_MIN)
        : new SimulatedWeatherProvider(config.SIMULATED_RAIN_MM_PER_HOUR);
  }
  return provider;
}
