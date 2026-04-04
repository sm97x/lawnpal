import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiagnosticTurnRequest } from "@lawnpal/core";

const loadRoute = async () => {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL: "gpt-5.4-mini"
    }
  }));

  return import("./route");
};

const buildRequest = (body: DiagnosticTurnRequest | Record<string, unknown>) =>
  new Request("http://localhost:3000/api/ai", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

const basePayload = (): DiagnosticTurnRequest => ({
  userMessage: "This patch appeared recently. The rest of the lawn is healthy.",
  zoneContext: {
    id: "zone_1",
    lawnId: "lawn_1",
    name: "Front lawn",
    exposure: "sunny",
    createdAt: "2026-04-02T09:00:00.000Z",
    sortOrder: 0
  },
  sensorContext: {
    id: "reading_1",
    zoneId: "zone_1",
    provider: "mock",
    scenarioKey: "healthy-lawn",
    takenAt: "2026-04-02T10:00:00.000Z",
    metrics: {
      moisture: 54,
      soilTemperatureC: 11,
      ec: 1.2,
      ph: 6.4,
      lightLux: 15000,
      humidity: 62
    }
  },
  weatherContext: {
    source: "mock",
    capturedAt: "2026-04-02T10:00:00.000Z",
    location: {
      label: "London",
      lat: 51.5,
      lon: -0.12
    },
    current: {
      summary: "Dry and bright",
      temperatureC: 15,
      humidity: 58,
      rainProbability: 10,
      precipitationMm: 0,
      windSpeedMps: 4,
      isFrostRisk: false
    },
    daily: [
      {
        date: "2026-04-02",
        summary: "Dry and bright",
        minTempC: 8,
        maxTempC: 15,
        rainProbability: 10,
        precipitationMm: 0,
        isFrostRisk: false
      },
      {
        date: "2026-04-03",
        summary: "Dry",
        minTempC: 7,
        maxTempC: 16,
        rainProbability: 12,
        precipitationMm: 0,
        isFrostRisk: false
      },
      {
        date: "2026-04-04",
        summary: "Cloudy",
        minTempC: 8,
        maxTempC: 14,
        rainProbability: 18,
        precipitationMm: 0,
        isFrostRisk: false
      }
    ]
  }
});

afterEach(() => {
  vi.doUnmock("@/lib/env");
});

describe("/api/ai", () => {
  it("returns a narrowing follow-up question for a low-confidence case", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      buildRequest({
        ...basePayload(),
        images: [
          {
            id: "img_1",
            createdAt: "2026-04-02T10:00:00.000Z",
            label: "general",
            imageDataUrl: "data:image/jpeg;base64,aGVsbG8td29ybGQtY2xvc2UtdXAtcGF0Y2g="
          }
        ],
        userMessage:
          "This random patch has appeared recently. The rest of the lawn is healthy."
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.updatedState.confidence.shouldAskFollowUp).toBe(true);
    expect(["q-pets", "q-sudden", "q-products"]).toContain(
      body.assistantTurn.followUpQuestions[0]?.id
    );
  });

  it("short-circuits to stop-treatment advice for clear chemical damage", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      buildRequest({
        ...basePayload(),
        userMessage:
          "This irregular patch appeared suddenly after weedkiller and now looks bleached.",
        careEvents: [
          {
            id: "event_1",
            createdAt: "2026-04-02T09:45:00.000Z",
            type: "weedkiller",
            title: "Applied weedkiller"
          }
        ]
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.updatedState.topHypotheses[0]?.id).toBe("weedkiller-damage");
    expect(body.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(body.updatedState.escalationFlags).toContain("stop-extra-treatments");
    expect(body.assistantTurn.doNow[0]).toContain("Stop further spraying");
  });

  it("answers direct coaching questions without forcing a diagnosis follow-up", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      buildRequest({
        ...basePayload(),
        userMessage: "Should I mow this weekend?"
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.updatedState.topHypotheses[0]?.id).toBe("mowing-window");
    expect(body.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(body.assistantTurn.pendingQuestion).toBeUndefined();
  });

  it("rejects malformed payloads cleanly", async () => {
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/userMessage/i);
  });
});
