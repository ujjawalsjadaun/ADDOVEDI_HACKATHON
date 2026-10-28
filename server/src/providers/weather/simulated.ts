import type { WeatherProvider, WeatherResult } from './weather.provider';

/** Fixed rain level from `SIMULATED_RAIN_MM_PER_HOUR`. Always labelled simulated in the UI. */
export class SimulatedWeatherProvider implements WeatherProvider {
  readonly name = 'simulated';
  readonly simulated = true;

  constructor(private readonly rainMmPerHour: number) {}

  async getConditions(): Promise<WeatherResult> {
    return { status: 'ok', rainMmPerHour: this.rainMmPerHour, source: 'simulated', observedAt: new Date(), quality: 'simulated' };
  }
}
