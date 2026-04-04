import { describe, expect, it } from "vitest";
import {
  buildMockWeather,
  runDiagnosticTurn,
  type LawnProfile,
  type SensorReading,
  type Zone
} from "../src";

const lawnProfile: LawnProfile = {
  grassStyle: "hard-wearing",
  soilType: "loam"
};

const zone: Zone = {
  id: "zone_front",
  lawnId: "lawn_1",
  name: "Front lawn",
  exposure: "sunny",
  createdAt: "2026-04-04T09:00:00.000Z",
  sortOrder: 0
};

const weather = buildMockWeather({
  lat: 51.5,
  lon: -0.12,
  label: "Bedfordshire"
});

const reading = (metrics: Partial<SensorReading["metrics"]> = {}): SensorReading => ({
  id: "reading_1",
  zoneId: zone.id,
  provider: "mock",
  scenarioKey: "eval",
  takenAt: "2026-04-04T09:00:00.000Z",
  metrics: {
    moisture: 55,
    soilTemperatureC: 11,
    ec: 1.3,
    ph: 6.4,
    lightLux: 14000,
    humidity: 68,
    ...metrics
  }
});

describe("diagnostic coaching routing", () => {
  it("answers mowing timing directly without forcing diagnosis", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "Should I mow this weekend?",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading({ moisture: 52 })
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("mowing-window");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(response.assistantTurn.pendingQuestion).toBeUndefined();
    expect(response.assistantTurn.message.toLowerCase()).toContain("mow");
  });

  it("answers feeding timing directly from soil warmth and weather", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "Can I feed the lawn now?",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading({ soilTemperatureC: 12, moisture: 50 }),
        lawnProfile
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("feeding-window");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(response.assistantTurn.pendingQuestion).toBeUndefined();
  });

  it("answers seeding timing directly instead of drifting into diagnosis", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "Can I overseed now?",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading({ soilTemperatureC: 9 }),
        lawnProfile
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("seeding-window");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
  });

  it("treats weekend planning as a coaching answer, not a diagnosis intake", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "What should I do with the lawn this weekend?",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading({ moisture: 47 }),
        lawnProfile
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("weekend-plan");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(response.case.summary.toLowerCase()).toContain("weather");
  });

  it("handles treatment safety as label-first guidance", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "Can kids use the lawn after weedkiller?",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading(),
        careEvents: [
          {
            id: "event_1",
            createdAt: "2026-04-04T08:00:00.000Z",
            type: "weedkiller",
            title: "Applied weedkiller"
          }
        ]
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("treatment-safety");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(response.assistantTurn.message.toLowerCase()).toContain("label");
  });

  it("answers zone comparison questions without opening a diagnosis tree", () => {
    const response = runDiagnosticTurn({
      request: {
        userMessage: "The back lawn stays wetter than the front lawn. What does that mean?",
        requestedMode: "compare-zone",
        zoneContext: zone,
        weatherContext: weather,
        sensorContext: reading({ moisture: 70 }),
        historyContext: {
          zoneTrendSummaries: ["This zone has been wetter than usual for 10 days."],
          siblingZoneInsights: ["Back lawn has recently been wetter than this zone."]
        }
      }
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("zone-comparison-insight");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
  });
});
