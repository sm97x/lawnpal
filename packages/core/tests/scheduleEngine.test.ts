import { describe, expect, it } from "vitest";
import { buildMockWeather, generateSchedule, type RecommendationSet } from "../src";

const recommendationSet: RecommendationSet = {
  id: "summary_1",
  readingId: "reading_1",
  zoneId: "zone_1",
  generatedAt: "2026-04-02T10:00:00.000Z",
  lawnStatus: "slightly-stressed",
  lawnScore: 58,
  mainIssue: "This zone is running dry.",
  summary: "The lawn needs a little restraint and better timing this week.",
  interpretation: "Front lawn is running dry",
  recommendations: [
    {
      id: "rec_1",
      title: "Water within the next day",
      explanation: "Moisture is low and there is no useful rain forecast.",
      confidence: "high",
      actionType: "water",
      urgency: "high",
      positive: true,
      idealDateStart: "2026-04-02",
      idealDateEnd: "2026-04-03",
      sourceRules: ["moisture-low"]
    }
  ],
  issues: ["This zone is running dry."],
  highlights: [],
  doNow: ["Water within the next day"],
  avoid: [],
  checkAgainAt: "2026-04-05T10:00:00.000Z"
};

describe("schedule engine", () => {
  it("turns recommendations into rolling tasks", () => {
    const tasks = generateSchedule({
      recommendationSet,
      weather: buildMockWeather({ lat: 51.5, lon: -0.1, label: "London" })
    });

    expect(tasks.some((item) => item.title === "Water lightly")).toBe(true);
    expect(tasks.some((item) => item.title === "Check the lawn again")).toBe(true);
  });
});
