import type {
  DiagnosticCaseState,
  DiagnosticConfidence,
  DiagnosticQuestion,
  DiagnosticTurnRequest
} from "../types";
import { diagnosticQuestionTemplates, getDiagnosticQuestionTemplate } from "./playbooks";

const effortPenalty = {
  low: 0,
  medium: 0.35,
  high: 0.75
} as const;

export const selectNextBestQuestions = (input: {
  rankedHypothesisIds: string[];
  confidence: DiagnosticConfidence;
  currentState?: DiagnosticCaseState;
  uploadedImageCount: number;
  confirmedSignals?: string[];
  requestedMode?: DiagnosticTurnRequest["requestedMode"];
}): DiagnosticQuestion[] => {
  if (input.requestedMode === "recovery-plan" || input.requestedMode === "products") {
    return [];
  }

  if (!input.confidence.shouldAskFollowUp) {
    return [];
  }

  const asked = new Set(input.currentState?.questionsAsked ?? []);
  const confirmedSignals = new Set(input.confirmedSignals ?? input.currentState?.confirmedSignals ?? []);
  const topIds = input.rankedHypothesisIds.slice(0, 3);

  const candidates = diagnosticQuestionTemplates
    .filter((question) => !asked.has(question.id))
    .map((question) => {
      const overlap = question.targetHypothesisIds.filter((id) => topIds.includes(id)).length;
      const imageBonus =
        question.id === "q-closeup" && input.uploadedImageCount === 0 ? 0.9 : 0;
      const closeRaceBonus = input.confidence.scoreGap < 0.12 ? overlap * 0.35 : 0;
      const prerequisitePenalty =
        question.id === "q-recent-wee" && !confirmedSignals.has("pet_presence")
          ? 2
          : question.id === "q-dog-route" && !confirmedSignals.has("pet_presence")
            ? 0.9
            : 0;
      const dogUrineOpeningPriority =
        topIds[0] === "dog-urine" && !confirmedSignals.has("pet_presence")
          ? question.id === "q-pets"
            ? 2.1
            : question.id === "q-sudden" || question.id === "q-products"
              ? -0.75
              : 0
          : 0;
      const dogUrinePriorityBonus =
        topIds[0] === "dog-urine" && confirmedSignals.has("pet_presence")
          ? question.id === "q-recent-wee"
            ? 1.4
            : question.id === "q-dog-route"
              ? 0.85
              : question.id === "q-sudden"
                ? -0.9
                : 0
          : 0;
      const pestPriorityBonus =
        (topIds.includes("chafer-grubs") || topIds.includes("leatherjackets")) &&
        confirmedSignals.has("birds_pecking")
          ? question.id === "q-lift"
            ? 1.35
            : question.id === "q-birds"
              ? -0.95
              : question.id === "q-wet" && topIds[0] === "leatherjackets"
                ? 0.25
                : 0
          : 0;
      const leaderFocusBonus =
        topIds[0] && question.targetHypothesisIds.includes(topIds[0])
          ? input.confidence.scoreGap >= 0.2
            ? 0.45
            : 0.15
          : input.confidence.scoreGap >= 0.35
            ? -0.6
            : 0;

      return {
        question,
        score:
          question.infoGainWeight +
          overlap * 0.65 +
          imageBonus +
          closeRaceBonus -
          prerequisitePenalty -
          effortPenalty[question.effort] +
          dogUrineOpeningPriority +
          dogUrinePriorityBonus +
          pestPriorityBonus +
          leaderFocusBonus
      };
    })
    .filter((candidate) => candidate.score > 0.75)
    .sort((a, b) => b.score - a.score);

  return candidates.slice(0, 1).map((candidate) => candidate.question);
};

export const buildMissingInformation = (
  questionIds: string[],
  currentState?: DiagnosticCaseState
): string[] => {
  const asked = new Set(currentState?.questionsAsked ?? []);
  return questionIds
    .filter((questionId) => !asked.has(questionId))
    .map((questionId) => getDiagnosticQuestionTemplate(questionId)?.text)
    .filter((value): value is string => Boolean(value));
};
