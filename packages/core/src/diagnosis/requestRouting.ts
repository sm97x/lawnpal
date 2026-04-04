import type {
  DiagnosticCaseState,
  DiagnosticContextSnapshot,
  DiagnosticTurnRequest
} from "../types";

export const coachingHypothesisIds = [
  "mowing-window",
  "feeding-window",
  "seeding-window",
  "watering-guidance",
  "weekend-plan",
  "treatment-safety",
  "zone-comparison-insight"
] as const;

export type CoachingHypothesisId = (typeof coachingHypothesisIds)[number];

export type DiagnosticRequestRouting = {
  kind: "diagnosis" | "coaching";
  topic?: CoachingHypothesisId;
  reasons: string[];
};

const strongDiagnosisCuePatterns = [
  /\bpatch\b/,
  /\bspot\b/,
  /\bring\b/,
  /\bstripe\b/,
  /\byellow(?:ing)?\b/,
  /\bbrown(?:ing)?\b/,
  /\bscorch(?:ed|ing)?\b/,
  /\bburnt\b/,
  /\bfung(?:us|al)\b/,
  /\bmushroom\b/,
  /\bmoss\b/,
  /\bwaterlog(?:ged|ging)?\b/,
  /\bcompaction\b/,
  /\bthin\b/,
  /\bsparse\b/,
  /\bdisease\b/,
  /\bchafer\b/,
  /\bleatherjacket\b/,
  /\bgrub\b/,
  /\bpee(?:d|ing)?\b/,
  /\bwee(?:d|ing)?\b/,
  /\burine\b/,
  /\bdog\b.*\bpatch\b/,
  /\bwhat is (?:this|it)\b/,
  /\bwhy is (?:this|it)\b/
] as const;

const coachingMatchers: Array<{
  topic: CoachingHypothesisId;
  patterns: RegExp[];
}> = [
  {
    topic: "treatment-safety",
    patterns: [
      /\b(kids|children|dogs?|pets?)\b[\s\S]{0,40}\b(after|once|post)\b[\s\S]{0,40}\b(weedkiller|weed killer|moss(?: killer| treatment)|feed|fertili[sz](?:e|er)|treatment)\b/,
      /\b(safe|okay|ok)\b[\s\S]{0,30}\b(kids|children|dogs?|pets?)\b/,
      /\bhow long\b[\s\S]{0,30}\b(after)\b[\s\S]{0,30}\b(weedkiller|feed|fertili[sz](?:e|er)|moss(?: killer| treatment))\b/
    ]
  },
  {
    topic: "mowing-window",
    patterns: [
      /\b(should|can|when|okay to|ok to|is it okay to)\b[\s\S]{0,40}\b(mow|mowing|cut the grass|cut the lawn)\b/,
      /\bmow(?:ing)?\b[\s\S]{0,30}\b(this weekend|today|tomorrow|now)\b/
    ]
  },
  {
    topic: "feeding-window",
    patterns: [
      /\b(should|can|when|okay to|ok to|is it okay to)\b[\s\S]{0,40}\b(feed|feeding|fertili[sz](?:e|er))\b/,
      /\bfeed(?:ing)?\b[\s\S]{0,30}\b(now|this weekend|today|this week)\b/,
      /\bfertili[sz](?:e|er)\b[\s\S]{0,30}\b(now|today|this week)\b/
    ]
  },
  {
    topic: "seeding-window",
    patterns: [
      /\b(should|can|when|okay to|ok to|is it okay to)\b[\s\S]{0,40}\b(seed|seeding|overseed|overseeding)\b/,
      /\b(seed|overseed)\b[\s\S]{0,30}\b(now|this weekend|today|this week)\b/
    ]
  },
  {
    topic: "watering-guidance",
    patterns: [
      /\b(should|can|when|do i need to)\b[\s\S]{0,40}\b(water|watering|irrigat)\b/,
      /\bwater(?:ing)?\b[\s\S]{0,30}\b(now|today|this week)\b/
    ]
  },
  {
    topic: "weekend-plan",
    patterns: [
      /\bwhat should i do\b[\s\S]{0,30}\b(this weekend|this week)\b/,
      /\bplan\b[\s\S]{0,20}\b(this weekend|this week)\b/,
      /\bthis weekend\b[\s\S]{0,20}\bwhat\b/
    ]
  },
  {
    topic: "zone-comparison-insight",
    patterns: [
      /\b(wetter|drier)\s+than\b/,
      /\bcompare\b[\s\S]{0,20}\bzone\b/,
      /\bfront lawn\b[\s\S]{0,20}\bback lawn\b/,
      /\bback lawn\b[\s\S]{0,20}\bfront lawn\b/
    ]
  }
] as const;

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export const isCoachingHypothesisId = (
  value?: string
): value is CoachingHypothesisId =>
  Boolean(value) && (coachingHypothesisIds as readonly string[]).includes(value ?? "");

export const classifyDiagnosticRequest = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  contextSnapshot: DiagnosticContextSnapshot;
}): DiagnosticRequestRouting => {
  if (
    input.request.requestedMode === "recovery-plan" ||
    input.request.requestedMode === "products"
  ) {
    return {
      kind: "diagnosis",
      reasons: ["This turn is an explicit follow-up to an existing case."]
    };
  }

  if (input.request.requestedMode === "compare-zone") {
    return {
      kind: "coaching",
      topic: "zone-comparison-insight",
      reasons: ["The user explicitly asked for a zone comparison."]
    };
  }

  if (input.request.replyToQuestionId || input.currentState?.pendingQuestionId) {
    return {
      kind: "diagnosis",
      reasons: ["This turn is continuing an active diagnostic question."]
    };
  }

  if (input.request.images?.length || input.contextSnapshot.uploadedImages.length) {
    return {
      kind: "diagnosis",
      reasons: ["Attached photos usually mean the user wants a diagnosis."]
    };
  }

  const text = normalize(input.request.userMessage);
  const hasStrongDiagnosisCue = strongDiagnosisCuePatterns.some((pattern) => pattern.test(text));

  for (const matcher of coachingMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(text)) && !hasStrongDiagnosisCue) {
      return {
        kind: "coaching",
        topic: matcher.topic,
        reasons: [`The message reads as ${matcher.topic.replace(/-/g, " ")} rather than patch diagnosis.`]
      };
    }
  }

  return {
    kind: "diagnosis",
    reasons: [
      hasStrongDiagnosisCue
        ? "Problem-specific symptom language suggests a diagnosis flow."
        : "Defaulting to diagnosis when the user is describing a lawn issue."
    ]
  };
};
