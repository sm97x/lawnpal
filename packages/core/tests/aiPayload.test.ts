import { describe, expect, it } from "vitest";
import { buildAiAskContextText, buildAiAskOpenAIRequest, type AiAskPayload } from "../src";

const payload: AiAskPayload = {
  question: "Why is the back lawn looking patchy?",
  imageDataUrl: "data:image/jpeg;base64,abc123",
  zone: {
    id: "zone_back",
    lawnId: "lawn_1",
    name: "Back lawn",
    exposure: "shade",
    createdAt: "2026-04-02T09:00:00.000Z",
    sortOrder: 1
  },
  latestReading: {
    id: "reading_1",
    zoneId: "zone_back",
    provider: "mock",
    scenarioKey: "moss-risk",
    takenAt: "2026-04-02T09:00:00.000Z",
    metrics: {
      moisture: 80,
      soilTemperatureC: 8.5,
      ec: 1.2,
      ph: 5.7,
      lightLux: 3200,
      humidity: 88
    }
  },
  recentRecommendations: [
    {
      id: "rec_1",
      title: "High moss risk",
      explanation: "Wet soil and low light are favouring moss in this zone.",
      confidence: "high",
      actionType: "moss",
      urgency: "high",
      sourceRules: ["moss-risk-combo"]
    }
  ]
};

describe("ai payload", () => {
  it("builds a context-rich text prompt", () => {
    const text = buildAiAskContextText(payload);
    expect(text).toContain("Back lawn");
    expect(text).toContain("Moisture");
    expect(text).toContain("High moss risk");
  });

  it("builds multimodal responses input", () => {
    const request = buildAiAskOpenAIRequest(payload);
    expect(request.input[0]!.content).toHaveLength(2);
  });
});
