import { describe, expect, it } from "vitest";
import {
  buildMockWeather,
  runDiagnosticTurn,
  type DiagnosticImageObservation,
  type DiagnosticSignalKey,
  type DiagnosticTurnRequest,
  type LawnProfile,
  type SensorReading,
  type Zone
} from "../src";

const lawnProfile: LawnProfile = {
  grassStyle: "ornamental",
  soilType: "clay"
};

const weather = buildMockWeather({ lat: 51.5, lon: -0.12, label: "Bedfordshire" });

const sunnyZone: Zone = {
  id: "zone_front",
  lawnId: "lawn_1",
  name: "Front lawn",
  exposure: "sunny",
  createdAt: "2026-04-03T09:00:00.000Z",
  sortOrder: 0
};

const backZone: Zone = {
  ...sunnyZone,
  id: "zone_back",
  name: "Back lawn",
  exposure: "mixed",
  sortOrder: 1
};

const shadeZone: Zone = {
  ...sunnyZone,
  id: "zone_shade",
  name: "Shady side lawn",
  exposure: "shade",
  sortOrder: 2
};

const observation = (
  observedSignals: DiagnosticSignalKey[],
  summary = "Structured image clues extracted from the lawn photo."
): DiagnosticImageObservation => ({
  summary,
  observedSignals,
  notes: [],
  confidence: observedSignals.length >= 3 ? "high" : "medium",
  recommendedAdditionalImages: []
});

const createReading = (
  zone: Zone,
  metrics: Partial<SensorReading["metrics"]>,
  id: string
): SensorReading => ({
  id,
  zoneId: zone.id,
  provider: "mock",
  scenarioKey: "eval",
  takenAt: "2026-04-03T09:00:00.000Z",
  metrics: {
    moisture: 58,
    soilTemperatureC: 11,
    ec: 1.3,
    ph: 6.2,
    lightLux: 12000,
    humidity: 68,
    ...metrics
  }
});

const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T,>(random: () => number, values: T[]) =>
  values[Math.floor(random() * values.length)] ?? values[0]!;

const buildRequest = (
  zone: Zone,
  reading: SensorReading,
  overrides: Partial<DiagnosticTurnRequest> = {}
): DiagnosticTurnRequest => ({
  userMessage: "This patch looks wrong.",
  zoneContext: zone,
  weatherContext: weather,
  sensorContext: reading,
  lawnProfile,
  ...overrides
});

