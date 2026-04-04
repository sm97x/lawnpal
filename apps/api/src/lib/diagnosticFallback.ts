import {
  extractDiagnosticSignals,
  runDiagnosticTurn,
  type DiagnosticComposerDraft,
  type DiagnosticImageObservation,
  type DiagnosticTurnRequest,
  type DiagnosticTurnResponse
} from "@lawnpal/core";

export const buildFallbackObservation = (
  request: DiagnosticTurnRequest
): DiagnosticImageObservation => {
  const extracted = extractDiagnosticSignals({
    request,
    currentState: request.historyContext?.currentCaseState
  });

  return {
    summary:
      request.images?.length
        ? "Used heuristic fallbacks from the current message and known context because structured image extraction was unavailable."
        : "No image observation model step was available, so only textual and sensor context was used.",
    observedSignals: Array.from(extracted.presentSignals),
    notes: extracted.notes.slice(0, 5),
    confidence: request.images?.length ? "medium" : "low",
    recommendedAdditionalImages: request.images?.length ? [] : ["close-up", "wide"]
  };
};

export const mergeComposerDraft = (
  response: DiagnosticTurnResponse,
  draft: DiagnosticComposerDraft
): DiagnosticTurnResponse => ({
  ...response,
  assistantTurn: {
    ...response.assistantTurn,
    mode: response.assistantTurn.mode,
    message: draft.message,
    supportingPoints: draft.supportingPoints,
    interimAdvice: draft.interimAdvice,
    confidenceSummary: draft.confidenceSummary,
    verdict: draft.message,
    reasoning: draft.supportingPoints,
    evidenceFor: draft.supportingPoints,
    confidenceNote: draft.confidenceSummary
  }
});

export const buildFallbackDiagnosticResponse = (
  request: DiagnosticTurnRequest
): DiagnosticTurnResponse =>
  runDiagnosticTurn({
    request,
    imageObservation: buildFallbackObservation(request)
  });
