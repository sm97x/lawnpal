import type {
  AiAskPayload,
  AiAskStructuredResponse,
  DiagnosticAssistantTurn,
  DiagnosticCase,
  DiagnosticCaseState,
  DiagnosticMessage,
  UploadedCaseImage
} from "@lawnpal/core";
import { makeId } from "@lawnpal/core";

const createLegacyImage = (payload: AiAskPayload, createdAt: string): UploadedCaseImage[] =>
  payload.imageDataUrl
    ? [
        {
          id: makeId("legacy-image"),
          createdAt,
          label: "general",
          imageDataUrl: payload.imageDataUrl
        }
      ]
    : [];

const buildLegacyAssistantTurn = (
  response: AiAskStructuredResponse,
  createdAt: string
): DiagnosticAssistantTurn => ({
  id: makeId("legacy-assistant"),
  createdAt,
  mode: "provisional-answer",
  message: response.answer,
  supportingPoints: [response.answer],
  interimAdvice: response.suggestedActions.slice(0, 2),
  confidenceSummary: response.confidenceNote,
  visibleHypotheses: [
    {
      id: "other-stress",
      label: "Other or mixed lawn stress",
      score: 1,
      percentage: 100,
      confidence: "low",
      issueFamily: "general",
      kind: "hypothesis"
    }
  ],
  verdict: response.answer,
  reasoning: [response.answer],
  evidenceFor: [],
  evidenceAgainst: [],
  followUpQuestions: [],
  doNow: response.suggestedActions,
  avoid: [],
  watchFor: [response.disclaimer],
  recheckAt: new Date(new Date(createdAt).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  confidenceNote: response.confidenceNote,
  whatWouldChange: [response.disclaimer],
  topHypotheses: [
    {
      id: "other-stress",
      label: "Other or mixed lawn stress",
      score: 1,
      confidence: "low"
    }
  ]
});

export const migrateLegacyAiAskEntry = (input: {
  id: string;
  createdAt: string;
  question: string;
  payload: AiAskPayload;
  response: AiAskStructuredResponse;
}): {
  caseItem: DiagnosticCase;
  messages: DiagnosticMessage[];
  snapshot: DiagnosticCaseState;
} => {
  const caseId = `legacy_${input.id}`;
  const images = createLegacyImage(input.payload, input.createdAt);
  const assistantTurn = buildLegacyAssistantTurn(input.response, input.createdAt);
  const snapshot: DiagnosticCaseState = {
    caseId,
    currentIntent: "diagnose",
    stage: "monitoring",
    issueFamily: "general",
    topHypotheses: [
      {
        id: "other-stress",
        label: "Other or mixed lawn stress",
        issueFamily: "general",
        score: 1,
        confidence: "low",
        evidenceFor: [],
        evidenceAgainst: [],
        missingSignals: [],
        productCategoriesIfConfirmed: []
      }
    ],
    visibleHypotheses: [
      {
        id: "other-stress",
        label: "Other or mixed lawn stress",
        score: 1,
        percentage: 100,
        confidence: "low",
        issueFamily: "general",
        kind: "hypothesis"
      }
    ],
    evidenceFor: [],
    evidenceAgainst: [],
    missingInformation: [],
    questionsAsked: [],
    lockedHypothesisId: "other-stress",
    lockedIssueFamily: "general",
    hypothesisHistory: [
      {
        id: "other-stress",
        label: "Other or mixed lawn stress",
        issueFamily: "general",
        score: 1,
        createdAt: input.createdAt
      }
    ],
    pendingQuestionId: undefined,
    pendingQuestion: undefined,
    confirmedSignals: [],
    ruledOutSignals: [],
    latestUserAnswers: [
      {
        value: input.question,
        createdAt: input.createdAt
      }
    ],
    uploadedImages: images,
    weatherContext: input.payload.weather,
    sensorContext: input.payload.latestReading,
    zoneContext: input.payload.zone,
    confidence: {
      label: "low",
      topScore: 1,
      scoreGap: 1,
      rawTopScore: 1,
      rawScoreGap: 1,
      resolved: true,
      shouldAskFollowUp: false
    },
    recommendedNextQuestions: [],
    currentActionPlan: {
      doNow: input.response.suggestedActions,
      avoid: [],
      watchFor: [input.response.disclaimer],
      recheckAt: assistantTurn.recheckAt,
      whatWouldChange: [input.response.disclaimer]
    },
    escalationFlags: [],
    careEvents: [],
    productSuggestionCategories: []
  };

  const caseItem: DiagnosticCase = {
    id: caseId,
    title: input.question.slice(0, 60) || "Imported AI Ask",
    status: "closed",
    stage: "monitoring",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    zoneId: input.payload.zone?.id,
    issueFamily: "general",
    summary: input.response.answer,
    confidence: "low",
    topHypothesisLabel: "Other or mixed lawn stress",
    archived: true,
    legacyImported: true
  };

  const messages: DiagnosticMessage[] = [
    {
      id: `${caseId}_user`,
      caseId,
      createdAt: input.createdAt,
      role: "user",
      text: input.question,
      images
    },
    {
      id: `${caseId}_assistant`,
      caseId,
      createdAt: input.createdAt,
      role: "assistant",
      assistantTurn
    }
  ];

  return {
    caseItem,
    messages,
    snapshot
  };
};
