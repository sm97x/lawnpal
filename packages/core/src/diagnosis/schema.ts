import { z } from "zod";
import { diagnosticSignalKeys } from "../types";

export const diagnosticSignalSchema = z.enum(diagnosticSignalKeys);

export const uploadedCaseImageSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  label: z.enum(["wide", "close-up", "roots", "general"]),
  imageDataUrl: z.string().min(16)
});

export const careEventSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  caseId: z.string().optional(),
  zoneId: z.string().optional(),
  type: z.enum([
    "fertiliser",
    "weedkiller",
    "mosskiller",
    "watering",
    "mowing",
    "overseeding",
    "pet-urine",
    "heavy-traffic",
    "object-left",
    "note"
  ]),
  title: z.string(),
  note: z.string().optional()
});

const zoneSchema = z.object({
  id: z.string(),
  lawnId: z.string(),
  name: z.string(),
  exposure: z.enum(["sunny", "part-shade", "shade", "mixed"]),
  createdAt: z.string(),
  sortOrder: z.number()
});

const weatherSchema = z.object({
  source: z.enum(["openweather", "mock"]),
  capturedAt: z.string(),
  location: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number()
  }),
  current: z.object({
    summary: z.string(),
    temperatureC: z.number(),
    humidity: z.number(),
    rainProbability: z.number(),
    precipitationMm: z.number(),
    windSpeedMps: z.number(),
    isFrostRisk: z.boolean()
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      summary: z.string(),
      minTempC: z.number(),
      maxTempC: z.number(),
      rainProbability: z.number(),
      precipitationMm: z.number(),
      isFrostRisk: z.boolean()
    })
  )
});

const readingSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  provider: z.enum(["mock", "ble"]),
  scenarioKey: z.string(),
  takenAt: z.string(),
  photoUri: z.string().optional(),
  note: z.string().optional(),
  metrics: z.object({
    moisture: z.number(),
    soilTemperatureC: z.number(),
    ec: z.number(),
    ph: z.number(),
    lightLux: z.number(),
    humidity: z.number()
  })
});

const diagnosticCaseStateSchema = z
  .object({
    caseId: z.string(),
    currentIntent: z.enum(["diagnose", "recovery-plan", "products", "compare-zone"]),
    stage: z.enum(["intake", "narrowing", "provisional", "confident", "monitoring"]).optional(),
    issueFamily: z.enum([
      "patch",
      "disease",
      "pest",
      "water",
      "drainage",
      "shade",
      "chemical",
      "mowing",
      "moss",
      "weed",
      "soil",
      "seeding",
      "seasonal",
      "general"
    ]),
    topHypotheses: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        issueFamily: z.string(),
        score: z.number(),
        confidence: z.enum(["low", "medium", "high"]),
        evidenceFor: z.array(z.string()),
        evidenceAgainst: z.array(z.string()),
        missingSignals: z.array(z.string()),
        productCategoriesIfConfirmed: z.array(z.string())
      })
    ),
    visibleHypotheses: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          score: z.number(),
          percentage: z.number(),
          confidence: z.enum(["low", "medium", "high"]),
          issueFamily: z.string().optional(),
          kind: z.enum(["hypothesis", "other"])
        })
      )
      .optional(),
    evidenceFor: z.array(z.object({ id: z.string(), hypothesisId: z.string(), text: z.string(), source: z.string(), weight: z.number(), signal: diagnosticSignalSchema.optional() })),
    evidenceAgainst: z.array(z.object({ id: z.string(), hypothesisId: z.string(), text: z.string(), source: z.string(), weight: z.number(), signal: diagnosticSignalSchema.optional() })),
    missingInformation: z.array(z.string()),
    questionsAsked: z.array(z.string()),
    lockedHypothesisId: z.string().optional(),
    lockedIssueFamily: z.string().optional(),
    hypothesisHistory: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          issueFamily: z.string(),
          score: z.number(),
          createdAt: z.string()
        })
      )
      .optional(),
    pendingQuestionId: z.string().optional(),
    pendingQuestion: z
      .object({
        id: z.string(),
        text: z.string(),
        reason: z.string(),
        effort: z.enum(["low", "medium", "high"]),
        targetHypothesisIds: z.array(z.string()),
        quickReplies: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            value: z.string(),
            questionId: z.string().optional()
          })
        )
      })
      .optional(),
    confirmedSignals: z.array(diagnosticSignalSchema).optional(),
    ruledOutSignals: z.array(diagnosticSignalSchema).optional(),
    latestUserAnswers: z.array(
      z.object({
        questionId: z.string().optional(),
        value: z.string(),
        createdAt: z.string()
      })
    ),
    uploadedImages: z.array(uploadedCaseImageSchema),
    weatherContext: weatherSchema.optional(),
    sensorContext: readingSchema.optional(),
    lawnProfile: z
      .object({
        grassStyle: z.enum(["hard-wearing", "ornamental", "shaded", "unknown"]),
        soilType: z.enum(["unknown", "sandy", "loam", "clay"])
      })
      .optional(),
    zoneContext: zoneSchema.optional(),
    confidence: z.object({
      label: z.enum(["low", "medium", "high"]),
      topScore: z.number(),
      scoreGap: z.number(),
      rawTopScore: z.number().optional(),
      rawScoreGap: z.number().optional(),
      resolved: z.boolean().optional(),
      shouldAskFollowUp: z.boolean()
    }),
    currentActionPlan: z.object({
      doNow: z.array(z.string()),
      avoid: z.array(z.string()),
      watchFor: z.array(z.string()),
      recheckAt: z.string(),
      whatWouldChange: z.array(z.string())
    }),
    escalationFlags: z.array(z.string()),
    careEvents: z.array(careEventSchema),
    productSuggestionCategories: z.array(z.string())
  })
  .passthrough();

