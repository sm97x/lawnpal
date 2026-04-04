import type { NormalizedWeather, NormalizedWeatherDay } from "../types";
import { sameDayKey } from "../utils/date";

type WeatherCondition = {
  description?: string;
};

type OpenWeatherCurrent = {
  coord?: { lat?: number; lon?: number };
  main?: {
    temp?: number;
    humidity?: number;
  };
  wind?: { speed?: number };
  weather?: WeatherCondition[];
  rain?: { "1h"?: number };
  name?: string;
};

type OpenWeatherForecastEntry = {
  dt_txt?: string;
  main?: {
    temp_min?: number;
    temp_max?: number;
  };
  weather?: WeatherCondition[];
  pop?: number;
  rain?: { "3h"?: number };
};

type OpenWeatherForecast = {
  list?: OpenWeatherForecastEntry[];
};

export const normalizeOpenWeather = (input: {
  label: string;
  current: OpenWeatherCurrent;
  forecast: OpenWeatherForecast;
}): NormalizedWeather => {
  const capturedAt = new Date().toISOString();
  const grouped = new Map<string, OpenWeatherForecastEntry[]>();

  for (const entry of input.forecast.list ?? []) {
    const key = sameDayKey(entry.dt_txt ?? capturedAt);
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  const daily: NormalizedWeatherDay[] = Array.from(grouped.entries())
    .slice(0, 5)
    .map(([date, entries]) => {
      const minTempC = Math.min(...entries.map((item) => item.main?.temp_min ?? 0));
      const maxTempC = Math.max(...entries.map((item) => item.main?.temp_max ?? 0));
      const rainProbability = Math.round(
        Math.max(...entries.map((item) => (item.pop ?? 0) * 100))
      );
      const precipitationMm = Number(
        entries.reduce((sum, item) => sum + (item.rain?.["3h"] ?? 0), 0).toFixed(1)
      );
      const summary =
        entries.map((item) => item.weather?.[0]?.description).find(Boolean) ??
        "Mixed conditions";

      return {
        date,
        summary,
        minTempC: Number(minTempC.toFixed(1)),
        maxTempC: Number(maxTempC.toFixed(1)),
        rainProbability,
        precipitationMm,
        isFrostRisk: minTempC <= 1.5
      };
    });

  return {
    source: "openweather",
    capturedAt,
    location: {
      label: input.label || input.current.name || "Current location",
      lat: input.current.coord?.lat ?? 0,
      lon: input.current.coord?.lon ?? 0
    },
    current: {
      summary: input.current.weather?.[0]?.description ?? "Current conditions",
      temperatureC: Number((input.current.main?.temp ?? 0).toFixed(1)),
      humidity: input.current.main?.humidity ?? 0,
      rainProbability: daily[0]?.rainProbability ?? 0,
      precipitationMm: Number((input.current.rain?.["1h"] ?? 0).toFixed(1)),
      windSpeedMps: Number((input.current.wind?.speed ?? 0).toFixed(1)),
      isFrostRisk:
        (daily[0]?.isFrostRisk ?? false) || (input.current.main?.temp ?? 0) <= 1.5
    },
    daily
  };
};
