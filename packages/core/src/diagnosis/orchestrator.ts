import type {
  CareEvent,
  DiagnosticAssistantMode,
  DiagnosticAssistantTurn,
  DiagnosticCase,
  DiagnosticCaseStage,
  DiagnosticConfidence,
  DiagnosticCaseState,
  DiagnosticContextSnapshot,
  DiagnosticImageObservation,
  DiagnosticTopHypothesis,
  DiagnosticTurnRequest,
  DiagnosticTurnResponse,
  DiagnosticVisibleHypothesis,
  UploadedCaseImage
} from "../types";
import { makeId } from "../utils/id";
import { selectNextBestQuestions } from "./questionEngine";
import { isCoachingHypothesisId } from "./requestRouting";
import { generateRecoveryPlan } from "./recoveryPlan";
import { scoreDiagnosticCase } from "./scoring";

const mergeImages = (
  existingImages: UploadedCaseImage[] | undefined,
  incomingImages: UploadedCaseImage[] | undefined
) => {
  const map = new Map<string, UploadedCaseImage>();
  for (const image of [...(existingImages ?? []), ...(incomingImages ?? [])]) {
    map.set(image.id, image);
  }

  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const mergeCareEvents = (
  existingEvents: CareEvent[] | undefined,
  incomingEvents: CareEvent[] | undefined
) => {
  const map = new Map<string, CareEvent>();
  for (const event of [...(existingEvents ?? []), ...(incomingEvents ?? [])]) {
    map.set(event.id, event);
  }

  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const buildDiagnosticContextSnapshot = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  imageObservation?: DiagnosticImageObservation;
}): DiagnosticContextSnapshot => ({
  weatherContext: input.request.weatherContext ?? input.currentState?.weatherContext,
  sensorContext: input.request.sensorContext ?? input.currentState?.sensorContext,
  lawnProfile: input.request.lawnProfile ?? input.currentState?.lawnProfile,
  zoneContext: input.request.zoneContext ?? input.currentState?.zoneContext,
  historyContext: input.request.historyContext ?? input.currentState?.historyContext,
  careEvents: mergeCareEvents(input.currentState?.careEvents, input.request.careEvents),
  uploadedImages: mergeImages(input.currentState?.uploadedImages, input.request.images),
  imageObservation: input.imageObservation ?? input.currentState?.imageObservation
});

const stabilizeTopHypotheses = (
  topHypotheses: DiagnosticTopHypothesis[],
  lockedHypothesisId?: string
) => {
  if (!lockedHypothesisId || !topHypotheses.length || topHypotheses[0]?.id === lockedHypothesisId) {
    return topHypotheses;
  }

  const locked = topHypotheses.find((hypothesis) => hypothesis.id === lockedHypothesisId);
  const leader = topHypotheses[0];
  if (!locked || !leader) {
    return topHypotheses;
  }

  const challengerIsClear = leader.score - locked.score >= 0.18 && leader.score >= 0.55;
  if (challengerIsClear) {
    return topHypotheses;
  }

  return [
    locked,
    ...topHypotheses.filter((hypothesis) => hypothesis.id !== lockedHypothesisId)
  ].slice(0, 3);
};

const stabilizeVisibleHypotheses = (
  visibleHypotheses: DiagnosticVisibleHypothesis[],
  lockedHypothesisId?: string
) => {
  if (!lockedHypothesisId || visibleHypotheses[0]?.id === lockedHypothesisId) {
    return visibleHypotheses;
  }

  const locked = visibleHypotheses.find((hypothesis) => hypothesis.id === lockedHypothesisId);
  if (!locked) {
    return visibleHypotheses;
  }

  return [
    locked,
    ...visibleHypotheses.filter((hypothesis) => hypothesis.id !== lockedHypothesisId)
  ];
};

const getLockedHypothesisId = (input: {
  currentState?: DiagnosticCaseState;
  topHypotheses: DiagnosticTopHypothesis[];
  confidence: DiagnosticConfidence;
}) => {
  const leader = input.topHypotheses[0];
  if (isCoachingHypothesisId(leader?.id)) {
    return leader.id;
  }

  const existingLocked = input.currentState?.lockedHypothesisId;
  if (!existingLocked) {
    return input.confidence.resolved ||
      (input.confidence.label !== "low" && input.confidence.rawScoreGap >= 1.2)
      ? input.topHypotheses[0]?.id
      : undefined;
  }

  const locked = input.topHypotheses.find((hypothesis) => hypothesis.id === existingLocked);

  if (!leader || !locked) {
    return leader?.id;
  }

  if (leader.id === existingLocked) {
    return existingLocked;
  }

  const challengerIsClear =
    input.confidence.resolved ||
    ((leader.score - locked.score >= 0.12 || input.confidence.rawScoreGap >= 1.6) &&
      leader.score >= 0.24);
  return challengerIsClear ? leader.id : existingLocked;
};

