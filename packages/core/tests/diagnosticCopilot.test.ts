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
  grassStyle: "hard-wearing",
  soilType: "loam"
};

const sunnyZone: Zone = {
  id: "zone_front",
  lawnId: "lawn_1",
  name: "Front lawn",
  exposure: "sunny",
  createdAt: "2026-04-02T08:00:00.000Z",
  sortOrder: 0
};

const shadeZone: Zone = {
  ...sunnyZone,
  id: "zone_back",
  name: "Back lawn",
  exposure: "shade",
  sortOrder: 1
};

const weather = buildMockWeather({ lat: 51.5, lon: -0.12, label: "London" });

const sampleImage = () => ({
  id: "img_1",
  createdAt: "2026-04-02T10:00:00.000Z",
  label: "general" as const,
  imageDataUrl: "data:image/jpeg;base64,aGVsbG8td29ybGQtY2xvc2UtdXAtcGF0Y2g="
});

const buildReading = (overrides: Partial<SensorReading["metrics"]> = {}): SensorReading => ({
  id: "reading_1",
  zoneId: sunnyZone.id,
  provider: "mock",
  scenarioKey: "healthy-lawn",
  takenAt: "2026-04-02T10:00:00.000Z",
  metrics: {
    moisture: 54,
    soilTemperatureC: 11,
    ec: 1.2,
    ph: 6.4,
    lightLux: 15000,
    humidity: 62,
    ...overrides
  }
});

const buildObservation = (
  observedSignals: DiagnosticSignalKey[],
  summary = "Structured image clues were extracted from the uploaded lawn photo."
): DiagnosticImageObservation => ({
  summary,
  observedSignals,
  notes: [],
  confidence: observedSignals.length >= 2 ? "high" : "medium",
  recommendedAdditionalImages: []
});

const buildCareEvent = (type: CareEvent["type"], title: string): CareEvent => ({
  id: `event_${type}`,
  createdAt: "2026-04-02T09:45:00.000Z",
  caseId: "case_1",
  zoneId: sunnyZone.id,
  type,
  title
});

const buildRequest = (
  overrides: Partial<DiagnosticTurnRequest> = {},
  sensorOverrides: Partial<SensorReading["metrics"]> = {},
  zone: Zone = sunnyZone
): DiagnosticTurnRequest => ({
  userMessage: "Why is this patch here?",
  zoneContext: zone,
  weatherContext: weather,
  sensorContext: {
    ...buildReading(sensorOverrides),
    zoneId: zone.id
  },
  lawnProfile,
  ...overrides
});

const topHypothesisId = (request: DiagnosticTurnRequest, observation?: DiagnosticImageObservation) =>
  runDiagnosticTurn({ request, imageObservation: observation }).updatedState.topHypotheses[0]?.id;

