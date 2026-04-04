export type LawnStatus = "thriving" | "stable" | "slightly-stressed" | "at-risk";
export type Confidence = "low" | "medium" | "high";
export type Urgency = "low" | "medium" | "high";
export type ActionType =
  | "water"
  | "feed"
  | "seed"
  | "mow"
  | "moss"
  | "drainage"
  | "observe"
  | "soil"
  | "scan"
  | "general";
export type TaskStatus = "pending" | "done" | "skipped";
export type GrassStyle = "hard-wearing" | "ornamental" | "shaded" | "unknown";
export type SoilType = "unknown" | "sandy" | "loam" | "clay";
export type ZoneExposure = "sunny" | "part-shade" | "shade" | "mixed";
export type MetricSystem = "metric" | "imperial";

export type LawnProfile = {
  grassStyle: GrassStyle;
  soilType: SoilType;
};

export type Lawn = {
  id: string;
  name: string;
  createdAt: string;
  profile: LawnProfile;
};

export type Zone = {
  id: string;
  lawnId: string;
  name: string;
  exposure: ZoneExposure;
  createdAt: string;
  sortOrder: number;
};

export type SensorMetrics = {
  moisture: number;
  soilTemperatureC: number;
  ec: number;
  ph: number;
  lightLux: number;
  humidity: number;
};

export type SensorReading = {
  id: string;
  zoneId: string;
  provider: "mock" | "ble";
  scenarioKey: string;
  takenAt: string;
  photoUri?: string;
  note?: string;
  metrics: SensorMetrics;
};

export type NormalizedWeatherDay = {
  date: string;
  summary: string;
  minTempC: number;
  maxTempC: number;
  rainProbability: number;
  precipitationMm: number;
  isFrostRisk: boolean;
};

export type NormalizedWeather = {
  source: "openweather" | "mock";
  capturedAt: string;
  location: {
    label: string;
    lat: number;
    lon: number;
  };
  current: {
    summary: string;
    temperatureC: number;
    humidity: number;
    rainProbability: number;
    precipitationMm: number;
    windSpeedMps: number;
    isFrostRisk: boolean;
  };
  daily: NormalizedWeatherDay[];
};

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  confidence: Confidence;
  actionType: ActionType;
  urgency: Urgency;
  positive?: boolean;
  idealDateStart?: string;
  idealDateEnd?: string;
  sourceRules: string[];
};

export type RecommendationSet = {
  id: string;
  readingId: string;
  zoneId: string;
  generatedAt: string;
  lawnStatus: LawnStatus;
  lawnScore: number;
  mainIssue: string;
  summary: string;
  interpretation: string;
  recommendations: Recommendation[];
  issues: string[];
  highlights: string[];
  doNow: string[];
  avoid: string[];
  checkAgainAt: string;
};

export type ScheduleTask = {
  id: string;
  readingId: string;
  title: string;
  reason: string;
  actionType: ActionType;
  urgency: Urgency;
  status: TaskStatus;
  startDate: string;
  endDate?: string;
};

export type ProductCategory =
  | "feed"
  | "moss-control"
  | "seed"
  | "aeration"
  | "soil-amendment"
  | "patch-repair"
  | "wetting-agent"
  | "top-dressing";

export type ProductCatalogItem = {
  id: string;
  name: string;
  category: ProductCategory;
  actionTypes: ActionType[];
  suitedGrassStyles: GrassStyle[];
  description: string;
  reasonHint: string;
  affiliateUrl: string;
  ctaLabel: string;
};

export type ProductRecommendation = {
  productId: string;
  title: string;
  why: string;
  affiliateUrl: string;
  ctaLabel: string;
};

export type TrendSummary = {
  key: string;
  text: string;
};

export const diagnosticSignalKeys = [
  "isolated_patch",
  "multiple_patches",
  "ring_pattern",
  "stripe_pattern",
  "random_irregular_patch",
  "dark_green_border",
  "sudden_appearance",
  "gradual_spread",
  "rest_of_lawn_healthy",
  "recent_fertiliser",
  "recent_weedkiller",
  "recent_mosskiller",
  "pet_presence",
  "recent_pet_wee",
  "dog_route",
  "tree_shade",
  "low_light",
  "wet_area",
  "dry_area",
  "compacted_area",
  "high_traffic",
  "birds_pecking",
  "turf_lifts_easily",
  "mushrooms_present",
  "red_threads_visible",
  "orange_dust_visible",
  "white_cottony_growth",
  "moss_visible",
  "thin_shaded_grass",
  "scorched_centre",
  "dry_soil",
  "soggy_soil",
  "under_object",
  "after_mowing",
  "scalped_look",
  "fuel_spill_pattern",
  "new_lawn",
  "washout_pattern",
  "bare_soil",
  "weeds_present",
  "rush_like_growth",
  "circular_expansion",
  "uniform_object_shape",
  "historically_weak_area",
  "acidic_reading"
] as const;

export type DiagnosticSignalKey = (typeof diagnosticSignalKeys)[number];

