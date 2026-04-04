import { buildMockWeather, type NormalizedWeather } from "@lawnpal/core";
import { z } from "zod";
import { env } from "../env";
import type { StoredLocation } from "../types";

const weatherSchema: z.ZodType<NormalizedWeather> = z.object({
  source: z.union([z.literal("openweather"), z.literal("mock")]),
  capturedAt: z.string(),
  location: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number()
  }),
  current: z.object({
    summary: z.string(),
    temperatureC: z.number(),
    humidity: z.number(),
    rainProbability: z.number(),
    precipitationMm: z.number(),
    windSpeedMps: z.number(),
    isFrostRisk: z.boolean()
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      summary: z.string(),
      minTempC: z.number(),
      maxTempC: z.number(),
      rainProbability: z.number(),
      precipitationMm: z.number(),
      isFrostRisk: z.boolean()
    })
  )
});

const geocodeSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  label: z.string()
});

export const weatherService = {
  async fetchForecast(location: StoredLocation): Promise<NormalizedWeather> {
    if (env.useMockWeather) {
      return buildMockWeather(location);
    }

    const query = new URLSearchParams({
      lat: String(location.lat),
      lon: String(location.lon),
      label: location.label
    });
    let response: Response;
    try {
      response = await fetch(`${env.apiBaseUrl}/api/weather?${query.toString()}`);
    } catch {
      throw new Error("Unable to reach the weather service.");
    }

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => null as { error?: string } | null);
      throw new Error(errorPayload?.error ?? "Unable to fetch weather.");
    }

    return weatherSchema.parse(await response.json());
  },

  async geocodePostcode(postcode: string): Promise<StoredLocation> {
    const query = new URLSearchParams({ postcode });
    let response: Response;
    try {
      response = await fetch(`${env.apiBaseUrl}/api/geocode?${query.toString()}`);
    } catch {
      throw new Error("Unable to reach the postcode service.");
    }

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => null as { error?: string } | null);
      throw new Error(errorPayload?.error ?? "Unable to locate that postcode.");
    }

    const result = geocodeSchema.parse(await response.json());
    return {
      ...result,
      postcode,
      source: "postcode"
    };
  }
};