const buildCaseTitle = (input: {
  topLabel?: string;
  question: string;
  zoneName?: string;
}) => {
  const snippet = input.question.trim().replace(/\s+/g, " ").slice(0, 60);
  if (input.topLabel && input.zoneName) {
    return `${input.zoneName}: ${input.topLabel}`;
  }

  if (input.topLabel) {
    return input.topLabel;
  }

  return snippet || "Lawn diagnosis";
};

const determineStage = (input: {
  currentState?: DiagnosticCaseState;
  requestedMode?: DiagnosticTurnRequest["requestedMode"];
  pendingQuestion?: NonNullable<DiagnosticAssistantTurn["pendingQuestion"]>;
  confidence: DiagnosticConfidence;
  shouldAskFollowUp: boolean;
}) => {
  if (
    input.requestedMode === "recovery-plan" ||
    input.confidence.resolved ||
    input.confidence.label === "high"
  ) {
    return "confident" as const;
  }

  if (input.pendingQuestion) {
    return input.currentState ? "narrowing" : "intake";
  }

  if (input.currentState?.stage === "confident") {
    return "monitoring" as const;
  }

  if (input.confidence.label !== "low" && !input.shouldAskFollowUp) {
    return "provisional" as const;
  }

  return input.currentState ? "monitoring" : "provisional";
};

const buildCaseStatus = (input: {
  stage: DiagnosticCaseStage;
  escalationFlags: string[];
  confidenceLabel: DiagnosticCaseState["confidence"]["label"];
}) => {
  if (input.escalationFlags.length && input.confidenceLabel !== "low") {
    return "escalated" as const;
  }

  if (input.stage === "confident") {
    return "confident" as const;
  }

  if (input.stage === "monitoring") {
    return "monitoring" as const;
  }

  return "gathering-evidence" as const;
};

const buildConfidenceSummary = (input: {
  mode: DiagnosticAssistantMode;
  topHypothesisId?: string;
  topLabel: string;
  topScore: number;
  gap: number;
}) => {
  if (isCoachingHypothesisId(input.topHypothesisId)) {
    return input.mode === "confident-answer" || input.topScore >= 0.7
      ? "Guidance only. This answer is based on current weather, readings, and recent lawn context rather than a photo diagnosis."
      : "Working guidance only. One changed condition could shift the timing advice.";
  }

  if (input.mode === "confident-answer" || input.topScore >= 0.78) {
    return `High confidence for now. ${input.topLabel} is clearly ahead on the current evidence.`;
  }

  if (input.mode === "question-led") {
    return `Working view only. ${input.topLabel} leads, but one answer should sharpen this noticeably.`;
  }

  if (input.gap < 0.12) {
    return "Provisional only. The top causes are still fairly close together.";
  }

  return `${input.topLabel} is the best fit so far, with some uncertainty still in play.`;
};

const buildAssistantMessage = (input: {
  mode: DiagnosticAssistantMode;
  topHypothesisId?: string;
  topLabel: string;
  currentActionPlan: DiagnosticCaseState["currentActionPlan"];
  pendingQuestion?: NonNullable<DiagnosticAssistantTurn["pendingQuestion"]>;
}) => {
  if (isCoachingHypothesisId(input.topHypothesisId)) {
    if (input.mode === "question-led" && input.pendingQuestion) {
      return `I can tighten the advice with one quick check: ${input.pendingQuestion.text}`;
    }

    return (
      input.currentActionPlan.doNow[0] ??
      `${input.topLabel} is the current best fit from the current lawn context.`
    );
  }

  if (input.mode === "confident-answer") {
    return `This now looks most like ${input.topLabel.toLowerCase()}.`;
  }

  if (input.mode === "question-led" && input.pendingQuestion) {
    return `The best current fit is ${input.topLabel.toLowerCase()}, but one quick check should settle it.`;
  }

  return `${input.topLabel} is the current best fit from what I have so far.`;
};