export type DiagnosticIssueFamily =
  | "patch"
  | "disease"
  | "pest"
  | "water"
  | "drainage"
  | "shade"
  | "chemical"
  | "mowing"
  | "moss"
  | "weed"
  | "soil"
  | "seeding"
  | "seasonal"
  | "general";

export type DiagnosticCaseStage =
  | "intake"
  | "narrowing"
  | "provisional"
  | "confident"
  | "monitoring";

export type DiagnosticCaseStatus =
  | "gathering-evidence"
  | "monitoring"
  | "confident"
  | "escalated"
  | "closed";

export type DiagnosticMode = "diagnose" | "recovery-plan" | "products" | "compare-zone";
export type DiagnosticAssistantMode =
  | "question-led"
  | "provisional-answer"
  | "confident-answer";

export type CareEventType =
  | "fertiliser"
  | "weedkiller"
  | "mosskiller"
  | "watering"
  | "mowing"
  | "overseeding"
  | "pet-urine"
  | "heavy-traffic"
  | "object-left"
  | "note";

export type UploadedCaseImage = {
  id: string;
  createdAt: string;
  label: "wide" | "close-up" | "roots" | "general";
  imageDataUrl: string;
};

export type UiSuggestionChip = {
  id: string;
  label: string;
  value: string;
  questionId?: string;
};

export type DiagnosticQuestion = {
  id: string;
  text: string;
  reason: string;
  effort: "low" | "medium" | "high";
  targetHypothesisIds: string[];
  quickReplies: UiSuggestionChip[];
};

export type DiagnosticEvidenceItem = {
  id: string;
  hypothesisId: string;
  text: string;
  source:
    | "image"
    | "weather"
    | "sensor"
    | "user"
    | "history"
    | "care-event"
    | "system";
  signal?: DiagnosticSignalKey;
  weight: number;
};

export type DiagnosticHypothesis = {
  id: string;
  label: string;
  issueFamily: DiagnosticIssueFamily;
  score: number;
  confidence: Confidence;
  evidenceFor: string[];
  evidenceAgainst: string[];
  missingSignals: string[];
  immediateActions: string[];
  followUpQuestionIds: string[];
  productCategoriesIfConfirmed: ProductCategory[];
};

export type DiagnosticTopHypothesis = Pick<
  DiagnosticHypothesis,
  | "id"
  | "label"
  | "issueFamily"
  | "score"
  | "confidence"
  | "evidenceFor"
  | "evidenceAgainst"
  | "missingSignals"
  | "productCategoriesIfConfirmed"
>;

export type DiagnosticVisibleHypothesis = {
  id: string;
  label: string;
  score: number;
  percentage: number;
  confidence: Confidence;
  issueFamily?: DiagnosticIssueFamily;
  kind: "hypothesis" | "other";
};

export type DiagnosticHypothesisHistoryItem = {
  id: string;
  label: string;
  issueFamily: DiagnosticIssueFamily;
  score: number;
  createdAt: string;
};

export type DiagnosticImageObservation = {
  summary: string;
  observedSignals: DiagnosticSignalKey[];
  notes: string[];
  confidence: Confidence;
  recommendedAdditionalImages: Array<UploadedCaseImage["label"]>;
};

export type DiagnosticHistoryContext = {
  currentCaseState?: DiagnosticCaseState;
  recentMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
  }>;
  recentCaseSummaries?: Array<{
    caseId: string;
    title: string;
    issueFamily: DiagnosticIssueFamily;
    outcome: string;
  }>;
  zoneTrendSummaries?: string[];
  siblingZoneInsights?: string[];
};

export type DiagnosticActionPlan = {
  doNow: string[];
  avoid: string[];
  watchFor: string[];
  recheckAt: string;
  whatWouldChange: string[];
};

export type RecoveryPlanStep = {
  id: string;
  title: string;
  reason: string;
  dayLabel: string;
  avoid?: boolean;
};

export type RecoveryPlanWindow = {
  title: "3-day" | "7-day" | "30-day";
  steps: RecoveryPlanStep[];
};

export type RecoveryPlan = {
  caseId: string;
  generatedAt: string;
  confidence: Confidence;
  windows: RecoveryPlanWindow[];
};

export type CaseReminder = {
  id: string;
  caseId: string;
  remindAt: string;
  title: string;
  note: string;
  status: "pending" | "sent" | "dismissed";
};

export type CareEvent = {
  id: string;
  createdAt: string;
  caseId?: string;
  zoneId?: string;
  type: CareEventType;
  title: string;
  note?: string;
};

export type DiagnosticContextSnapshot = {
  weatherContext?: NormalizedWeather;
  sensorContext?: SensorReading;
  lawnProfile?: LawnProfile;
  zoneContext?: Zone;
  historyContext?: DiagnosticHistoryContext;
  careEvents: CareEvent[];
  uploadedImages: UploadedCaseImage[];
  imageObservation?: DiagnosticImageObservation;
};

export type DiagnosticConfidence = {
  label: Confidence;
  topScore: number;
  scoreGap: number;
  rawTopScore: number;
  rawScoreGap: number;
  resolved: boolean;
  shouldAskFollowUp: boolean;
};

