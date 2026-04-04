import { describe, expect, it } from "vitest";
import {
  buildMockWeather,
  runDiagnosticTurn,
  type CareEvent,
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

const createCareEvent = (
  type: CareEvent["type"],
  zone: Zone,
  suffix: string
): CareEvent => ({
  id: `event_${type}_${suffix}`,
  createdAt: "2026-04-04T08:30:00.000Z",
  zoneId: zone.id,
  type,
  title: type.replace("-", " ")
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

type StrongScenario = {
  name: string;
  expectedTop: string;
  pickZone: (random: () => number) => Zone;
  buildReading: (random: () => number, zone: Zone, iteration: number) => SensorReading;
  messageVariants: string[];
  observationFactory?: (random: () => number) => DiagnosticImageObservation | undefined;
  careEventsFactory?: (zone: Zone, iteration: number) => CareEvent[] | undefined;
  expectNoFollowUp?: boolean;
};

const strongScenarios: StrongScenario[] = [
  {
    name: "dog urine",
    expectedTop: "dog-urine",
    pickZone: (random) => pick(random, zones),
    buildReading: (random, zone, iteration) =>
      createReading(zone, `dog_${iteration}`, {
        moisture: 46 + Math.round(random() * 22),
        ph: 5.8 + random() * 0.8
      }),
    messageVariants: [
      "This single scorched patch is where the dog goes and the rest of the lawn looks healthy.",
      "Our dog uses this spot and one patch has come up burnt while everywhere else looks fine.",
      "This isolated patch is where the dog wees and the surrounding lawn still looks healthy."
    ],
    observationFactory: (random) =>
      observation(
        [
          "isolated_patch",
          "rest_of_lawn_healthy",
          "scorched_centre",
          random() > 0.4 ? "sudden_appearance" : "random_irregular_patch"
        ],
        "One scorched isolated patch with healthier turf around it."
      ),
    expectNoFollowUp: true
  },
  {
    name: "fertiliser scorch",
    expectedTop: "fertiliser-scorch",
    pickZone: (random) => pick(random, [sunnyZone, mixedZone]),
    buildReading: (random, zone, iteration) =>
      createReading(zone, `fert_${iteration}`, {
        moisture: 40 + Math.round(random() * 20),
        lightLux: 11000 + Math.round(random() * 5000)
      }),
    messageVariants: [
      "This striped scorched patch appeared after fertiliser went down last week.",
      "I fed the lawn and now there is a burnt stripe through this area.",
      "After feeding, this patch went yellow in a spreader-like stripe."
    ],
    observationFactory: () => observation(["stripe_pattern", "scorched_centre", "sudden_appearance"]),
    careEventsFactory: (zone, iteration) => [createCareEvent("fertiliser", zone, String(iteration))],
    expectNoFollowUp: true
  },
  {
    name: "weedkiller damage",
    expectedTop: "weedkiller-damage",
    pickZone: () => sunnyZone,
    buildReading: (_random, zone, iteration) =>
      createReading(zone, `weed_${iteration}`, { moisture: 50, lightLux: 13500 }),
    messageVariants: [
      "This irregular bleached patch appeared after weedkiller.",
      "I sprayed weeds and this patch yellowed quickly afterwards.",
      "After weedkiller, this area has gone pale in an odd patch."
    ],
    observationFactory: () => observation(["random_irregular_patch", "sudden_appearance", "scorched_centre"]),
    careEventsFactory: (zone, iteration) => [createCareEvent("weedkiller", zone, String(iteration))],
    expectNoFollowUp: true
  },
  {
    name: "moss treatment damage",
    expectedTop: "mosskiller-damage",
    pickZone: () => shadeZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `mosskill_${iteration}`, {
        moisture: 74 + Math.round(random() * 10),
        lightLux: 4200 + Math.round(random() * 1200),
        ph: 5.4 + random() * 0.4
      }),
    messageVariants: [
      "After moss treatment this damp shady patch has gone stressed and patchy.",
      "I used moss killer and the mossy corner now looks worse.",
      "This patch darkened after moss treatment in a wet shady area."
    ],
    observationFactory: () => observation(["moss_visible", "low_light", "wet_area"]),
    careEventsFactory: (zone, iteration) => [createCareEvent("mosskiller", zone, String(iteration))],
    expectNoFollowUp: true
  },
  {
    name: "object scorch",
    expectedTop: "object-heat-scorch",
    pickZone: (random) => pick(random, [sunnyZone, mixedZone]),
    buildReading: (_random, zone, iteration) =>
      createReading(zone, `object_${iteration}`, { moisture: 48, lightLux: 15000 }),
    messageVariants: [
      "A paddling pool sat here and now there is one regular scorched patch.",
      "This exact shape appeared where furniture was sitting.",
      "One neat patch showed up after something sat on the lawn."
    ],
    observationFactory: () => observation(["isolated_patch", "under_object", "uniform_object_shape", "sudden_appearance"]),
    expectNoFollowUp: true
  },
  {
    name: "drought stress",
    expectedTop: "drought-stress",
    pickZone: () => sunnyZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `drought_${iteration}`, {
        moisture: 20 + Math.round(random() * 6),
        humidity: 34 + Math.round(random() * 8),
        lightLux: 18000 + Math.round(random() * 3000)
      }),
    messageVariants: [
      "This whole area has gone dry and parched in the hot weather.",
      "Large sections are strawy and the soil is bone dry.",
      "The lawn has dried right out across this sunny area."
    ],
    observationFactory: () => observation(["dry_area", "dry_soil"]),
    expectNoFollowUp: true
  },
  {
    name: "dry patch",
    expectedTop: "dry-patch",
    pickZone: () => shadeZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `drypatch_${iteration}`, {
        moisture: 18 + Math.round(random() * 8),
        humidity: 38 + Math.round(random() * 8),
        lightLux: 5600 + Math.round(random() * 1400)
      }),
    messageVariants: [
      "This single patch stays dry even after watering and it is under a tree.",
      "One patch under the tree will not re-wet properly.",
      "This isolated patch remains dry despite watering near the hedge."
    ],
    observationFactory: () => observation(["isolated_patch", "dry_area", "dry_soil", "tree_shade"]),
    expectNoFollowUp: true
  },
  {
    name: "waterlogging",
    expectedTop: "waterlogging",
    pickZone: () => mixedZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `waterlog_${iteration}`, {
        moisture: 82 + Math.round(random() * 8),
        humidity: 84 + Math.round(random() * 8),
        lightLux: 6500 + Math.round(random() * 1600)
      }),
    messageVariants: [
      "This patch stays wet and squelchy after rain.",
      "The ground here is soggy and slow to dry.",
      "This area keeps holding water and feels squelchy."
    ],
    observationFactory: () => observation(["wet_area", "soggy_soil"]),
    expectNoFollowUp: true
  },
  {
    name: "compaction",
    expectedTop: "compaction",
    pickZone: () => mixedZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `compact_${iteration}`, {
        moisture: 70 + Math.round(random() * 8),
        humidity: 72 + Math.round(random() * 10)
      }),
    messageVariants: [
      "The ground is hard and compacted by the gate, and kids run over it constantly.",
      "This high-traffic patch feels hard and stays wetter than the rest.",
      "The gateway area is compacted and slow to recover."
    ],
    observationFactory: () => observation(["compacted_area", "high_traffic", "wet_area"]),
    expectNoFollowUp: true
  },
  {
    name: "shade weakness",
    expectedTop: "shade-weakness",
    pickZone: () => shadeZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `shade_${iteration}`, {
        moisture: 58 + Math.round(random() * 12),
        lightLux: 3600 + Math.round(random() * 1200),
        ph: 5.9 + random() * 0.3
      }),
    messageVariants: [
      "This thin patch under the tree has been gradually declining in the shade.",
      "The grass is sparse and weak in this shady corner, and it has worsened slowly.",
      "This shaded area under the hedge has gradually thinned out."
    ],
    observationFactory: () => observation(["tree_shade", "low_light", "thin_shaded_grass", "gradual_spread"]),
    expectNoFollowUp: true
  },
  {
    name: "moss dominance",
    expectedTop: "moss-dominance",
    pickZone: () => shadeZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `moss_${iteration}`, {
        moisture: 78 + Math.round(random() * 8),
        lightLux: 3800 + Math.round(random() * 1200),
        ph: 5.4 + random() * 0.4
      }),
    messageVariants: [
      "There is visible moss in this damp shady patch and the grass underneath is weak.",
      "This mossy corner stays wet and shady.",
      "The patch is mossy, damp, and weak under the hedge."
    ],
    observationFactory: () => observation(["moss_visible", "low_light", "wet_area"]),
    expectNoFollowUp: true
  },
  {
    name: "red thread",
    expectedTop: "red-thread",
    pickZone: () => mixedZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `redthread_${iteration}`, {
        moisture: 62 + Math.round(random() * 8),
        humidity: 86 + Math.round(random() * 6)
      }),
    messageVariants: [
      "These strawy patches have red threads on the blades.",
      "I can see red thread-like strands in the patch.",
      "There are red threads visible across these strawy patches."
    ],
    observationFactory: () => observation(["red_threads_visible", "multiple_patches"]),
    expectNoFollowUp: true
  },
  {
    name: "rust",
    expectedTop: "rust",
    pickZone: () => mixedZone,
    buildReading: (_random, zone, iteration) => createReading(zone, `rust_${iteration}`),
    messageVariants: [
      "There is orange dust on shoes and the grass blades.",
      "The blades are dusty orange in this area.",
      "I am getting orange powder on my shoes from this patch."
    ],
    observationFactory: () => observation(["orange_dust_visible", "multiple_patches"]),
    expectNoFollowUp: true
  },
  {
    name: "fusarium",
    expectedTop: "fusarium",
    pickZone: () => shadeZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `fusarium_${iteration}`, {
        moisture: 80 + Math.round(random() * 8),
        humidity: 90 + Math.round(random() * 4),
        lightLux: 3600 + Math.round(random() * 1000)
      }),
    messageVariants: [
      "This patch showed white cottony growth in cool wet weather.",
      "There is white mouldy cottony growth on the patch.",
      "In this cool damp spell, the patch has white cottony growth."
    ],
    observationFactory: () => observation(["white_cottony_growth", "wet_area", "low_light"]),
    expectNoFollowUp: true
  },
  {
    name: "fairy ring",
    expectedTop: "fairy-ring",
    pickZone: () => mixedZone,
    buildReading: (_random, zone, iteration) => createReading(zone, `fairyring_${iteration}`),
    messageVariants: [
      "There is a circular ring with mushrooms in this area.",
      "This patch forms a ring and mushrooms keep appearing on it.",
      "I have a ring-shaped patch with mushrooms."
    ],
    observationFactory: () => observation(["ring_pattern", "mushrooms_present"]),
    expectNoFollowUp: true
  },
  {
    name: "take-all patch",
    expectedTop: "take-all-patch",
    pickZone: () => sunnyZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `takeall_${iteration}`, {
        moisture: 24 + Math.round(random() * 6),
        humidity: 42 + Math.round(random() * 8),
        lightLux: 15500 + Math.round(random() * 2000)
      }),
    messageVariants: [
      "This patch has been gradually getting bigger in warm dry spells.",
      "It spreads slowly each dry spell rather than appearing overnight.",
      "This lawn patch keeps gradually widening in dry weather."
    ],
    observationFactory: () => observation(["dry_area", "gradual_spread"]),
    expectNoFollowUp: false
  },
  {
    name: "chafer grubs",
    expectedTop: "chafer-grubs",
    pickZone: () => mixedZone,
    buildReading: (_random, zone, iteration) => createReading(zone, `chafer_${iteration}`),
    messageVariants: [
      "Birds are pecking here and the turf lifts easily, leaving bare soil.",
      "The turf peels back and birds keep attacking the patch.",
      "Birds are tearing at it and the grass lifts off the bare soil."
    ],
    observationFactory: () => observation(["birds_pecking", "turf_lifts_easily", "bare_soil"]),
    expectNoFollowUp: true
  },
  {
    name: "leatherjackets",
    expectedTop: "leatherjackets",
    pickZone: () => mixedZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `leather_${iteration}`, {
        moisture: 76 + Math.round(random() * 8),
        humidity: 84 + Math.round(random() * 6)
      }),
    messageVariants: [
      "Birds are pecking, the turf lifts easily, and the patch stays wet and soft.",
      "The lawn is soft, birds are at it, and the turf comes up easily.",
      "This wet soft patch is being pecked by birds and the turf lifts."
    ],
    observationFactory: () => observation(["birds_pecking", "turf_lifts_easily", "wet_area"]),
    expectNoFollowUp: true
  },
  {
    name: "scalping",
    expectedTop: "scalping",
    pickZone: () => sunnyZone,
    buildReading: (_random, zone, iteration) => createReading(zone, `scalp_${iteration}`),
    messageVariants: [
      "This appeared straight after mowing and it looks cut too low.",
      "The patch showed up after mowing and looks scalped.",
      "It came up after the cut and the grass looks shaved too low."
    ],
    observationFactory: () => observation(["after_mowing", "scalped_look"]),
    expectNoFollowUp: true
  },
  {
    name: "new lawn failure",
    expectedTop: "new-lawn-failure",
    pickZone: () => sunnyZone,
    buildReading: (random, zone, iteration) =>
      createReading(zone, `newlawn_${iteration}`, {
        moisture: 58 + Math.round(random() * 8)
      }),
    messageVariants: [
      "This is newly seeded and parts washed out, leaving bare soil.",
      "The new lawn has patchy germination and washout.",
      "After seeding, parts washed away and left bare patches."
    ],
    observationFactory: () => observation(["new_lawn", "washout_pattern", "bare_soil"]),
    expectNoFollowUp: true
  },
  {
    name: "other stress",
    expectedTop: "other-stress",
    pickZone: (random) => pick(random, zones),
    buildReading: (random, zone, iteration) =>
      createReading(zone, `other_${iteration}`, {
        moisture: 45 + Math.round(random() * 20),
        humidity: 58 + Math.round(random() * 16),
        lightLux: zone.exposure === "shade" ? 5200 + Math.round(random() * 1600) : 9000 + Math.round(random() * 4000)
      }),
    messageVariants: [
      "This patch looks off.",
      "Something seems wrong here.",
      "This area does not look right."
    ],
    observationFactory: () => undefined,
    expectNoFollowUp: false
  }
];