describe("diagnostic copilot engine", () => {
  it("asks a high-value follow-up question for an ambiguous damaged patch", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This random patch has appeared recently. The rest of the lawn is healthy and it looks scorched.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation([
        "isolated_patch",
        "random_irregular_patch",
        "scorched_centre"
      ])
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(response.updatedState.stage).toBe("intake");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(true);
    expect(response.assistantTurn.mode).toBe("question-led");
    expect(response.assistantTurn.pendingQuestion?.id).toBe("q-pets");
    expect(response.assistantTurn.followUpQuestions).toHaveLength(1);
    expect(response.assistantTurn.interimAdvice.length).toBeLessThanOrEqual(1);
    expect(response.productSuggestionCategories).toEqual([]);
  });

  it("opens likely dog-urine cases with pet confirmation before lower-value questions", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This random patch appeared recently. The rest of the lawn is healthy and it looks scorched."
      }),
      imageObservation: buildObservation([
        "isolated_patch",
        "rest_of_lawn_healthy",
        "scorched_centre"
      ])
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(response.assistantTurn.pendingQuestion?.id).toBe("q-pets");
  });

  it("still asks about pets first even when the opening turn is text-only", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This random patch has appeared recently. The rest of the lawn is healthy."
      })
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(response.assistantTurn.pendingQuestion?.id).toBe("q-pets");
  });

  it("raises confidence as the case gains evidence across turns", () => {
    const firstTurn = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This patch appeared recently and the rest of the lawn looks healthy.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation(["isolated_patch", "scorched_centre"])
    });

    const secondTurn = runDiagnosticTurn({
      request: buildRequest(
        {
          caseId: firstTurn.case.id,
          userMessage: "Yes, we have a dog and this is a usual dog route.",
          replyToQuestionId: "q-pets",
          quickReplyValue: "dog_route",
          historyContext: {
            currentCaseState: firstTurn.updatedState
          }
        },
        {},
        sunnyZone
      ),
      imageObservation: buildObservation(["isolated_patch", "scorched_centre"])
    });

    expect(secondTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(secondTurn.updatedState.lockedHypothesisId).toBe("dog-urine");
    expect(secondTurn.updatedState.confidence.topScore).toBeGreaterThan(
      firstTurn.updatedState.confidence.topScore
    );
    expect(
      secondTurn.assistantTurn.followUpQuestions.some((question) => question.id === "q-pets")
    ).toBe(false);
  });

  it("suppresses product suggestions below the confidence threshold unless the user asks", () => {
    const narrowedCase = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This single patch appeared suddenly and the rest of the lawn is healthy.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"])
    });

    expect(narrowedCase.productSuggestionCategories).toEqual([]);

    const productsTurn = runDiagnosticTurn({
      request: buildRequest({
        caseId: narrowedCase.case.id,
        userMessage: "Recommend products for this patch.",
        requestedMode: "products",
        historyContext: {
          currentCaseState: narrowedCase.updatedState
        }
      })
    });

    expect(productsTurn.productSuggestionCategories).toContain("patch-repair");
    expect(productsTurn.assistantTurn.pendingQuestion).toBeUndefined();
  });

  it("short-circuits extra questioning for clear chemical damage", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This irregular patch appeared suddenly after weedkiller and now looks bleached.",
        careEvents: [buildCareEvent("weedkiller", "Applied weedkiller")]
      }),
      imageObservation: buildObservation(["random_irregular_patch", "scorched_centre"])
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("weedkiller-damage");
    expect(response.updatedState.confidence.shouldAskFollowUp).toBe(false);
    expect(response.updatedState.escalationFlags).toContain("stop-extra-treatments");
    expect(response.assistantTurn.doNow[0]).toContain("Stop further spraying");
  });

  it("keeps a clear mowing-linked bump patch in the scalping lane", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage: "This appeared after mowing on a bump and looks cut too low."
      })
    });

    expect(response.updatedState.topHypotheses[0]?.id).toBe("scalping");
  });

  it("does not let dry-patch style wording drift into dog-urine without pet evidence", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage: "This area keeps drying out even after watering."
      })
    });

    expect(["dry-patch", "drought-stress"]).toContain(
      response.updatedState.topHypotheses[0]?.id
    );
  });

  it("generates a longer plan when the user explicitly asks for recovery planning", () => {
    const confidentCase = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This single patch appeared suddenly, the rest of the lawn is healthy, and our dog uses this area.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation([
        "isolated_patch",
        "rest_of_lawn_healthy",
        "pet_presence",
        "dog_route",
        "scorched_centre",
        "sudden_appearance"
      ])
    });

    const vagueCase = runDiagnosticTurn({
      request: buildRequest({
        userMessage: "The patch looks off."
      })
    });

    expect(vagueCase.recoveryPlan).toBeUndefined();
    expect(confidentCase.recoveryPlan?.windows.map((window) => window.title)).toEqual([
      "3-day",
      "7-day"
    ]);

    const requestedPlan = runDiagnosticTurn({
      request: buildRequest({
        caseId: confidentCase.case.id,
        userMessage: "Build me a recovery plan.",
        requestedMode: "recovery-plan",
        historyContext: {
          currentCaseState: confidentCase.updatedState
        }
      })
    });

    expect(requestedPlan.case.status).toBe("confident");
    expect(requestedPlan.recoveryPlan?.windows.at(-1)?.title).toBe("30-day");
  });

  it("does not let a strong dog-urine read drift to shade from background context alone", () => {
    const firstTurn = runDiagnosticTurn({
      request: buildRequest(
        {
          userMessage:
            "This random patch appeared recently, the rest of the lawn is healthy, and our dog uses this spot.",
          images: [sampleImage()]
        },
        {
          lightLux: 6200,
          moisture: 52
        },
        shadeZone
      ),
      imageObservation: buildObservation([
        "isolated_patch",
        "rest_of_lawn_healthy",
        "sudden_appearance",
        "scorched_centre"
      ])
    });

    const secondTurn = runDiagnosticTurn({
      request: buildRequest(
        {
          caseId: firstTurn.case.id,
          userMessage: "It is near a hedge at the back, but it still looks like one burnt patch.",
          historyContext: {
            currentCaseState: firstTurn.updatedState
          }
        },
        {
          lightLux: 5600,
          moisture: 54
        },
        shadeZone
      ),
      imageObservation: buildObservation([
        "isolated_patch",
        "rest_of_lawn_healthy",
        "sudden_appearance",
        "scorched_centre"
      ])
    });

    expect(firstTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(secondTurn.updatedState.topHypotheses[0]?.id).toBe("dog-urine");
    expect(secondTurn.updatedState.lockedHypothesisId).toBe("dog-urine");
  });

  it("makes the visible likelihoods add up to 100", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This patch appeared recently. The rest of the lawn is healthy and it looks scorched.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"])
    });

    expect(
      response.updatedState.visibleHypotheses.reduce(
        (sum, hypothesis) => sum + hypothesis.percentage,
        0
      )
    ).toBe(100);
  });

  it("keeps only one active follow-up question per turn", () => {
    const response = runDiagnosticTurn({
      request: buildRequest({
        userMessage:
          "This random patch has appeared recently. The rest of the lawn is healthy.",
        images: [sampleImage()]
      }),
      imageObservation: buildObservation(["isolated_patch", "random_irregular_patch"])
    });

    expect(response.assistantTurn.followUpQuestions).toHaveLength(1);
    expect(response.updatedState.pendingQuestionId).toBe(
      response.assistantTurn.pendingQuestion?.id
    );
  });
});

