import { describe, expect, it } from "vitest";
import {
  buildMockWeather,
  extractDiagnosticSignals,
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
  createdAt: "2026-04-04T09:00:00.000Z",
  sortOrder: 0
};

const mixedZone: Zone = {
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

const zones = [sunnyZone, mixedZone, shadeZone] as const;

const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T,>(random: () => number, values: readonly T[]) =>
  values[Math.floor(random() * values.length)] ?? values[0]!;

const observation = (
  observedSignals: DiagnosticSignalKey[],
  summary = "Structured image clues extracted from the uploaded lawn photo."
): DiagnosticImageObservation => ({
  summary,
  observedSignals,
  notes: [],
  confidence: observedSignals.length >= 3 ? "high" : "medium",
  recommendedAdditionalImages: []
});

const createReading = (
  zone: Zone,
  id: string,
  metrics: Partial<SensorReading["metrics"]> = {}
): SensorReading => ({
  id,
  zoneId: zone.id,
  provider: "mock",
  scenarioKey: "eval",
  takenAt: "2026-04-04T09:00:00.000Z",
  metrics: {
    moisture: 56,
    soilTemperatureC: 11,
    ec: 1.3,
    ph: 6.2,
    lightLux: zone.exposure === "shade" ? 5400 : 14000,
    humidity: 68,
    ...metrics
  }
});

const baseRequest = (
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

const runSignals = (
  userMessage: string,
  zone: Zone = sunnyZone,
  reading: SensorReading = createReading(zone, "signal_probe")
) =>
  extractDiagnosticSignals({
    request: baseRequest(zone, reading, {
      userMessage
    })
  });

describe("diagnostic research evals", () => {
  it("survives 1,792 lexical and parser fuzz variants without spurious high-value signals", () => {
    const wrappers = [
      (text: string) => text,
      (text: string) => `Please help: ${text}`,
      (text: string) => `${text} Thanks.`,
      (text: string) => `Photo note - ${text}`,
      (text: string) => `Honestly, ${text.toLowerCase()}`,
      (text: string) => `Quick note: ${text}`
    ] as const;

    const cases = [
      {
        variants: [
          "Something seems wrong here.",
          "Something looks off in this area.",
          "Something does not look right here."
        ],
        expectPresent: [] as DiagnosticSignalKey[],
        expectAbsent: ["thin_shaded_grass", "isolated_patch", "ring_pattern", "recent_pet_wee"] as DiagnosticSignalKey[]
      },
      {
        variants: [
          "This lawn patch keeps widening in dry weather.",
          "The patch is gradually widening during dry spells.",
          "It keeps getting wider when the weather is dry."
        ],
        expectPresent: ["gradual_spread", "dry_area"] as DiagnosticSignalKey[],
        expectAbsent: ["ring_pattern"] as DiagnosticSignalKey[]
      },
      {
        variants: [
          "I used weedkiller and now this patch is pale.",
          "After weedkiller, this area yellowed quickly.",
          "This patch bleached after I sprayed weed killer."
        ],
        expectPresent: ["recent_weedkiller"] as DiagnosticSignalKey[],
        expectAbsent: ["recent_pet_wee"] as DiagnosticSignalKey[]
      },
      {
        variants: [
          "This patch is sparse in shade.",
          "The grass is thin in this shady corner.",
          "It looks sparse and shady under the hedge."
        ],
        expectPresent: ["thin_shaded_grass", "low_light"] as DiagnosticSignalKey[],
        expectAbsent: [] as DiagnosticSignalKey[]
      },
      {
        variants: [
          "This is a circular ring with mushrooms.",
          "There is a circular patch and mushrooms keep appearing.",
          "It forms a ring and mushrooms are showing."
        ],
        expectPresent: ["ring_pattern", "mushrooms_present"] as DiagnosticSignalKey[],
        expectAbsent: [] as DiagnosticSignalKey[]
      },
      {
        variants: [
          "Our dog uses this spot and the patch is burnt.",
          "The dog wees here and one patch has come up burnt.",
          "This is where the dog goes and the patch looks scorched."
        ],
        expectPresent: ["pet_presence", "dog_route"] as DiagnosticSignalKey[],
        expectAbsent: [] as DiagnosticSignalKey[]
      }
    ] as const;

    let assertions = 0;

    for (const testCase of cases) {
      for (const variant of testCase.variants) {
        for (const wrap of wrappers) {
          const result = runSignals(wrap(variant), variant.includes("shade") ? shadeZone : sunnyZone);
          for (const signal of testCase.expectPresent) {
            expect(result.presentSignals.has(signal)).toBe(true);
            assertions += 1;
          }
          for (const signal of testCase.expectAbsent) {
            expect(result.presentSignals.has(signal)).toBe(false);
            assertions += 1;
          }
        }
      }
    }

    expect(assertions).toBeGreaterThanOrEqual(216);

    for (let index = 0; index < 256; index += 1) {
      const random = seeded(90000 + index);
      const vagueLead = pick(random, ["Something", "Anything", "Nothing obvious"]);
      const fuzzyMessage = `${vagueLead} seems wrong here, but I cannot explain it.`;
      const signalResult = runSignals(fuzzyMessage, pick(random, zones));
      expect(signalResult.presentSignals.has("thin_shaded_grass")).toBe(false);
      expect(signalResult.presentSignals.has("ring_pattern")).toBe(false);
      expect(signalResult.presentSignals.has("recent_pet_wee")).toBe(false);
      assertions += 3;

      const wideningMessage = `This area keeps widening slightly in dry weather ${index}.`;
      const wideningResult = runSignals(wideningMessage, sunnyZone);
      expect(wideningResult.presentSignals.has("gradual_spread")).toBe(true);
      expect(wideningResult.presentSignals.has("ring_pattern")).toBe(false);
      assertions += 2;

      const weedkillerMessage = `Weedkiller went down last week and patch ${index} turned pale.`;
      const weedkillerResult = runSignals(weedkillerMessage, sunnyZone);
      expect(weedkillerResult.presentSignals.has("recent_weedkiller")).toBe(true);
      expect(weedkillerResult.presentSignals.has("pet_presence")).toBe(false);
      expect(weedkillerResult.presentSignals.has("recent_pet_wee")).toBe(false);
      assertions += 3;
    }

    expect(assertions).toBeGreaterThanOrEqual(1792);
  }, 30000);

  it("keeps one-question discipline and asks relevant follow-ups across 1,280 ambiguous starts", () => {
    const families = [
      {
        name: "dog urine",
        messageVariants: [
          "This random patch appeared recently and the rest of the lawn is healthy.",
          "One patch has come up quickly while everywhere else looks fine."
        ],
        zone: mixedZone,
        buildReading: (iteration: number) =>
          createReading(mixedZone, `amb_dog_${iteration}`, {
            moisture: 48 + (iteration % 12)
          }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"]),
        firstAllowed: ["q-pets"],
        secondAllowed: ["q-recent-wee", "q-dog-route"],
        answerFirstQuestion: () => ({
          userMessage: "Yes, we have a dog.",
          quickReplyValue: "pet_presence"
        })
      },
      {
        name: "object scorch",
        messageVariants: [
          "One neat patch appeared suddenly and I cannot tell why.",
          "A very regular patch came up quickly."
        ],
        zone: sunnyZone,
        buildReading: (iteration: number) => createReading(sunnyZone, `amb_object_${iteration}`),
        imageObservation: observation(["isolated_patch", "uniform_object_shape", "sudden_appearance"]),
        firstAllowed: ["q-object", "q-pets"],
        secondAllowed: ["q-object"],
        answerFirstQuestion: (questionId: string | undefined) => ({
          userMessage:
            questionId === "q-pets" ? "No pets." : "Yes, a paddling pool was sitting there.",
          quickReplyValue:
            questionId === "q-pets" ? "no_pet_presence" : "under_object"
        })
      },
      {
        name: "pest",
        messageVariants: [
          "Birds are pecking at this patch and I think something is happening underneath.",
          "Birds keep attacking this patch and it feels weak."
        ],
        zone: mixedZone,
        buildReading: (iteration: number) => createReading(mixedZone, `amb_pest_${iteration}`),
        imageObservation: observation(["birds_pecking"]),
        firstAllowed: ["q-birds", "q-lift"],
        secondAllowed: ["q-lift", "q-birds"],
        answerFirstQuestion: (questionId: string | undefined) => ({
          userMessage:
            questionId === "q-birds"
              ? "Yes, birds are pecking at it."
              : "Yes, the turf lifts easily and there is bare soil underneath.",
          quickReplyValue:
            questionId === "q-birds" ? "birds_pecking" : "turf_lifts_easily"
        })
      },
      {
        name: "soil health",
        messageVariants: [
          "This area has historically underperformed and the pH reading looks acidic.",
          "The same area keeps struggling and the pH reading is on the acidic side."
        ],
        zone: shadeZone,
        buildReading: (iteration: number) =>
          createReading(shadeZone, `amb_soil_${iteration}`, {
            ph: 5.1 + ((iteration % 4) * 0.05),
            lightLux: 4300 + ((iteration % 6) * 120)
        }),
        imageObservation: undefined,
        firstAllowed: ["q-tree", "q-products", "q-closeup"],
        secondAllowed: ["q-tree", "q-products", "q-closeup", "q-wet"],
        answerFirstQuestion: (questionId: string | undefined) => ({
          userMessage:
            questionId === "q-tree"
              ? "No, it is fairly open."
              : questionId === "q-products"
                ? "No products recently."
                : "I can add more photos.",
          quickReplyValue:
            questionId === "q-tree"
              ? "no_tree_shade"
              : questionId === "q-products"
                ? "no_recent_products"
                : "request_more_photos"
        })
      },
      {
        name: "dry spread",
        messageVariants: [
          "This lawn patch keeps gradually widening in dry weather.",
          "It spreads slowly each dry spell rather than appearing overnight."
        ],
        zone: sunnyZone,
        buildReading: (iteration: number) =>
          createReading(sunnyZone, `amb_dry_${iteration}`, {
            moisture: 24 + (iteration % 6),
            humidity: 42 + (iteration % 8)
        }),
        imageObservation: observation(["dry_area", "gradual_spread"]),
        firstAllowed: ["q-dry", "q-tree", "q-sudden"],
        secondAllowed: ["q-dry", "q-tree", "q-sudden", "q-closeup"],
        answerFirstQuestion: (questionId: string | undefined) => ({
          userMessage:
            questionId === "q-tree"
              ? "No, it is fairly open."
              : questionId === "q-sudden"
                ? "No, it has gradually spread."
                : "Yes, the soil stays dry there.",
          quickReplyValue:
            questionId === "q-tree"
              ? "no_tree_shade"
              : questionId === "q-sudden"
                ? "gradual_spread"
                : "dry_soil"
        })
      }
    ] as const;

    let assertions = 0;

    for (const [familyIndex, family] of families.entries()) {
      for (let iteration = 0; iteration < 256; iteration += 1) {
        const random = seeded((familyIndex + 1) * 110000 + iteration);
        const opening = runDiagnosticTurn({
          request: baseRequest(family.zone, family.buildReading(iteration), {
            userMessage: pick(random, family.messageVariants)
          }),
          imageObservation: family.imageObservation
        });

        expect(opening.assistantTurn.followUpQuestions.length).toBeLessThanOrEqual(1);
        expect(opening.assistantTurn.pendingQuestion?.id).toBe(opening.assistantTurn.followUpQuestions[0]?.id);
        expect(family.firstAllowed).toContain(opening.assistantTurn.pendingQuestion?.id);
        assertions += 3;

        const second = runDiagnosticTurn({
          request: baseRequest(family.zone, family.buildReading(iteration), {
            caseId: opening.case.id,
            userMessage: family.answerFirstQuestion(opening.assistantTurn.pendingQuestion?.id).userMessage,
            replyToQuestionId: opening.assistantTurn.pendingQuestion?.id,
            quickReplyValue:
              family.answerFirstQuestion(opening.assistantTurn.pendingQuestion?.id).quickReplyValue,
            historyContext: {
              currentCaseState: opening.updatedState
            }
          }),
          imageObservation: family.imageObservation
        });

        expect(second.assistantTurn.followUpQuestions.length).toBeLessThanOrEqual(1);
        if (second.assistantTurn.pendingQuestion) {
          expect(family.secondAllowed).toContain(second.assistantTurn.pendingQuestion.id);
          expect(second.assistantTurn.pendingQuestion.id).not.toBe(opening.assistantTurn.pendingQuestion?.id);
          assertions += 2;
        } else {
          assertions += 1;
        }
      }
    }

    expect(assertions).toBeGreaterThanOrEqual(5120);
  }, 30000);

  it("resolves broad diagnostic branches within bounded turns across 2,304 simulated conversations", () => {
    type ResolvableCase = {
      name: string;
      expectedTop: string;
      buildOpening: (iteration: number) => {
        zone: Zone;
        reading: SensorReading;
        request: Partial<DiagnosticTurnRequest>;
        imageObservation?: DiagnosticImageObservation;
      };
      answerTurn: (
        pendingQuestionId: string | undefined,
        iteration: number
      ) => {
        userMessage: string;
        quickReplyValue?: string;
        imageObservation?: DiagnosticImageObservation;
      };
      maxTurns: number;
    };

    const cases: ResolvableCase[] = [
      {
        name: "dog urine",
        expectedTop: "dog-urine",
        buildOpening: (iteration) => ({
          zone: pick(seeded(120000 + iteration), zones),
          reading: createReading(pick(seeded(120000 + iteration), zones), `res_dog_${iteration}`, {
            moisture: 50 + (iteration % 10)
          }),
          request: {
            userMessage: "This random patch appeared recently and the rest of the lawn is healthy."
          },
          imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"])
        }),
        answerTurn: (pendingQuestionId) => ({
          userMessage:
            pendingQuestionId === "q-pets"
              ? "Yes, we have a dog."
              : pendingQuestionId === "q-dog-route"
                ? "Yes, this is where the dog usually stops."
                : "Yes, the dog wee'd there recently.",
          quickReplyValue:
            pendingQuestionId === "q-pets"
              ? "pet_presence"
              : pendingQuestionId === "q-dog-route"
                ? "dog_route"
                : "recent_pet_wee",
          imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre", "sudden_appearance"])
        }),
        maxTurns: 3
      },
      {
        name: "object scorch",
        expectedTop: "object-heat-scorch",
        buildOpening: (iteration) => ({
          zone: sunnyZone,
          reading: createReading(sunnyZone, `res_object_${iteration}`),
          request: {
            userMessage: "One neat patch appeared suddenly and I cannot tell why."
          },
          imageObservation: observation(["isolated_patch", "uniform_object_shape", "sudden_appearance"])
        }),
        answerTurn: (pendingQuestionId) => ({
          userMessage:
            pendingQuestionId === "q-pets"
              ? "No pets."
              : "Yes, a paddling pool was sitting there.",
          quickReplyValue:
            pendingQuestionId === "q-pets" ? "no_pet_presence" : "under_object",
          imageObservation:
            pendingQuestionId === "q-pets"
              ? observation(["isolated_patch", "uniform_object_shape", "sudden_appearance"])
              : observation(["isolated_patch", "uniform_object_shape", "under_object", "sudden_appearance"])
        }),
        maxTurns: 3
      },
      {
        name: "chafer grubs",
        expectedTop: "chafer-grubs",
        buildOpening: (iteration) => ({
          zone: mixedZone,
          reading: createReading(mixedZone, `res_chafer_${iteration}`),
          request: {
            userMessage: "Birds are pecking at this patch and I think something is happening underneath."
          },
          imageObservation: observation(["birds_pecking"])
        }),
        answerTurn: (pendingQuestionId) => ({
          userMessage:
            pendingQuestionId === "q-birds"
              ? "Yes, birds are pecking at it."
              : "Yes, the turf lifts easily and there is bare soil underneath.",
          quickReplyValue:
            pendingQuestionId === "q-birds" ? "birds_pecking" : "turf_lifts_easily",
          imageObservation:
            pendingQuestionId === "q-birds"
              ? observation(["birds_pecking"])
              : observation(["birds_pecking", "turf_lifts_easily", "bare_soil"])
        }),
        maxTurns: 3
      },
      {
        name: "leatherjackets",
        expectedTop: "leatherjackets",
        buildOpening: (iteration) => ({
          zone: mixedZone,
          reading: createReading(mixedZone, `res_leather_${iteration}`, {
            moisture: 80,
            humidity: 86
          }),
          request: {
            userMessage: "Birds are at this soft wet patch and I think something is under the turf."
          },
          imageObservation: observation(["birds_pecking", "wet_area"])
        }),
        answerTurn: (pendingQuestionId) => ({
          userMessage:
            pendingQuestionId === "q-birds"
              ? "Yes, birds are pecking at it."
              : "Yes, the turf lifts easily and the patch is still wet and soft.",
          quickReplyValue:
            pendingQuestionId === "q-birds" ? "birds_pecking" : "turf_lifts_easily",
          imageObservation:
            pendingQuestionId === "q-birds"
              ? observation(["birds_pecking", "wet_area"])
              : observation(["birds_pecking", "turf_lifts_easily", "wet_area"])
        }),
        maxTurns: 3
      },
      {
        name: "red thread",
        expectedTop: "red-thread",
        buildOpening: (iteration) => ({
          zone: mixedZone,
          reading: createReading(mixedZone, `res_red_${iteration}`, {
            humidity: 88
          }),
          request: {
            userMessage: "This looks fungal but I need help narrowing it."
          },
          imageObservation: observation(["multiple_patches"])
        }),
        answerTurn: () => ({
          userMessage: "I can see red thread-like strands on the blades.",
          quickReplyValue: "red_threads_visible",
          imageObservation: observation(["red_threads_visible", "multiple_patches"])
        }),
        maxTurns: 2
      },
      {
        name: "rust",
        expectedTop: "rust",
        buildOpening: (iteration) => ({
          zone: mixedZone,
          reading: createReading(mixedZone, `res_rust_${iteration}`),
          request: {
            userMessage: "This looks fungal but I need help narrowing it."
          },
          imageObservation: observation(["multiple_patches"])
        }),
        answerTurn: () => ({
          userMessage: "There is orange dust on the blades and my shoes.",
          quickReplyValue: "orange_dust_visible",
          imageObservation: observation(["orange_dust_visible", "multiple_patches"])
        }),
        maxTurns: 2
      },
      {
        name: "fusarium",
        expectedTop: "fusarium",
        buildOpening: (iteration) => ({
          zone: shadeZone,
          reading: createReading(shadeZone, `res_fusarium_${iteration}`, {
            moisture: 80,
            humidity: 90
          }),
          request: {
            userMessage: "This looks fungal but I need help narrowing it."
          },
          imageObservation: observation(["wet_area"])
        }),
        answerTurn: () => ({
          userMessage: "There is white cottony growth on the patch.",
          quickReplyValue: "white_cottony_growth",
          imageObservation: observation(["white_cottony_growth", "wet_area"])
        }),
        maxTurns: 2
      },
      {
        name: "fairy ring",
        expectedTop: "fairy-ring",
        buildOpening: (iteration) => ({
          zone: mixedZone,
          reading: createReading(mixedZone, `res_ring_${iteration}`),
          request: {
            userMessage: "This looks fungal but I need help narrowing it."
          },
          imageObservation: observation(["multiple_patches"])
        }),
        answerTurn: () => ({
          userMessage: "It forms a ring and mushrooms keep appearing.",
          quickReplyValue: "mushrooms_present",
          imageObservation: observation(["ring_pattern", "mushrooms_present"])
        }),
        maxTurns: 2
      },
      {
        name: "new lawn failure",
        expectedTop: "new-lawn-failure",
        buildOpening: (iteration) => ({
          zone: sunnyZone,
          reading: createReading(sunnyZone, `res_new_${iteration}`),
          request: {
            userMessage: "Parts of this new area have failed but I need help narrowing it."
          },
          imageObservation: observation(["bare_soil"])
        }),
        answerTurn: () => ({
          userMessage: "Yes, this is newly seeded and parts washed out.",
          quickReplyValue: "washout_pattern",
          imageObservation: observation(["new_lawn", "washout_pattern", "bare_soil"])
        }),
        maxTurns: 2
      }
    ];

    let resolved = 0;
    let totalTurns = 0;

    for (const [caseIndex, testCase] of cases.entries()) {
      for (let iteration = 0; iteration < 256; iteration += 1) {
        const opening = testCase.buildOpening(iteration + caseIndex * 1000);
        let response = runDiagnosticTurn({
          request: baseRequest(opening.zone, opening.reading, opening.request),
          imageObservation: opening.imageObservation
        });
        let turns = 1;

        while (response.assistantTurn.pendingQuestion && turns < testCase.maxTurns) {
          const answer = testCase.answerTurn(response.assistantTurn.pendingQuestion.id, iteration);
          response = runDiagnosticTurn({
            request: baseRequest(opening.zone, opening.reading, {
              caseId: response.case.id,
              userMessage: answer.userMessage,
              replyToQuestionId: response.assistantTurn.pendingQuestion.id,
              quickReplyValue: answer.quickReplyValue,
              historyContext: {
                currentCaseState: response.updatedState
              }
            }),
            imageObservation: answer.imageObservation ?? opening.imageObservation
          });
          turns += 1;
        }

        expect(response.updatedState.topHypotheses[0]?.id).toBe(testCase.expectedTop);
        expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
        expect(response.assistantTurn.pendingQuestion).toBeUndefined();
        expect(turns).toBeLessThanOrEqual(testCase.maxTurns);
        resolved += 1;
        totalTurns += turns;
      }
    }

    expect(resolved).toBe(cases.length * 256);
    expect(totalTurns / resolved).toBeLessThanOrEqual(2.4);
  }, 45000);

  it("keeps recovery-plan and products modes coherent across 1,024 requests", () => {
    const confidentDogCase = () => {
      const opening = runDiagnosticTurn({
        request: baseRequest(shadeZone, createReading(shadeZone, "mode_dog", { moisture: 52 }), {
          userMessage: "This random patch appeared recently and the rest of the lawn is healthy."
        }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"])
      });
      const petTurn = runDiagnosticTurn({
        request: baseRequest(shadeZone, createReading(shadeZone, "mode_dog", { moisture: 52 }), {
          caseId: opening.case.id,
          userMessage: "Yes, we have a dog.",
          replyToQuestionId: opening.assistantTurn.pendingQuestion?.id,
          quickReplyValue: "pet_presence",
          historyContext: {
            currentCaseState: opening.updatedState
          }
        }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"])
      });
      return runDiagnosticTurn({
        request: baseRequest(shadeZone, createReading(shadeZone, "mode_dog", { moisture: 52 }), {
          caseId: petTurn.case.id,
          userMessage: "Yes, that is where the dog usually stops.",
          replyToQuestionId: petTurn.assistantTurn.pendingQuestion?.id,
          quickReplyValue: petTurn.assistantTurn.pendingQuestion?.id === "q-dog-route" ? "dog_route" : "recent_pet_wee",
          historyContext: {
            currentCaseState: petTurn.updatedState
          }
        }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre", "sudden_appearance"])
      });
    };

    let assertions = 0;

    for (let iteration = 0; iteration < 256; iteration += 1) {
      const confident = confidentDogCase();
      expect(confident.updatedState.confidence.shouldAskFollowUp).toBe(false);
      assertions += 1;

      const productTurn = runDiagnosticTurn({
        request: baseRequest(shadeZone, createReading(shadeZone, `mode_prod_${iteration}`, { moisture: 52 }), {
          caseId: confident.case.id,
          userMessage: "Recommend products.",
          requestedMode: "products",
          historyContext: {
            currentCaseState: confident.updatedState
          }
        }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre", "sudden_appearance"])
      });

      expect(productTurn.assistantTurn.pendingQuestion).toBeUndefined();
      expect(productTurn.productSuggestionCategories?.length ?? 0).toBeGreaterThan(0);
      assertions += 2;

      const recoveryTurn = runDiagnosticTurn({
        request: baseRequest(shadeZone, createReading(shadeZone, `mode_recovery_${iteration}`, { moisture: 52 }), {
          caseId: confident.case.id,
          userMessage: "Build me a recovery plan.",
          requestedMode: "recovery-plan",
          historyContext: {
            currentCaseState: confident.updatedState
          }
        }),
        imageObservation: observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre", "sudden_appearance"])
      });

      expect(recoveryTurn.assistantTurn.pendingQuestion).toBeUndefined();
      expect(recoveryTurn.recoveryPlan).toBeDefined();
      expect(recoveryTurn.case.stage).toBe("confident");
      assertions += 3;

      const vagueTurn = runDiagnosticTurn({
        request: baseRequest(pick(seeded(140000 + iteration), zones), createReading(pick(seeded(140000 + iteration), zones), `mode_vague_${iteration}`), {
          userMessage: "This patch looks off."
        })
      });

      expect(vagueTurn.assistantTurn.pendingQuestion).toBeDefined();
      expect(vagueTurn.productSuggestionCategories).toHaveLength(0);
      assertions += 2;
    }

    expect(assertions).toBe(2048);
  }, 45000);
});