const buildAssistantTurn = (input: {
  now: string;
  topHypotheses: DiagnosticTopHypothesis[];
  visibleHypotheses: DiagnosticVisibleHypothesis[];
  currentActionPlan: DiagnosticCaseState["currentActionPlan"];
  followUpQuestion?: DiagnosticAssistantTurn["pendingQuestion"];
  requestedMode?: DiagnosticTurnRequest["requestedMode"];
  stage: DiagnosticCaseStage;
  confidence: DiagnosticCaseState["confidence"];
  escalationFlags: string[];
}): DiagnosticAssistantTurn => {
  const top = input.topHypotheses[0]!;
  const runnerUp = input.topHypotheses[1];
  const mode: DiagnosticAssistantMode =
    input.followUpQuestion
      ? "question-led"
      : input.stage === "confident"
        ? "confident-answer"
        : "provisional-answer";

  const supportingPoints = top.evidenceFor.length
    ? top.evidenceFor.slice(0, 3)
    : ["The current evidence is still light, so this remains a working view rather than a final diagnosis."];

  const evidenceAgainst = top.evidenceAgainst.length
    ? top.evidenceAgainst
    : runnerUp
      ? [`${runnerUp.label} is still plausible if new evidence points that way.`]
      : ["No strong contradictory clue has been confirmed yet."];

  const interimAdvice =
    input.escalationFlags.length || top.issueFamily === "chemical"
      ? input.currentActionPlan.doNow.slice(0, 2)
      : mode === "question-led"
        ? input.currentActionPlan.doNow.slice(0, 1)
        : input.currentActionPlan.doNow.slice(0, 2);

  const confidenceSummary = buildConfidenceSummary({
    mode,
    topHypothesisId: top.id,
    topLabel: top.label,
    topScore: input.confidence.topScore,
    gap: input.confidence.scoreGap
  });

  const message = buildAssistantMessage({
    mode,
    topHypothesisId: top.id,
    topLabel: top.label,
    currentActionPlan: input.currentActionPlan,
    pendingQuestion: input.followUpQuestion
  });

  return {
    id: makeId("assistant-turn"),
    createdAt: input.now,
    mode,
    message,
    supportingPoints,
    pendingQuestion: input.followUpQuestion,
    interimAdvice,
    confidenceSummary,
    visibleHypotheses: input.visibleHypotheses,
    verdict: message,
    reasoning: supportingPoints,
    evidenceFor: supportingPoints,
    evidenceAgainst,
    followUpQuestions: input.followUpQuestion ? [input.followUpQuestion] : [],
    doNow: input.currentActionPlan.doNow,
    avoid: input.currentActionPlan.avoid,
    watchFor: input.currentActionPlan.watchFor,
    recheckAt: input.currentActionPlan.recheckAt,
    confidenceNote: confidenceSummary,
    whatWouldChange: input.followUpQuestion
      ? [input.followUpQuestion.reason]
      : input.currentActionPlan.whatWouldChange,
    topHypotheses: input.topHypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      label: hypothesis.label,
      score: hypothesis.score,
      confidence: hypothesis.confidence
    }))
  };
};

