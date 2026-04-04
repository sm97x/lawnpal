import {
  normalizeOpenWeather,
  type NormalizedWeather,
  type WeatherProvider
} from "@lawnpal/core";
import { env } from "./env";

const assertApiKey = () => {
  if (!env.OPENWEATHER_API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is missing.");
  }
};

export class OpenWeatherProvider implements WeatherProvider {
  readonly kind = "openweather" as const;

  async getForecast(input: {
    lat: number;
    lon: number;
    label: string;
  }): Promise<NormalizedWeather> {
    assertApiKey();

    const params = `lat=${input.lat}&lon=${input.lon}&units=metric&appid=${env.OPENWEATHER_API_KEY}`;

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${params}`)
    ]);

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error("OpenWeather request failed.");
    }

    const [current, forecast] = await Promise.all([currentResponse.json(), forecastResponse.json()]);

    return normalizeOpenWeather({
      label: input.label,
      current,
      forecast
    });
  }

  async geocode(postcode: string): Promise<{ lat: number; lon: number; label: string }> {
    assertApiKey();
    const query = encodeURIComponent(postcode);
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${env.OPENWEATHER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error("Unable to geocode postcode.");
    }

    const results = (await response.json()) as Array<{
      lat: number;
      lon: number;
      name: string;
      state?: string;
      country?: string;
    }>;
    const first = results[0];

    if (!first) {
      throw new Error("No result for that postcode.");
    }

    return {
      lat: first.lat,
      lon: first.lon,
      label: [first.name, first.state, first.country].filter(Boolean).join(", ")
    };
  }
}
