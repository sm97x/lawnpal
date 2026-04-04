import type {
  DiagnosticCaseState,
  DiagnosticContextSnapshot,
  DiagnosticImageObservation,
  DiagnosticQuestion,
  DiagnosticTopHypothesis,
  DiagnosticTurnRequest,
  UploadedCaseImage
} from "../types";
import { diagnosticSignalKeys } from "../types";
import { getDiagnosticPlaybook } from "./playbooks";
import { isCoachingHypothesisId } from "./requestRouting";

const buildImageObservationText = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  snapshot: DiagnosticContextSnapshot;
}) => {
  const lines = [
    "You are extracting visible lawn clues only. Do not diagnose.",
    `User message: ${input.request.userMessage}`
  ];

  if (input.snapshot.zoneContext) {
    lines.push(
      `Zone: ${input.snapshot.zoneContext.name} (${input.snapshot.zoneContext.exposure})`
    );
  }

  if (input.snapshot.sensorContext) {
    const metrics = input.snapshot.sensorContext.metrics;
    lines.push(
      `Sensor context: moisture ${metrics.moisture}%, soil temp ${metrics.soilTemperatureC}C, pH ${metrics.ph}, light ${metrics.lightLux} lux, humidity ${metrics.humidity}%.`
    );
  }

  if (input.snapshot.weatherContext) {
    lines.push(
      `Weather context: ${input.snapshot.weatherContext.current.summary}, humidity ${input.snapshot.weatherContext.current.humidity}%, rain chance ${input.snapshot.weatherContext.current.rainProbability}%.`
    );
  }

  lines.push(
    `Allowed signals: ${diagnosticSignalKeys.join(", ")}. Only select signals that are genuinely visible or strongly implied by the images plus text.`
  );

  return lines.join("\n");
};

export const buildObservationPrompt = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  snapshot: DiagnosticContextSnapshot;
}) => {
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [
    {
      type: "input_text",
      text: buildImageObservationText(input)
    }
  ];

  for (const image of input.snapshot.uploadedImages) {
    content.push({
      type: "input_image",
      image_url: image.imageDataUrl,
      detail: "auto"
    });
  }

  return {
    instructions:
      "Return structured lawn-image observations only. Do not name a final diagnosis. Avoid guessing from a single clue.",
    input: [
      {
        role: "user" as const,
        content
      }
    ]
  };
};

const formatHypothesis = (hypothesis: DiagnosticTopHypothesis) =>
  [
    `${hypothesis.label} (${Math.round(hypothesis.score * 100)}%)`,
    `for: ${hypothesis.evidenceFor.join("; ") || "none yet"}`,
    `against: ${hypothesis.evidenceAgainst.join("; ") || "none yet"}`
  ].join(" | ");

const formatQuestion = (question: DiagnosticQuestion) =>
  `${question.text} Why it matters: ${question.reason}. Quick replies: ${question.quickReplies
    .map((reply) => reply.label)
    .join(", ")}`;

const formatImageLabels = (images: UploadedCaseImage[]) =>
  images.map((image) => `${image.label} photo from ${image.createdAt}`).join(", ");

export const buildComposerPrompt = (input: {
  request: DiagnosticTurnRequest;
  state: DiagnosticCaseState;
  topHypotheses: DiagnosticTopHypothesis[];
  snapshot: DiagnosticContextSnapshot;
}) => {
  const topHypothesis = input.topHypotheses[0];
  const coachingTurn = isCoachingHypothesisId(topHypothesis?.id);
  const playbookSnippets = input.topHypotheses
    .map((hypothesis) => {
      const playbook = getDiagnosticPlaybook(hypothesis.id);
      if (!playbook) {
        return null;
      }

      return [
        `Playbook: ${playbook.label}`,
        `hallmarks: ${playbook.hallmarkSymptoms.join("; ")}`,
        `lookalikes: ${playbook.commonLookalikes.join("; ")}`,
        `immediate actions: ${playbook.immediateActions.join("; ")}`,
        `avoid: ${playbook.avoidDoing.join("; ")}`
      ].join("\n");
    })
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  const text = [
    "You are Lawn Pal, a calm British lawn diagnostic copilot.",
    "Do not re-rank hypotheses. Use the supplied ranking as ground truth.",
    "Respond like a natural chat message, not a report template.",
    coachingTurn
      ? "This is a coaching or timing question, so answer directly from the supplied lawn context rather than forcing a diagnosis."
      : "If the case is still narrowing, sound provisional rather than over-diagnosed.",
    `User message: ${input.request.userMessage}`,
    `Mode: ${input.request.requestedMode ?? "diagnose"}`,
    `Case stage: ${input.state.stage}`,
    `Top hypotheses:\n${input.topHypotheses.map(formatHypothesis).join("\n")}`,
    `Visible likelihood summary: ${input.state.visibleHypotheses
      .map((hypothesis) => `${hypothesis.label} ${hypothesis.percentage}%`)
      .join(", ")}`,
    `Current action plan do now: ${input.state.currentActionPlan.doNow.join("; ")}`,
    `Avoid: ${input.state.currentActionPlan.avoid.join("; ")}`,
    `Watch for: ${input.state.currentActionPlan.watchFor.join("; ")}`,
    `Re-check at: ${input.state.currentActionPlan.recheckAt}`,
    input.state.pendingQuestion
      ? `Current follow-up question: ${formatQuestion(input.state.pendingQuestion)}`
      : "No further follow-up question is needed right now.",
    input.snapshot.uploadedImages.length
      ? `Images attached: ${formatImageLabels(input.snapshot.uploadedImages)}`
      : "No images attached this turn.",
    input.snapshot.imageObservation
      ? `Structured image observations: ${input.snapshot.imageObservation.summary}. Signals: ${input.snapshot.imageObservation.observedSignals.join(", ")}.`
      : "No structured image observation was available.",
    playbookSnippets
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    instructions:
      "Return structured JSON only. Keep the tone calm, concise, and conversational. Do not re-rank the causes. Do not restate percentages in the chat body. If a pending question exists, do not ask any other question in the message or supporting points. When the case is still narrowing, do not sound fully diagnosed and do not dump a full action plan into the message. If the top hypothesis is a coaching topic, answer directly and do not force a diagnostic differential.",
    input: [
      {
        role: "user" as const,
        content: [{ type: "input_text" as const, text }]
      }
    ]
  };
};
