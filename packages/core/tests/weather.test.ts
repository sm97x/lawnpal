import { describe, expect, it } from "vitest";
import { normalizeOpenWeather } from "../src";

describe("weather normalisation", () => {
  it("parses current weather and forecast into a normalized shape", () => {
    const normalized = normalizeOpenWeather({
      label: "Leeds",
      current: {
        coord: { lat: 53.8, lon: -1.55 },
        main: { temp: 11.4, humidity: 71 },
        wind: { speed: 4.2 },
        weather: [{ description: "light rain" }],
        rain: { "1h": 0.7 },
        name: "Leeds"
      },
      forecast: {
        list: [
          {
            dt_txt: "2026-04-02 12:00:00",
            main: { temp_min: 8.1, temp_max: 11.8 },
            weather: [{ description: "light rain" }],
            pop: 0.54,
            rain: { "3h": 1.1 }
          },
          {
            dt_txt: "2026-04-03 12:00:00",
            main: { temp_min: 6.2, temp_max: 13.1 },
            weather: [{ description: "cloudy" }],
            pop: 0.22,
            rain: { "3h": 0 }
          }
        ]
      }
    });

    expect(normalized.location.label).toBe("Leeds");
    expect(normalized.daily[0]?.rainProbability).toBe(54);
    expect(normalized.current.summary).toBe("light rain");
  });
});