describe("diagnostic coverage matrix", () => {
  it("holds top-rank coverage across 1,280 deterministic scenario variants", () => {
    let assertions = 0;

    for (const [scenarioIndex, scenario] of strongScenarios.entries()) {
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const random = seeded((scenarioIndex + 1) * 10000 + iteration);
        const zone = scenario.pickZone(random);
        const reading = scenario.buildReading(random, zone, iteration);
        const response = runDiagnosticTurn({
          request: baseRequest(zone, reading, {
            userMessage: pick(random, scenario.messageVariants),
            careEvents: scenario.careEventsFactory?.(zone, iteration)
          }),
          imageObservation: scenario.observationFactory?.(random)
        });

        expect(response.updatedState.topHypotheses[0]?.id).toBe(scenario.expectedTop);
        assertions += 1;
      }
    }

    expect(assertions).toBe(strongScenarios.length * 64);
  }, 60000);

  it("stops asking once the evidence is already sufficient across 1,088 strong variants", () => {
    const stopScenarios = strongScenarios.filter((scenario) => scenario.expectNoFollowUp);
    let assertions = 0;

    for (const [scenarioIndex, scenario] of stopScenarios.entries()) {
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const random = seeded((scenarioIndex + 1) * 20000 + iteration);
        const zone = scenario.pickZone(random);
        const reading = scenario.buildReading(random, zone, iteration);
        const response = runDiagnosticTurn({
          request: baseRequest(zone, reading, {
            userMessage: pick(random, scenario.messageVariants),
            careEvents: scenario.careEventsFactory?.(zone, iteration)
          }),
          imageObservation: scenario.observationFactory?.(random)
        });

        if (response.updatedState.topHypotheses[0]?.id !== scenario.expectedTop) {
          throw new Error(
            `Stop scenario top mismatch for ${scenario.name} at iteration ${iteration}: expected ${scenario.expectedTop}, received ${response.updatedState.topHypotheses[0]?.id}`
          );
        }
        if (response.updatedState.confidence.shouldAskFollowUp) {
          throw new Error(
            `Stop scenario kept asking for ${scenario.name} at iteration ${iteration}: pending ${response.assistantTurn.pendingQuestion?.id ?? "none"}`
          );
        }
        expect(response.assistantTurn.pendingQuestion).toBeUndefined();
        assertions += 1;
      }
    }

    expect(assertions).toBe(stopScenarios.length * 64);
  }, 60000);

  it("closes ambiguous conversations after targeted confirmation across 512 multi-turn runs", () => {
    let assertions = 0;

    for (let iteration = 0; iteration < 128; iteration += 1) {
      const random = seeded(50000 + iteration);
      const dogZone = pick(random, zones);
      const dogReading = createReading(dogZone, `dog_close_${iteration}`, {
        moisture: 48 + Math.round(random() * 18),
        ph: 5.8 + random() * 0.6
      });
      const dogObservation = observation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"]);
      const dogFirst = runDiagnosticTurn({
        request: baseRequest(dogZone, dogReading, {
          userMessage: pick(random, [
            "This random patch appeared recently and the rest of the lawn is healthy.",
            "One patch has come up quickly while everywhere else looks fine."
          ])
        }),
        imageObservation: dogObservation
      });
      expect(dogFirst.assistantTurn.pendingQuestion?.id).toBe("q-pets");
      const dogSecond = runDiagnosticTurn({
        request: baseRequest(dogZone, dogReading, {
          caseId: dogFirst.case.id,
          userMessage: "Yes, we have a dog.",
          replyToQuestionId: "q-pets",
          quickReplyValue: "pet_presence",
          historyContext: {
            currentCaseState: dogFirst.updatedState
          }
        }),
        imageObservation: dogObservation
      });
      const dogThird = runDiagnosticTurn({
        request: baseRequest(dogZone, dogReading, {
          caseId: dogSecond.case.id,
          userMessage:
            dogSecond.assistantTurn.pendingQuestion?.id === "q-dog-route"
              ? "Yes, that is where the dog usually stops."
              : "Yes, the dog wee'd there recently.",
          replyToQuestionId: dogSecond.assistantTurn.pendingQuestion?.id,
          quickReplyValue:
            dogSecond.assistantTurn.pendingQuestion?.id === "q-dog-route"
              ? "dog_route"
              : "recent_pet_wee",
          historyContext: {
            currentCaseState: dogSecond.updatedState
          }
        }),
        imageObservation: dogObservation
      });
      expect(dogThird.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
      expect(dogThird.updatedState.confidence.shouldAskFollowUp).toBe(false);
      assertions += 1;

      const objectReading = createReading(sunnyZone, `object_close_${iteration}`);
      const objectObservation = observation(["isolated_patch", "uniform_object_shape", "sudden_appearance"]);
      const objectFirst = runDiagnosticTurn({
        request: baseRequest(sunnyZone, objectReading, {
          userMessage: "One neat patch appeared suddenly and I cannot tell why."
        }),
        imageObservation: objectObservation
      });
      expect(["q-object", "q-pets"]).toContain(objectFirst.assistantTurn.pendingQuestion?.id);
      const objectSecond = runDiagnosticTurn({
        request: baseRequest(sunnyZone, objectReading, {
          caseId: objectFirst.case.id,
          userMessage:
            objectFirst.assistantTurn.pendingQuestion?.id === "q-pets"
              ? "No pets."
              : "Yes, a paddling pool was sitting there.",
          replyToQuestionId: objectFirst.assistantTurn.pendingQuestion?.id,
          quickReplyValue:
            objectFirst.assistantTurn.pendingQuestion?.id === "q-pets"
              ? "no_pet_presence"
              : "under_object",
          historyContext: {
            currentCaseState: objectFirst.updatedState
          }
        }),
        imageObservation:
          objectFirst.assistantTurn.pendingQuestion?.id === "q-pets"
            ? objectObservation
            : observation(["isolated_patch", "uniform_object_shape", "under_object", "sudden_appearance"])
      });
      const objectResolvedTurn =
        objectSecond.assistantTurn.pendingQuestion?.id === "q-object"
          ? runDiagnosticTurn({
              request: baseRequest(sunnyZone, objectReading, {
                caseId: objectSecond.case.id,
                userMessage: "Yes, a paddling pool was sitting there.",
                replyToQuestionId: "q-object",
                quickReplyValue: "under_object",
                historyContext: {
                  currentCaseState: objectSecond.updatedState
                }
              }),
              imageObservation: observation(["isolated_patch", "uniform_object_shape", "under_object", "sudden_appearance"])
            })
          : objectSecond;
      expect(objectResolvedTurn.updatedState.topHypotheses[0]?.id).toBe("object-heat-scorch");
      expect(objectResolvedTurn.updatedState.confidence.shouldAskFollowUp).toBe(false);
      assertions += 1;

      const chaferReading = createReading(mixedZone, `chafer_close_${iteration}`);
      const chaferFirst = runDiagnosticTurn({
        request: baseRequest(mixedZone, chaferReading, {
          userMessage: "Birds are pecking at this patch and I think something is happening underneath."
        }),
        imageObservation: observation(["birds_pecking"])
      });
      expect(["q-birds", "q-lift"]).toContain(chaferFirst.assistantTurn.pendingQuestion?.id);
      const chaferSecond = runDiagnosticTurn({
        request: baseRequest(mixedZone, chaferReading, {
          caseId: chaferFirst.case.id,
          userMessage:
            chaferFirst.assistantTurn.pendingQuestion?.id === "q-birds"
              ? "Yes, birds are pecking at it."
              : "Yes, the turf lifts easily and there is bare soil underneath.",
          replyToQuestionId: chaferFirst.assistantTurn.pendingQuestion?.id,
          quickReplyValue:
            chaferFirst.assistantTurn.pendingQuestion?.id === "q-birds"
              ? "birds_pecking"
              : "turf_lifts_easily",
          historyContext: {
            currentCaseState: chaferFirst.updatedState
          }
        }),
        imageObservation:
          chaferFirst.assistantTurn.pendingQuestion?.id === "q-birds"
            ? observation(["birds_pecking"])
            : observation(["birds_pecking", "turf_lifts_easily", "bare_soil"])
      });
      const chaferResolvedTurn =
        chaferSecond.assistantTurn.pendingQuestion?.id === "q-lift"
          ? runDiagnosticTurn({
              request: baseRequest(mixedZone, chaferReading, {
                caseId: chaferSecond.case.id,
                userMessage: "Yes, the turf lifts easily and there is bare soil underneath.",
                replyToQuestionId: "q-lift",
                quickReplyValue: "turf_lifts_easily",
                historyContext: {
                  currentCaseState: chaferSecond.updatedState
                }
              }),
              imageObservation: observation(["birds_pecking", "turf_lifts_easily", "bare_soil"])
            })
          : chaferSecond;
      expect(chaferResolvedTurn.updatedState.topHypotheses[0]?.id).toBe("chafer-grubs");
      expect(chaferResolvedTurn.updatedState.confidence.shouldAskFollowUp).toBe(false);
      assertions += 1;

      const leatherReading = createReading(mixedZone, `leather_close_${iteration}`, {
        moisture: 80,
        humidity: 86
      });
      const leatherFirst = runDiagnosticTurn({
        request: baseRequest(mixedZone, leatherReading, {
          userMessage: "Birds are at this soft wet patch and I think something is under the turf."
        }),
        imageObservation: observation(["birds_pecking", "wet_area"])
      });
      expect(leatherFirst.assistantTurn.pendingQuestion?.id).toBe("q-lift");
      const leatherSecond = runDiagnosticTurn({
        request: baseRequest(mixedZone, leatherReading, {
          caseId: leatherFirst.case.id,
          userMessage: "Yes, the turf lifts easily and the patch is still wet and soft.",
          replyToQuestionId: "q-lift",
          quickReplyValue: "turf_lifts_easily",
          historyContext: {
            currentCaseState: leatherFirst.updatedState
          }
        }),
        imageObservation: observation(["birds_pecking", "turf_lifts_easily", "wet_area"])
      });
      expect(leatherSecond.updatedState.topHypotheses[0]?.id).toBe("leatherjackets");
      expect(leatherSecond.updatedState.confidence.shouldAskFollowUp).toBe(false);
      assertions += 1;
    }

    expect(assertions).toBe(128 * 4);
  }, 60000);

  it("keeps soil-health visible as a secondary issue and leaves truly vague cases open across 128 variants", () => {
    let assertions = 0;

    for (let iteration = 0; iteration < 64; iteration += 1) {
      const random = seeded(70000 + iteration);
      const reading = createReading(shadeZone, `soil_${iteration}`, {
        moisture: 64 + Math.round(random() * 8),
        ph: 5.1 + random() * 0.3,
        lightLux: 4200 + Math.round(random() * 800)
      });
      const soilCase = runDiagnosticTurn({
        request: baseRequest(sunnyZone, reading, {
          userMessage:
            "This area has historically underperformed and the pH reading looks acidic."
        })
      });

      expect(soilCase.updatedState.topHypotheses[0]?.id).toBe("soil-ph-stress");
      expect(soilCase.updatedState.confidence.shouldAskFollowUp).toBe(true);
      assertions += 1;

      const vagueZone = pick(random, zones);
      const vagueReading = createReading(vagueZone, `vague_${iteration}`, {
        moisture: 46 + Math.round(random() * 20),
        humidity: 60 + Math.round(random() * 14)
      });
      const vagueCase = runDiagnosticTurn({
        request: baseRequest(vagueZone, vagueReading, {
          userMessage: pick(random, ["This patch looks off.", "Something seems wrong here.", "This area does not look right."])
        })
      });

      expect(vagueCase.updatedState.topHypotheses[0]?.id).toBe("other-stress");
      expect(vagueCase.assistantTurn.followUpQuestions).toHaveLength(1);
      assertions += 1;
    }

    expect(assertions).toBe(128);
  }, 60000);
});