describe("diagnostic simulation harness", () => {
  it("stops promptly for dog-urine cases across 1,024 varied conversations", () => {
    let confirmedStops = 0;

    for (let index = 0; index < 1024; index += 1) {
      const random = seeded(1000 + index);
      const zone = pick(random, [sunnyZone, backZone, shadeZone]);
      const reading = createReading(
        zone,
        {
          moisture: 45 + Math.round(random() * 40),
          lightLux: zone.id === shadeZone.id ? 4200 + Math.round(random() * 3200) : 7000 + Math.round(random() * 9000),
          ph: 5.7 + random() * 0.9,
          humidity: 62 + Math.round(random() * 24)
        },
        `reading_dog_${index}`
      );

      const opening = pick(random, [
        "This random patch appeared recently. The rest of the lawn is healthy.",
        "This one patch came up over a few days and everywhere else looks fine.",
        "This isolated patch looks scorched but the rest of the lawn is healthy.",
        "This patch has appeared recently and the rest of the lawn still looks good."
      ]);
      const openingObservation = observation(
        [
          "isolated_patch",
          "rest_of_lawn_healthy",
          "scorched_centre",
          random() > 0.35 ? "sudden_appearance" : "random_irregular_patch"
        ],
        "One isolated scorched patch with healthier grass around it."
      );

      const firstTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          userMessage: opening
        }),
        imageObservation: openingObservation
      });

      expect(firstTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
      expect(firstTurn.assistantTurn.pendingQuestion?.id).toBe("q-pets");

      const secondTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          caseId: firstTurn.case.id,
          userMessage: "Yes, we have a dog.",
          replyToQuestionId: "q-pets",
          quickReplyValue: "pet_presence",
          historyContext: {
            currentCaseState: firstTurn.updatedState
          }
        }),
        imageObservation: openingObservation
      });

      expect(secondTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
      expect(["q-recent-wee", "q-dog-route"]).toContain(secondTurn.assistantTurn.pendingQuestion?.id);

      const confirmingQuestionId = secondTurn.assistantTurn.pendingQuestion?.id;
      const quickReplyValue =
        confirmingQuestionId === "q-dog-route" ? "dog_route" : "recent_pet_wee";
      const replyText =
        quickReplyValue === "dog_route"
          ? "Yes, that is where the dog usually stops."
          : "Yes, the dog wee'd there recently.";

      const thirdTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          caseId: secondTurn.case.id,
          userMessage: replyText,
          replyToQuestionId: confirmingQuestionId,
          quickReplyValue,
          historyContext: {
            currentCaseState: secondTurn.updatedState
          }
        }),
        imageObservation: openingObservation
      });

      expect(thirdTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
      expect(thirdTurn.updatedState.issueFamily).toBe("patch");
      expect(thirdTurn.updatedState.confidence.resolved).toBe(true);
      expect(thirdTurn.updatedState.confidence.shouldAskFollowUp).toBe(false);
      expect(thirdTurn.assistantTurn.pendingQuestion).toBeUndefined();
      expect(thirdTurn.case.stage).toBe("confident");
      confirmedStops += 1;
    }

    expect(confirmedStops).toBe(1024);
  }, 30000);

  it("keeps shaded and wet background context from hijacking isolated scorch cases across 1,024 variants", () => {
    let nonShadeLeads = 0;

    for (let index = 0; index < 1024; index += 1) {
      const random = seeded(3000 + index);
      const zone = pick(random, [backZone, shadeZone]);
      const reading = createReading(
        zone,
        {
          moisture: 70 + Math.round(random() * 18),
          lightLux: zone.id === shadeZone.id ? 3800 + Math.round(random() * 2600) : 5200 + Math.round(random() * 2600),
          ph: 5.6 + random() * 0.5,
          humidity: 74 + Math.round(random() * 18)
        },
        `reading_drift_${index}`
      );

      const openingObservation = observation(
        ["isolated_patch", "rest_of_lawn_healthy", "scorched_centre", "sudden_appearance"],
        "One isolated scorched patch with no obvious broad thinning."
      );

      const firstTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          userMessage:
            "This single patch appeared suddenly. The rest of the lawn is healthy and it looks burnt."
        }),
        imageObservation: openingObservation
      });

      const secondTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          caseId: firstTurn.case.id,
          userMessage: "Yes, we have a dog and this is probably where she wee'd.",
          replyToQuestionId: "q-pets",
          quickReplyValue: "pet_presence",
          historyContext: {
            currentCaseState: firstTurn.updatedState
          }
        }),
        imageObservation: openingObservation
      });

      const thirdTurn = runDiagnosticTurn({
        request: buildRequest(zone, reading, {
          caseId: secondTurn.case.id,
          userMessage: "Yes, it is where she usually goes.",
          replyToQuestionId: secondTurn.assistantTurn.pendingQuestion?.id,
          quickReplyValue:
            secondTurn.assistantTurn.pendingQuestion?.id === "q-dog-route"
              ? "dog_route"
              : "recent_pet_wee",
          historyContext: {
            currentCaseState: secondTurn.updatedState
          }
        }),
        imageObservation: openingObservation
      });

      expect(thirdTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
      expect(thirdTurn.updatedState.topHypotheses[0]?.issueFamily).toBe("patch");
      expect(thirdTurn.updatedState.topHypotheses[0]?.id).not.toBe("shade-weakness");
      nonShadeLeads += 1;
    }

    expect(nonShadeLeads).toBe(1024);
  }, 30000);
});