export const diagnosticTurnRequestSchema = z.object({
  caseId: z.string().optional(),
  userMessage: z.string().min(1),
  replyToQuestionId: z.string().optional(),
  quickReplyValue: z.string().optional(),
  images: z.array(uploadedCaseImageSchema).optional(),
  requestedMode: z.enum(["diagnose", "recovery-plan", "products", "compare-zone"]).optional(),
  zoneContext: zoneSchema.optional(),
  weatherContext: weatherSchema.optional(),
  sensorContext: readingSchema.optional(),
  lawnProfile: z
    .object({
      grassStyle: z.enum(["hard-wearing", "ornamental", "shaded", "unknown"]),
      soilType: z.enum(["unknown", "sandy", "loam", "clay"])
    })
    .optional(),
  historyContext: z
    .object({
      currentCaseState: diagnosticCaseStateSchema.optional(),
      recentMessages: z
        .array(
          z.object({
            id: z.string(),
            role: z.enum(["user", "assistant"]),
            text: z.string(),
            createdAt: z.string()
          })
        )
        .optional(),
      recentCaseSummaries: z
        .array(
          z.object({
            caseId: z.string(),
            title: z.string(),
            issueFamily: z.string(),
            outcome: z.string()
          })
        )
        .optional(),
      zoneTrendSummaries: z.array(z.string()).optional(),
      siblingZoneInsights: z.array(z.string()).optional()
    })
    .optional(),
  careEvents: z.array(careEventSchema).optional()
});

export const diagnosticImageObservationSchema = z.object({
  summary: z.string(),
  observedSignals: z.array(diagnosticSignalSchema),
  notes: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  recommendedAdditionalImages: z.array(z.enum(["wide", "close-up", "roots", "general"]))
});

export const diagnosticComposerDraftSchema = z.object({
  mode: z.enum(["question-led", "provisional-answer", "confident-answer"]),
  message: z.string().min(1),
  supportingPoints: z.array(z.string().min(1)).max(3),
  interimAdvice: z.array(z.string().min(1)).max(2),
  confidenceSummary: z.string().min(1)
});
