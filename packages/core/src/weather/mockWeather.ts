import type { NormalizedWeather } from "../types";
import { addDays } from "../utils/date";

export const buildMockWeather = (input: {
  lat: number;
  lon: number;
  label: string;
  baseDate?: string;
}): NormalizedWeather => {
  const capturedAt = input.baseDate ?? new Date().toISOString();
  return {
    source: "mock",
    capturedAt,
    location: {
      label: input.label,
      lat: input.lat,
      lon: input.lon
    },
    current: {
      summary: "Dry spells with bright intervals",
      temperatureC: 12,
      humidity: 64,
      rainProbability: 20,
      precipitationMm: 0.1,
      windSpeedMps: 3.8,
      isFrostRisk: false
    },
    daily: Array.from({ length: 5 }).map((_, index) => ({
      date: addDays(capturedAt, index).slice(0, 10),
      summary:
        index === 1
          ? "Light showers late afternoon"
          : index === 3
            ? "Brighter with a mild breeze"
            : "Mostly dry",
      minTempC: index === 0 ? 6 : 7 + index,
      maxTempC: 12 + index,
      rainProbability: index === 1 ? 62 : 18 + index * 6,
      precipitationMm: index === 1 ? 3.6 : Number((0.3 * index).toFixed(1)),
      isFrostRisk: index === 0
    }))
  };
};
