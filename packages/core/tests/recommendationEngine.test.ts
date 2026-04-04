import { describe, expect, it } from "vitest";
import {
  buildMockWeather,
  generateRecommendations,
  makeId,
  type LawnProfile,
  type SensorReading,
  type Zone
} from "../src";

const profile: LawnProfile = {
  grassStyle: "hard-wearing",
  soilType: "loam"
};

const zone: Zone = {
  id: "zone_front",
  lawnId: "lawn_1",
  name: "Front lawn",
  exposure: "sunny",
  createdAt: "2026-04-02T08:00:00.000Z",
  sortOrder: 0
};

const buildReading = (overrides: Partial<SensorReading["metrics"]>): SensorReading => ({
  id: makeId("reading"),
  zoneId: zone.id,
  provider: "mock",
  scenarioKey: "too-wet",
  takenAt: "2026-04-02T09:00:00.000Z",
  metrics: {
    moisture: 82,
    soilTemperatureC: 9,
    ec: 1.4,
    ph: 6.1,
    lightLux: 4500,
    humidity: 86,
    ...overrides
  }
});

describe("recommendation engine", () => {
  it("flags a very wet lawn and avoids watering", () => {
    const reading = buildReading({});
    const result = generateRecommendations({
      reading,
      zone,
      weather: buildMockWeather({ lat: 51.5, lon: -0.1, label: "London" }),
      profile,
      recentZoneReadings: [reading],
      allRecentReadings: [reading],
      siblingZones: []
    });

    expect(result.mainIssue).toContain("moisture");
    expect(
      result.recommendations.some((item) => item.title === "Too wet — do not water this week")
    ).toBe(true);
    expect(result.avoid.some((item) => item.toLowerCase().includes("water"))).toBe(true);
  });

  it("recommends watering when dry and rain is not coming", () => {
    const reading = buildReading({
      moisture: 24,
      soilTemperatureC: 13,
      ec: 1.1,
      lightLux: 18000,
      humidity: 42
    });
    const weather = buildMockWeather({ lat: 51.5, lon: -0.1, label: "London" });
    weather.daily = weather.daily.map((day) => ({ ...day, rainProbability: 10, precipitationMm: 0 }));

    const result = generateRecommendations({
      reading,
      zone,
      weather,
      profile,
      recentZoneReadings: [reading],
      allRecentReadings: [reading],
      siblingZones: []
    });

    expect(result.recommendations.some((item) => item.title === "Water within the next day")).toBe(
      true
    );
    expect(result.doNow.length).toBeGreaterThan(0);
  });
});