describe("diagnosis fixtures", () => {
  const fixtures: Array<{
    name: string;
    request: DiagnosticTurnRequest;
    observation?: DiagnosticImageObservation;
    expectedTopHypothesis: string;
  }> = [
    {
      name: "dog urine patch",
      request: buildRequest({
        userMessage:
          "This single patch appeared suddenly, the rest of the lawn is healthy, and our dog uses this spot."
      }),
      observation: buildObservation(["isolated_patch", "rest_of_lawn_healthy", "scorched_centre"]),
      expectedTopHypothesis: "dog-urine"
    },
    {
      name: "fertiliser scorch",
      request: buildRequest({
        userMessage: "This scorched patch appeared suddenly after fertiliser."
      }),
      observation: buildObservation(["scorched_centre", "sudden_appearance"]),
      expectedTopHypothesis: "fertiliser-scorch"
    },
    {
      name: "weedkiller damage",
      request: buildRequest({
        userMessage: "This irregular patch appeared suddenly after weedkiller."
      }),
      observation: buildObservation(["random_irregular_patch", "sudden_appearance"]),
      expectedTopHypothesis: "weedkiller-damage"
    },
    {
      name: "drought stress",
      request: buildRequest(
        {
          userMessage: "This whole area has gone dry and parched in hot weather."
        },
        {
          moisture: 22,
          humidity: 38,
          lightLux: 19000
        }
      ),
      expectedTopHypothesis: "drought-stress"
    },
    {
      name: "dry patch",
      request: buildRequest(
        {
          userMessage:
            "This single patch stays dry even after watering and it is under a tree."
        },
        {
          moisture: 24,
          humidity: 42,
          lightLux: 7000
        },
        shadeZone
      ),
      observation: buildObservation(["isolated_patch"]),
      expectedTopHypothesis: "dry-patch"
    },
    {
      name: "waterlogging",
      request: buildRequest(
        {
          userMessage: "This patch stays wet and squelchy after rain."
        },
        {
          moisture: 86,
          humidity: 90,
          lightLux: 7800
        }
      ),
      expectedTopHypothesis: "waterlogging"
    },
    {
      name: "compaction",
      request: buildRequest(
        {
          userMessage:
            "The ground feels compacted and hard, this gateway stays wet, and kids use it constantly."
        },
        {
          moisture: 74,
          humidity: 78
        }
      ),
      expectedTopHypothesis: "compaction"
    },
    {
      name: "red thread",
      request: buildRequest(
        {
          userMessage: "These strawy patches have red threads visible."
        },
        {
          moisture: 64,
          humidity: 88
        }
      ),
      observation: buildObservation(["red_threads_visible"]),
      expectedTopHypothesis: "red-thread"
    },
    {
      name: "rust",
      request: buildRequest({
        userMessage: "There is orange dust on shoes and blades in this area."
      }),
      observation: buildObservation(["orange_dust_visible"]),
      expectedTopHypothesis: "rust"
    },
    {
      name: "fusarium",
      request: buildRequest(
        {
          userMessage: "This patch showed white cottony growth in cool wet weather."
        },
        {
          moisture: 82,
          humidity: 91,
          lightLux: 5000
        },
        shadeZone
      ),
      observation: buildObservation(["white_cottony_growth"]),
      expectedTopHypothesis: "fusarium"
    },
    {
      name: "fairy ring",
      request: buildRequest({
        userMessage: "There is a circular ring with mushrooms in this area."
      }),
      observation: buildObservation(["ring_pattern", "mushrooms_present"]),
      expectedTopHypothesis: "fairy-ring"
    },
    {
      name: "chafer grubs",
      request: buildRequest({
        userMessage:
          "Birds are pecking here and the turf lifts easily, leaving bare soil behind."
      }),
      observation: buildObservation(["birds_pecking", "turf_lifts_easily", "bare_soil"]),
      expectedTopHypothesis: "chafer-grubs"
    },
    {
      name: "leatherjackets",
      request: buildRequest(
        {
          userMessage:
            "Birds are pecking, the turf lifts easily, and the area stays wet and soft."
        },
        {
          moisture: 79,
          humidity: 87
        }
      ),
      observation: buildObservation(["birds_pecking", "turf_lifts_easily", "wet_area"]),
      expectedTopHypothesis: "leatherjackets"
    },
    {
      name: "scalping",
      request: buildRequest({
        userMessage: "This appeared after mowing and it looks cut too low."
      }),
      observation: buildObservation(["after_mowing", "scalped_look"]),
      expectedTopHypothesis: "scalping"
    },
    {
      name: "object heat scorch",
      request: buildRequest({
        userMessage: "One regular patch appeared after a paddling pool sat there."
      }),
      observation: buildObservation(["isolated_patch", "under_object", "uniform_object_shape"]),
      expectedTopHypothesis: "object-heat-scorch"
    },
    {
      name: "new lawn failure",
      request: buildRequest({
        userMessage: "This is newly seeded and parts washed out, leaving bare soil."
      }),
      observation: buildObservation(["new_lawn", "washout_pattern", "bare_soil"]),
      expectedTopHypothesis: "new-lawn-failure"
    }
  ];

  it.each(fixtures)("ranks the right leading hypothesis for $name", ({ request, observation, expectedTopHypothesis }) => {
    expect(topHypothesisId(request, observation)).toBe(expectedTopHypothesis);
  });
});