export const runDiagnosticTurn = (input: {
  request: DiagnosticTurnRequest;
  now?: string;
  imageObservation?: DiagnosticImageObservation;
}): DiagnosticTurnResponse => {
  const now = input.now ?? new Date().toISOString();
  const currentState = input.request.historyContext?.currentCaseState;
  const caseId = input.request.caseId ?? currentState?.caseId ?? makeId("case");
  const contextSnapshot = buildDiagnosticContextSnapshot({
    request: input.request,
    currentState,
    imageObservation: input.imageObservation
  });

  const scoring = scoreDiagnosticCase({
    request: input.request,
    currentState,
    now,
    contextSnapshot
  });

  const lockedHypothesisId = getLockedHypothesisId({
    currentState,
    topHypotheses: scoring.topHypotheses,
    confidence: scoring.confidence
  });
  const stabilizedTopHypotheses = stabilizeTopHypotheses(scoring.topHypotheses, lockedHypothesisId);
  const stabilizedVisibleHypotheses = stabilizeVisibleHypotheses(
    scoring.visibleHypotheses,
    lockedHypothesisId
  );
  const followUpQuestion = selectNextBestQuestions({
    rankedHypothesisIds: stabilizedTopHypotheses.map((hypothesis) => hypothesis.id),
    confidence: scoring.confidence,
    currentState,
    uploadedImageCount: contextSnapshot.uploadedImages.length,
    confirmedSignals: scoring.presentSignals,
    requestedMode: input.request.requestedMode
  })[0];
  const stage = determineStage({
    currentState,
    requestedMode: input.request.requestedMode,
    pendingQuestion: followUpQuestion,
    confidence: scoring.confidence,
    shouldAskFollowUp: Boolean(followUpQuestion)
  });

  const updatedState: DiagnosticCaseState = {
    caseId,
    currentIntent: input.request.requestedMode ?? "diagnose",
    stage,
    issueFamily: stabilizedTopHypotheses[0]?.issueFamily ?? scoring.issueFamily,
    topHypotheses: stabilizedTopHypotheses,
    visibleHypotheses: stabilizedVisibleHypotheses,
    evidenceFor: scoring.evidenceFor,
    evidenceAgainst: scoring.evidenceAgainst,
    missingInformation: scoring.missingInformation,
    questionsAsked: Array.from(
      new Set([
        ...(currentState?.questionsAsked ?? []),
        ...(followUpQuestion ? [followUpQuestion.id] : [])
      ])
    ),
    lockedHypothesisId,
    lockedIssueFamily: stabilizedTopHypotheses[0]?.issueFamily,
    hypothesisHistory: [
      ...(currentState?.hypothesisHistory ?? []),
      ...(stabilizedTopHypotheses[0]
        ? [
            {
              id: stabilizedTopHypotheses[0].id,
              label: stabilizedTopHypotheses[0].label,
              issueFamily: stabilizedTopHypotheses[0].issueFamily,
              score: stabilizedTopHypotheses[0].score,
              createdAt: now
            }
          ]
        : [])
    ].slice(-12),
    pendingQuestionId: followUpQuestion?.id,
    pendingQuestion: followUpQuestion,
    confirmedSignals: scoring.presentSignals,
    ruledOutSignals: scoring.absentSignals,
    latestUserAnswers: [
      ...(currentState?.latestUserAnswers ?? []),
      {
        questionId: input.request.replyToQuestionId,
        value: input.request.quickReplyValue ?? input.request.userMessage,
        createdAt: now
      }
    ],
    uploadedImages: contextSnapshot.uploadedImages,
    weatherContext: contextSnapshot.weatherContext,
    sensorContext: contextSnapshot.sensorContext,
    lawnProfile: contextSnapshot.lawnProfile,
    zoneContext: contextSnapshot.zoneContext,
    historyContext: contextSnapshot.historyContext,
    confidence: scoring.confidence,
    recommendedNextQuestions: followUpQuestion ? [followUpQuestion] : [],
    currentActionPlan: scoring.currentActionPlan,
    escalationFlags: scoring.escalationFlags,
    careEvents: contextSnapshot.careEvents,
    imageObservation: contextSnapshot.imageObservation,
    productSuggestionCategories: scoring.productSuggestionCategories
  };

  const topHypothesis = stabilizedTopHypotheses[0];
  const coachingCase = isCoachingHypothesisId(topHypothesis?.id);

  const caseItem: DiagnosticCase = {
    id: caseId,
    title: buildCaseTitle({
      topLabel: topHypothesis?.label,
      question: input.request.userMessage,
      zoneName: contextSnapshot.zoneContext?.name
    }),
    status: buildCaseStatus({
      stage,
      escalationFlags: scoring.escalationFlags,
      confidenceLabel: scoring.confidence.label
    }),
    stage,
    createdAt: input.request.historyContext?.recentMessages?.[0]?.createdAt ?? now,
    updatedAt: now,
    zoneId: contextSnapshot.zoneContext?.id,
    issueFamily: topHypothesis?.issueFamily ?? scoring.issueFamily,
    summary: followUpQuestion
      ? coachingCase
        ? `${topHypothesis?.label ?? "This coaching view"} is leading, and Lawn Pal is checking one last detail before giving firmer advice.`
        : `${topHypothesis?.label ?? "A likely cause"} is leading, but Lawn Pal is still narrowing the cause.`
      : coachingCase
        ? `${topHypothesis?.label ?? "The current coaching view"} is based on the latest weather, reading, and lawn context.`
        : stage === "confident"
          ? `${topHypothesis?.label ?? "The leading diagnosis"} is now the strongest fit from the current evidence.`
          : `${topHypothesis?.label ?? "The leading diagnosis"} is the current best fit.`,
    confidence: scoring.confidence.label,
    topHypothesisLabel: topHypothesis?.label,
    archived: false
  };

  const recoveryPlan =
    input.request.requestedMode === "recovery-plan" || scoring.confidence.topScore >= 0.65
      ? generateRecoveryPlan({
          caseItem,
          state: updatedState,
          now
        })
      : undefined;

  if (recoveryPlan) {
    updatedState.recoveryPlan = recoveryPlan;
  }

  const assistantTurn = buildAssistantTurn({
    now,
    topHypotheses: stabilizedTopHypotheses,
    visibleHypotheses: stabilizedVisibleHypotheses,
    currentActionPlan: scoring.currentActionPlan,
    followUpQuestion,
    requestedMode: input.request.requestedMode,
    stage,
    confidence: scoring.confidence,
    escalationFlags: scoring.escalationFlags
  });

  return {
    case: caseItem,
    assistantTurn,
    updatedState,
    recoveryPlan,
    productSuggestionCategories: scoring.productSuggestionCategories,
    uiHints: {
      quickReplies: followUpQuestion?.quickReplies ?? [],
      suggestedActions: [
        "Ask another question",
        ...(stage === "provisional" || stage === "confident" || stage === "monitoring"
          ? ["Build recovery plan"]
          : []),
        ...(scoring.productSuggestionCategories.length ? ["Recommend products"] : []),
        ...(stage !== "intake" ? ["Set reminder"] : []),
        ...(stage !== "intake" ? ["Compare another zone"] : [])
      ]
    }
  };
};