export type DiagnosticCaseState = {
  caseId: string;
  currentIntent: DiagnosticMode;
  stage: DiagnosticCaseStage;
  issueFamily: DiagnosticIssueFamily;
  topHypotheses: DiagnosticTopHypothesis[];
  visibleHypotheses: DiagnosticVisibleHypothesis[];
  evidenceFor: DiagnosticEvidenceItem[];
  evidenceAgainst: DiagnosticEvidenceItem[];
  missingInformation: string[];
  questionsAsked: string[];
  lockedHypothesisId?: string;
  lockedIssueFamily?: DiagnosticIssueFamily;
  hypothesisHistory: DiagnosticHypothesisHistoryItem[];
  pendingQuestionId?: string;
  pendingQuestion?: DiagnosticQuestion;
  confirmedSignals: DiagnosticSignalKey[];
  ruledOutSignals: DiagnosticSignalKey[];
  latestUserAnswers: Array<{
    questionId?: string;
    value: string;
    createdAt: string;
  }>;
  uploadedImages: UploadedCaseImage[];
  weatherContext?: NormalizedWeather;
  sensorContext?: SensorReading;
  lawnProfile?: LawnProfile;
  zoneContext?: Zone;
  historyContext?: DiagnosticHistoryContext;
  confidence: DiagnosticConfidence;
  recommendedNextQuestions: DiagnosticQuestion[];
  currentActionPlan: DiagnosticActionPlan;
  escalationFlags: string[];
  careEvents: CareEvent[];
  imageObservation?: DiagnosticImageObservation;
  productSuggestionCategories: ProductCategory[];
  recoveryPlan?: RecoveryPlan;
};

export type DiagnosticCase = {
  id: string;
  title: string;
  status: DiagnosticCaseStatus;
  stage: DiagnosticCaseStage;
  createdAt: string;
  updatedAt: string;
  zoneId?: string;
  issueFamily: DiagnosticIssueFamily;
  summary: string;
  confidence: Confidence;
  topHypothesisLabel?: string;
  archived: boolean;
  legacyImported?: boolean;
};

export type DiagnosticAssistantTurn = {
  id: string;
  createdAt: string;
  mode: DiagnosticAssistantMode;
  message: string;
  supportingPoints: string[];
  pendingQuestion?: DiagnosticQuestion;
  interimAdvice: string[];
  confidenceSummary: string;
  visibleHypotheses: DiagnosticVisibleHypothesis[];
  verdict: string;
  reasoning: string[];
  evidenceFor: string[];
  evidenceAgainst: string[];
  followUpQuestions: DiagnosticQuestion[];
  doNow: string[];
  avoid: string[];
  watchFor: string[];
  recheckAt: string;
  confidenceNote: string;
  whatWouldChange: string[];
  topHypotheses: Array<{
    id: string;
    label: string;
    score: number;
    confidence: Confidence;
  }>;
};

export type DiagnosticUserMessage = {
  id: string;
  createdAt: string;
  text: string;
  replyToQuestionId?: string;
  quickReplyValue?: string;
  images: UploadedCaseImage[];
};

export type DiagnosticMessage =
  | ({
      id: string;
      caseId: string;
      createdAt: string;
      role: "user";
    } & DiagnosticUserMessage)
  | {
      id: string;
      caseId: string;
      createdAt: string;
      role: "assistant";
      assistantTurn: DiagnosticAssistantTurn;
    };

export type DiagnosticTurnRequest = {
  caseId?: string;
  userMessage: string;
  replyToQuestionId?: string;
  quickReplyValue?: string;
  images?: UploadedCaseImage[];
  requestedMode?: DiagnosticMode;
  zoneContext?: Zone;
  weatherContext?: NormalizedWeather;
  sensorContext?: SensorReading;
  lawnProfile?: LawnProfile;
  historyContext?: DiagnosticHistoryContext;
  careEvents?: CareEvent[];
};

export type DiagnosticTurnResponse = {
  case: DiagnosticCase;
  assistantTurn: DiagnosticAssistantTurn;
  updatedState: DiagnosticCaseState;
  recoveryPlan?: RecoveryPlan;
  productSuggestionCategories?: ProductCategory[];
  uiHints: {
    quickReplies: UiSuggestionChip[];
    suggestedActions: string[];
  };
};

export type DiagnosticComposerDraft = {
  mode: DiagnosticAssistantMode;
  message: string;
  supportingPoints: string[];
  interimAdvice: string[];
  confidenceSummary: string;
};

/**
 * @deprecated Kept for transitional compatibility with older app code.
 */
export type AiAskPayload = {
  question: string;
  imageDataUrl?: string;
  latestReading?: SensorReading;
  zone?: Zone;
  weather?: NormalizedWeather;
  recentRecommendations?: Recommendation[];
};

/**
 * @deprecated Kept for transitional compatibility with older app code.
 */
export type AiAskStructuredResponse = {
  answer: string;
  confidenceNote: string;
  suggestedActions: string[];
  disclaimer: string;
};
