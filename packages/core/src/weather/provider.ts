import type { NormalizedWeather } from "../types";

export interface WeatherProvider {
  readonly kind: "openweather" | "mock";
  getForecast(input: { lat: number; lon: number; label: string }): Promise<NormalizedWeather>;
}
