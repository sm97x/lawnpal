import { describe, expect, it } from "vitest";
import { migrateLegacyAiAskEntry } from "./diagnosticMigration";

describe("diagnostic migration", () => {
  it("turns a legacy AI Ask row into an archived diagnostic case thread", () => {
    const migrated = migrateLegacyAiAskEntry({
      id: "ask_1",
      createdAt: "2026-04-02T10:00:00.000Z",
      question: "Why is this patch yellow?",
      payload: {
        question: "Why is this patch yellow?",
        imageDataUrl: "data:image/jpeg;base64,aGVsbG8td29ybGQtY2xvc2UtdXAtcGF0Y2g=",
        zone: {
          id: "zone_1",
          lawnId: "lawn_1",
          name: "Front lawn",
          exposure: "sunny",
          createdAt: "2026-04-02T09:00:00.000Z",
          sortOrder: 0
        },
        latestReading: {
          id: "reading_1",
          zoneId: "zone_1",
          provider: "mock",
          scenarioKey: "too-dry",
          takenAt: "2026-04-02T10:00:00.000Z",
          metrics: {
            moisture: 28,
            soilTemperatureC: 12,
            ec: 1.1,
            ph: 6.3,
            lightLux: 14500,
            humidity: 48
          }
        },
        weather: {
          source: "mock",
          capturedAt: "2026-04-02T10:00:00.000Z",
          location: {
            label: "London",
            lat: 51.5,
            lon: -0.12
          },
          current: {
            summary: "Dry",
            temperatureC: 14,
            humidity: 48,
            rainProbability: 12,
            precipitationMm: 0,
            windSpeedMps: 3,
            isFrostRisk: false
          },
          daily: [
            {
              date: "2026-04-02",
              summary: "Dry",
              minTempC: 8,
              maxTempC: 14,
              rainProbability: 12,
              precipitationMm: 0,
              isFrostRisk: false
            }
          ]
        },
        recentRecommendations: []
      },
      response: {
        answer: "The patch is stressed but not yet narrowed to one cause.",
        confidenceNote: "Low confidence",
        suggestedActions: ["Watch the area", "Avoid strong treatment"],
        disclaimer: "Legacy advisory only."
      }
    });

    expect(migrated.caseItem.id).toBe("legacy_ask_1");
    expect(migrated.caseItem.archived).toBe(true);
    expect(migrated.caseItem.legacyImported).toBe(true);
    expect(migrated.messages).toHaveLength(2);
    expect(migrated.messages[0]?.role).toBe("user");
    expect(migrated.messages[1]?.role).toBe("assistant");
    expect(migrated.snapshot.topHypotheses[0]?.id).toBe("other-stress");
    expect(migrated.snapshot.uploadedImages).toHaveLength(1);
    expect(migrated.snapshot.currentActionPlan.doNow).toContain("Watch the area");
  });
});
