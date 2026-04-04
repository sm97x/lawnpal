import type {
  Confidence,
  DiagnosticActionPlan,
  DiagnosticCaseState,
  DiagnosticConfidence,
  DiagnosticContextSnapshot,
  DiagnosticEvidenceItem,
  DiagnosticHypothesis,
  DiagnosticIssueFamily,
  DiagnosticSignalKey,
  DiagnosticTopHypothesis,
  DiagnosticTurnRequest,
  DiagnosticVisibleHypothesis,
  ProductCategory
} from "../types";
import { makeId } from "../utils/id";
import {
  diagnosticPlaybooks,
  getDiagnosticQuestionTemplate,
  type DiagnosticPlaybook
} from "./playbooks";
import { classifyDiagnosticRequest, isCoachingHypothesisId } from "./requestRouting";
import { extractDiagnosticSignals } from "./signalExtraction";

export type DiagnosticScoringResult = {
  rankedHypotheses: DiagnosticHypothesis[];
  topHypotheses: DiagnosticTopHypothesis[];
  visibleHypotheses: DiagnosticVisibleHypothesis[];
  evidenceFor: DiagnosticEvidenceItem[];
  evidenceAgainst: DiagnosticEvidenceItem[];
  issueFamily: DiagnosticIssueFamily;
  confidence: DiagnosticConfidence;
  currentActionPlan: DiagnosticActionPlan;
  escalationFlags: string[];
  productSuggestionCategories: ProductCategory[];
  missingInformation: string[];
  contextSnapshot: DiagnosticContextSnapshot;
  presentSignals: DiagnosticSignalKey[];
  absentSignals: DiagnosticSignalKey[];
};

const sourceFromContext = (
  playbook: DiagnosticPlaybook,
  signalId: string
): DiagnosticEvidenceItem["source"] => {
  if (signalId.includes("weedkiller") || signalId.includes("fertiliser") || signalId.includes("mosskiller")) {
    return "care-event";
  }

  if (signalId.includes("light") || signalId.includes("shade")) {
    return "weather";
  }

  if (
    signalId.includes("dry") ||
    signalId.includes("wet") ||
    signalId.includes("soggy") ||
    signalId.includes("light")
  ) {
    return "sensor";
  }

  if (playbook.issueFamily === "disease" || signalId.includes("mushroom")) {
    return "image";
  }

  return "user";
};

const signalFallbackText: Record<string, string> = {
  pet_presence: "No pet activity has been confirmed yet.",
  dog_route: "This does not sound like a usual dog route yet.",
  recent_fertiliser: "There is no recent fertiliser evidence yet.",
  recent_weedkiller: "There is no recent weedkiller evidence yet.",
  recent_mosskiller: "There is no recent moss treatment evidence yet.",
  wet_area: "The patch does not currently read as especially wet.",
  dry_area: "The patch does not currently read as especially dry.",
  dry_soil: "Soil dryness has not been confirmed yet.",
  tree_shade: "Shade has not been confirmed yet.",
  turf_lifts_easily: "Easy turf lift has not been confirmed yet.",
  birds_pecking: "There is no clear bird or animal disturbance yet.",
  mushrooms_present: "There are no mushroom clues yet.",
  red_threads_visible: "There are no red thread clues yet.",
  orange_dust_visible: "There is no orange spore clue yet.",
  white_cottony_growth: "There is no white fungal growth clue yet.",
  under_object: "No recent object footprint has been confirmed."
};

const confidenceFromScore = (score: number): Confidence => {
  if (score >= 0.78) {
    return "high";
  }

  if (score >= 0.58) {
    return "medium";
  }

  return "low";
};

const addEvidence = (
  list: DiagnosticEvidenceItem[],
  input: Omit<DiagnosticEvidenceItem, "id">
) => {
  list.push({
    id: makeId("evidence"),
    ...input
  });
};

const pushScore = (
  rawScores: Map<string, number>,
  evidenceFor: DiagnosticEvidenceItem[],
  input: {
    hypothesisId: string;
    weight: number;
    text: string;
    source: DiagnosticEvidenceItem["source"];
    signal?: DiagnosticEvidenceItem["signal"];
  }
) => {
  rawScores.set(input.hypothesisId, (rawScores.get(input.hypothesisId) ?? 0) + input.weight);
  addEvidence(evidenceFor, input);
};

const pullScore = (
  rawScores: Map<string, number>,
  evidenceAgainst: DiagnosticEvidenceItem[],
  input: {
    hypothesisId: string;
    weight: number;
    text: string;
    source: DiagnosticEvidenceItem["source"];
    signal?: DiagnosticEvidenceItem["signal"];
  }
) => {
  rawScores.set(input.hypothesisId, (rawScores.get(input.hypothesisId) ?? 0) - input.weight);
  addEvidence(evidenceAgainst, input);
};

const buildRoundedPercentages = (scores: number[]) => {
  const raw = scores.map((score) => score * 100);
  const rounded = raw.map((value) => Math.floor(value));
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value)
    }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const item of order) {
    if (remainder <= 0) {
      break;
    }

    rounded[item.index] = (rounded[item.index] ?? 0) + 1;
    remainder -= 1;
  }

  return rounded;
};

const buildVisibleHypotheses = (
  rankedHypotheses: DiagnosticHypothesis[]
): DiagnosticVisibleHypothesis[] => {
  const primary = rankedHypotheses.slice(0, 3).map((hypothesis) => ({
    id: hypothesis.id,
    label: hypothesis.label,
    score: hypothesis.score,
    confidence: hypothesis.confidence,
    issueFamily: hypothesis.issueFamily,
    kind: "hypothesis" as const
  }));
  const otherScore = Math.max(
    0,
    1 - primary.reduce((sum, hypothesis) => sum + hypothesis.score, 0)
  );
  const entries = otherScore > 0.005
    ? [
        ...primary,
        {
          id: "other",
          label: "Other possibilities",
          score: otherScore,
          confidence: "low" as const,
          kind: "other" as const
        }
      ]
    : primary;
  const percentages = buildRoundedPercentages(entries.map((entry) => entry.score));

  return entries.map((entry, index) => ({
    ...entry,
    percentage: percentages[index] ?? 0
  }));
};

const hasSignal = (signals: Set<string>, signal: string) => signals.has(signal);

const getNearTermWeather = (snapshot: DiagnosticContextSnapshot) => {
  const daily = snapshot.weatherContext?.daily.slice(0, 3) ?? [];
  const heavyRainSoon = daily.some(
    (day) => day.rainProbability >= 60 || day.precipitationMm >= 3
  );
  const frostRiskSoon = daily.some((day) => day.isFrostRisk);
  const currentRainChance = snapshot.weatherContext?.current.rainProbability ?? 0;

  return {
    heavyRainSoon,
    frostRiskSoon,
    currentRainChance
  };
};

const getRecentTreatmentLabel = (snapshot: DiagnosticContextSnapshot) => {
  const latest = [...snapshot.careEvents]
    .reverse()
    .find((event) => ["weedkiller", "fertiliser", "mosskiller"].includes(event.type));

  if (!latest) {
    return "the last treatment";
  }

  switch (latest.type) {
    case "weedkiller":
      return "weedkiller";
    case "fertiliser":
      return "feed";
    case "mosskiller":
      return "moss treatment";
    default:
      return latest.title.toLowerCase();
  }
};

const applyRequestRoutingBonuses = (input: {
  rawScores: Map<string, number>;
  evidenceFor: DiagnosticEvidenceItem[];
  snapshot: DiagnosticContextSnapshot;
  routing: ReturnType<typeof classifyDiagnosticRequest>;
  signals: Set<string>;
}) => {
  if (input.routing.kind !== "coaching" || !input.routing.topic) {
    return;
  }

  const moisture = input.snapshot.sensorContext?.metrics.moisture;
  const soilTemp = input.snapshot.sensorContext?.metrics.soilTemperatureC;
  const { heavyRainSoon, frostRiskSoon, currentRainChance } = getNearTermWeather(input.snapshot);
  const likelySoftGround =
    moisture !== undefined ? moisture >= 72 || hasSignal(input.signals, "wet_area") : heavyRainSoon;
  const likelyDryRootZone =
    moisture !== undefined ? moisture <= 40 || hasSignal(input.signals, "dry_soil") : false;

  pushScore(input.rawScores, input.evidenceFor, {
    hypothesisId: input.routing.topic,
    weight: 6.4,
    text: input.routing.reasons[0] ?? "This reads as a lawn coaching question rather than a fresh diagnosis.",
    source: "system"
  });

  switch (input.routing.topic) {
    case "mowing-window":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "mowing-window",
        weight: likelySoftGround ? 0.55 : 1,
        text: likelySoftGround
          ? "Surface conditions still look soft enough to affect mowing timing."
          : "Surface conditions look firm enough for a mowing answer.",
        source: "weather"
      });
      break;
    case "feeding-window":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "feeding-window",
        weight:
          soilTemp !== undefined && soilTemp >= 10 && !heavyRainSoon && !likelySoftGround ? 1.25 : 0.7,
        text:
          soilTemp !== undefined && soilTemp >= 10 && !heavyRainSoon && !likelySoftGround
            ? "Soil warmth and near-term weather are good enough to answer the feeding window directly."
            : "Soil warmth or near-term weather is the main thing shaping the feeding window.",
        source: "sensor"
      });
      break;
    case "seeding-window":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "seeding-window",
        weight:
          soilTemp !== undefined && soilTemp >= 10 && !frostRiskSoon ? 1.35 : soilTemp !== undefined && soilTemp >= 8 ? 0.95 : 0.65,
        text:
          soilTemp !== undefined && soilTemp >= 10 && !frostRiskSoon
            ? "Soil warmth is strong enough to give a direct seeding answer."
            : soilTemp !== undefined && soilTemp >= 8
              ? "Soil warmth is borderline, so the seeding answer needs a little caution."
              : "Cold soil is the main limiter for seeding right now.",
        source: "sensor"
      });
      break;
    case "watering-guidance":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "watering-guidance",
        weight: likelyDryRootZone && !heavyRainSoon && currentRainChance < 45 ? 1.3 : 0.9,
        text:
          likelyDryRootZone && !heavyRainSoon && currentRainChance < 45
            ? "Root-zone moisture and the forecast are enough to answer watering directly."
            : "Current moisture and rain risk are the key inputs for watering guidance.",
        source: "sensor"
      });
      break;
    case "weekend-plan":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "weekend-plan",
        weight: 1.15,
        text: "The question is about a practical weekend plan rather than identifying a patch cause.",
        source: "system"
      });
      break;
    case "treatment-safety":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "treatment-safety",
        weight: input.snapshot.careEvents.length ? 1.2 : 0.85,
        text: input.snapshot.careEvents.length
          ? `Recent care events mean this is best handled as a ${getRecentTreatmentLabel(input.snapshot)} safety question.`
          : "This is best handled as a treatment-safety question rather than a diagnosis.",
        source: "care-event"
      });
      break;
    case "zone-comparison-insight":
      pushScore(input.rawScores, input.evidenceFor, {
        hypothesisId: "zone-comparison-insight",
        weight:
          (input.snapshot.historyContext?.siblingZoneInsights?.length ?? 0) > 0 ||
          (input.snapshot.historyContext?.zoneTrendSummaries?.length ?? 0) > 0
            ? 1.25
            : 0.9,
        text:
          (input.snapshot.historyContext?.siblingZoneInsights?.length ?? 0) > 0
            ? "Zone history already contains a meaningful front/back or wetter/drier contrast."
            : "This sounds like a zone comparison question rather than a fresh diagnosis.",
        source: "history"
      });
      break;
  }
};

const isIncidentPatchCase = (signals: Set<string>) =>
  hasSignal(signals, "isolated_patch") &&
  (hasSignal(signals, "rest_of_lawn_healthy") ||
    hasSignal(signals, "sudden_appearance") ||
    hasSignal(signals, "scorched_centre"));

const addContextualBonuses = (
  rawScores: Map<string, number>,
  evidenceFor: DiagnosticEvidenceItem[],
  evidenceAgainst: DiagnosticEvidenceItem[],
  snapshot: DiagnosticContextSnapshot,
  signals: Set<string>
) => {
  const moisture = snapshot.sensorContext?.metrics.moisture;
  const lightLux = snapshot.sensorContext?.metrics.lightLux;
  const ph = snapshot.sensorContext?.metrics.ph;
  const humidity = snapshot.weatherContext?.current.humidity;
  const zoneExposure = snapshot.zoneContext?.exposure;
  const trendText = snapshot.historyContext?.zoneTrendSummaries?.join(" ").toLowerCase() ?? "";
  const isSuddenIncident =
    hasSignal(signals, "isolated_patch") &&
    (hasSignal(signals, "sudden_appearance") || hasSignal(signals, "scorched_centre"));
  const incidentPatchCase = isIncidentPatchCase(signals);

  if (moisture !== undefined) {
    if (moisture >= 76 && (!incidentPatchCase || hasSignal(signals, "wet_area"))) {
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "waterlogging",
        weight: 0.9,
        text: "Sensor moisture is high.",
        source: "sensor"
      });
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "overwatering",
        weight: 0.65,
        text: "The latest moisture reading is elevated.",
        source: "sensor"
      });
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "moss-dominance",
        weight: 0.3,
        text: "Wet conditions support moss pressure.",
        source: "sensor"
      });
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "fusarium",
        weight: 0.25,
        text: "Cool wet turf slightly raises fungal concern.",
        source: "sensor"
      });
    }

    if (moisture <= 32 && (!incidentPatchCase || hasSignal(signals, "dry_area"))) {
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "drought-stress",
        weight: 0.95,
        text: "Sensor moisture is low.",
        source: "sensor"
      });
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "dry-patch",
        weight: 1.1,
        text: "The root zone is reading dry.",
        source: "sensor"
      });
    }
  }

  if (
    lightLux !== undefined &&
    lightLux <= 6500 &&
    !isSuddenIncident &&
    !incidentPatchCase &&
    (hasSignal(signals, "tree_shade") || hasSignal(signals, "thin_shaded_grass"))
  ) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "shade-weakness",
      weight: 0.35,
      text: "Light levels are low in this zone.",
      source: "sensor"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "moss-dominance",
      weight: 0.2,
      text: "Low light can support moss pressure.",
      source: "sensor"
    });
  }

  if (
    (zoneExposure === "shade" || zoneExposure === "part-shade") &&
    !isSuddenIncident &&
    !incidentPatchCase &&
    hasSignal(signals, "tree_shade")
  ) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "shade-weakness",
      weight: zoneExposure === "shade" ? 0.2 : 0.1,
      text: "The zone exposure is shaded.",
      source: "system"
    });
  }

  if (ph !== undefined && ph < 6 && !incidentPatchCase) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "soil-ph-stress",
      weight: hasSignal(signals, "acidic_reading") || hasSignal(signals, "historically_weak_area") ? 0.95 : 0.55,
      text: "Soil pH is below the ideal turf range.",
      source: "sensor"
    });
    if (hasSignal(signals, "moss_visible") || hasSignal(signals, "thin_shaded_grass")) {
      pushScore(rawScores, evidenceFor, {
        hypothesisId: "moss-dominance",
        weight: 0.2,
        text: "Acidic readings can support moss pressure.",
        source: "sensor"
      });
    }
  }

  if (humidity !== undefined && humidity >= 86) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "fusarium",
      weight: 0.45,
      text: "Humidity is high enough to support fungal pressure.",
      source: "weather"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "red-thread",
      weight: 0.25,
      text: "Humid weather slightly supports red thread.",
      source: "weather"
    });
  }

  if (trendText.includes("wetter than usual")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "waterlogging",
      weight: incidentPatchCase ? 0.2 : 0.45,
      text: "History suggests this zone has been wetter than usual.",
      source: "history"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "compaction",
      weight: incidentPatchCase ? 0.15 : 0.3,
      text: "Persistent wetness can come from compaction.",
      source: "history"
    });
  }

  if (trendText.includes("drying out")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dry-patch",
      weight: incidentPatchCase ? 0.15 : 0.25,
      text: "History suggests the zone has been drying out.",
      source: "history"
    });
  }

  if (incidentPatchCase) {
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "shade-weakness",
      weight: 0.8,
      text: "A single isolated patch is a poor fit for a broad shade issue.",
      source: "system"
    });
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "moss-dominance",
      weight: 0.55,
      text: "A sharp isolated patch points away from moss as the main cause.",
      source: "system"
    });
  }

  if (isSuddenIncident) {
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "shade-weakness",
      weight: 0.9,
      text: "A sudden isolated patch points away from a slow shade decline.",
      source: "system"
    });
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "moss-dominance",
      weight: 0.65,
      text: "Moss pressure is usually gradual rather than sudden.",
      source: "system"
    });
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "soil-ph-stress",
      weight: 0.55,
      text: "A sudden patch is less typical of background soil stress.",
      source: "system"
    });
  }
};

const addPatternBonuses = (
  rawScores: Map<string, number>,
  evidenceFor: DiagnosticEvidenceItem[],
  evidenceAgainst: DiagnosticEvidenceItem[],
  signalResult: ReturnType<typeof extractDiagnosticSignals>
) => {
  const has = (signal: string) => signalResult.presentSignals.has(signal as never);

  if (has("isolated_patch") && has("rest_of_lawn_healthy")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 1.4,
      text: "One isolated patch while the rest stays healthy fits local scorch well.",
      source: "user"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "object-heat-scorch",
      weight: 0.45,
      text: "A single isolated patch also keeps object scorch on the list.",
      source: "user"
    });
  }

  if (has("isolated_patch") && has("sudden_appearance")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 0.9,
      text: "Sudden onset fits local scorch better than slow structural decline.",
      source: "user"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "fertiliser-scorch",
      weight: 0.5,
      text: "Sudden onset is also compatible with scorch.",
      source: "user"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "weedkiller-damage",
      weight: 0.45,
      text: "Sudden change keeps spray damage in play.",
      source: "user"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "object-heat-scorch",
      weight: 0.55,
      text: "Fast onset also fits heat or smothering damage.",
      source: "user"
    });
  }

  if (has("pet_presence") && has("isolated_patch")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 2.2,
      text: "Pets plus one isolated patch strongly support dog urine scorch.",
      source: "user"
    });
  }

  if (has("pet_presence") && has("recent_pet_wee")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 3,
      text: "A recent wee in that exact area is close to confirmatory evidence.",
      source: "user"
    });
  }

  if (has("pet_presence") && has("dog_route")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 2.5,
      text: "A known toilet route makes dog urine the clear front-runner.",
      source: "user"
    });
  }

  if (
    has("pet_presence") &&
    has("rest_of_lawn_healthy") &&
    (has("sudden_appearance") || has("scorched_centre"))
  ) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "dog-urine",
      weight: 1.6,
      text: "Pets, a healthy surrounding lawn, and scorch-like damage point strongly to urine burn.",
      source: "user"
    });
  }

  if (
    (has("dry_area") || has("dry_soil")) &&
    !has("pet_presence") &&
    !has("recent_pet_wee") &&
    !has("dog_route")
  ) {
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "dog-urine",
      weight: has("dry_soil") ? 1.25 : 0.8,
      text: "A dry, stubborn patch without any pet clue points away from dog urine.",
      source: "system"
    });
  }

  if (has("dry_area") && has("dry_soil") && !has("isolated_patch") && !has("tree_shade")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "drought-stress",
      weight: 0.9,
      text: "Broad dry conditions fit drought stress better than one stubborn dry patch.",
      source: "system"
    });
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "dry-patch",
      weight: 0.8,
      text: "Without one isolated stubborn patch, dry patch is less convincing than general drought stress.",
      source: "system"
    });
  }

  if (has("dry_area") && has("gradual_spread") && !has("sudden_appearance")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "take-all-patch",
      weight: has("tree_shade") ? 1 : 1.35,
      text: "A gradually spreading patch in dry stress fits take-all better than a one-off scorch event.",
      source: "system"
    });
    if (!has("tree_shade")) {
      pullScore(rawScores, evidenceAgainst, {
        hypothesisId: "dry-patch",
        weight: 0.55,
        text: "A gradually widening dry-weather patch in open turf fits take-all better than a stubborn local dry patch.",
        source: "system"
      });
    }
  }

  if (has("historically_weak_area") && has("acidic_reading")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "soil-ph-stress",
      weight: 1.65,
      text: "Long-term underperformance plus acidic soil context strongly supports a soil-health issue.",
      source: "user"
    });
  }

  if (has("historically_weak_area") && !has("sudden_appearance")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "soil-ph-stress",
      weight: 0.75,
      text: "A chronic weak area fits background soil stress better than a sudden incident.",
      source: "user"
    });
  }

  if (
    has("isolated_patch") &&
    has("rest_of_lawn_healthy") &&
    (has("pet_presence") || has("recent_pet_wee") || has("dog_route"))
  ) {
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "shade-weakness",
      weight: 1.3,
      text: "An isolated pet-linked patch points away from shade as the main explanation.",
      source: "system"
    });
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "moss-dominance",
      weight: 0.9,
      text: "Pet-linked scorch points away from moss as the main explanation.",
      source: "system"
    });
  }

  if (has("tree_shade") && has("gradual_spread")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "shade-weakness",
      weight: 1,
      text: "Shade plus gradual decline supports a shade-driven weakness.",
      source: "user"
    });
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "moss-dominance",
      weight: 0.6,
      text: "Gradual shaded decline can also open the door to moss pressure.",
      source: "user"
    });
  }

  if (has("low_light") && has("thin_shaded_grass")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "shade-weakness",
      weight: 1.3,
      text: "Thin grass in low light strongly supports shade weakness.",
      source: "image"
    });
  }

  if (has("recent_weedkiller") && has("sudden_appearance")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "weedkiller-damage",
      weight: 0.8,
      text: "Recent weedkiller plus sudden change is a strong product-damage pattern.",
      source: "care-event"
    });
  }

  if (has("recent_fertiliser") && has("sudden_appearance")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "fertiliser-scorch",
      weight: 0.7,
      text: "Recent feed plus sudden change fits fertiliser scorch.",
      source: "care-event"
    });
  }

  if (has("after_mowing")) {
    pullScore(rawScores, evidenceAgainst, {
      hypothesisId: "dog-urine",
      weight: 1.1,
      text: "A clear mowing link points away from dog urine as the main cause.",
      source: "system"
    });
  }

  if (has("after_mowing") && has("scalped_look")) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "scalping",
      weight: 1.4,
      text: "A low-cut patch on a bump or slope is a classic scalping pattern.",
      source: "user"
    });
  }
};

const applyScoreInertia = (
  rawScores: Map<string, number>,
  evidenceFor: DiagnosticEvidenceItem[],
  currentState?: DiagnosticCaseState
) => {
  const lockedHypothesisId =
    currentState?.lockedHypothesisId ??
    (currentState?.topHypotheses[0]?.score && currentState.topHypotheses[0].score >= 0.56
      ? currentState.topHypotheses[0].id
      : undefined);

  if (!lockedHypothesisId) {
    return;
  }

  const weight =
    currentState?.stage === "confident"
      ? 1.05
      : currentState?.stage === "provisional"
        ? 0.85
        : 0.65;

  pushScore(rawScores, evidenceFor, {
    hypothesisId: lockedHypothesisId,
    weight,
    text: "Previous turns already pointed strongly in this direction, so Lawn Pal is keeping that lead unless new evidence clearly beats it.",
    source: "system"
  });
};

const isResolvedDiagnosis = (input: {
  topHypothesisId?: string;
  signals: Set<string>;
  hasUrgentChemicalSignal: boolean;
  rawTopScore: number;
  rawScoreGap: number;
}) => {
  if (!input.topHypothesisId) {
    return false;
  }

  if (
    input.topHypothesisId === "dog-urine" &&
    hasSignal(input.signals, "isolated_patch") &&
    hasSignal(input.signals, "pet_presence") &&
    (hasSignal(input.signals, "recent_pet_wee") || hasSignal(input.signals, "dog_route")) &&
    (hasSignal(input.signals, "rest_of_lawn_healthy") ||
      hasSignal(input.signals, "sudden_appearance") ||
      hasSignal(input.signals, "scorched_centre")) &&
    !hasSignal(input.signals, "recent_fertiliser") &&
    !hasSignal(input.signals, "recent_weedkiller") &&
    !hasSignal(input.signals, "recent_mosskiller")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "object-heat-scorch" &&
    hasSignal(input.signals, "under_object") &&
    (hasSignal(input.signals, "uniform_object_shape") || hasSignal(input.signals, "isolated_patch"))
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "scalping" &&
    hasSignal(input.signals, "after_mowing") &&
    hasSignal(input.signals, "scalped_look")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "weedkiller-damage" &&
    hasSignal(input.signals, "recent_weedkiller") &&
    (hasSignal(input.signals, "sudden_appearance") || hasSignal(input.signals, "stripe_pattern"))
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "fertiliser-scorch" &&
    hasSignal(input.signals, "recent_fertiliser") &&
    (hasSignal(input.signals, "sudden_appearance") || hasSignal(input.signals, "stripe_pattern"))
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "mosskiller-damage" &&
    hasSignal(input.signals, "recent_mosskiller") &&
    (hasSignal(input.signals, "moss_visible") || hasSignal(input.signals, "wet_area"))
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "drought-stress" &&
    hasSignal(input.signals, "dry_area") &&
    hasSignal(input.signals, "dry_soil") &&
    !hasSignal(input.signals, "isolated_patch")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "dry-patch" &&
    hasSignal(input.signals, "isolated_patch") &&
    hasSignal(input.signals, "dry_soil") &&
    (hasSignal(input.signals, "tree_shade") || hasSignal(input.signals, "dry_area"))
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "waterlogging" &&
    hasSignal(input.signals, "wet_area") &&
    hasSignal(input.signals, "soggy_soil")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "compaction" &&
    hasSignal(input.signals, "compacted_area") &&
    hasSignal(input.signals, "high_traffic")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "shade-weakness" &&
    hasSignal(input.signals, "tree_shade") &&
    hasSignal(input.signals, "low_light") &&
    hasSignal(input.signals, "thin_shaded_grass") &&
    hasSignal(input.signals, "gradual_spread")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "moss-dominance" &&
    hasSignal(input.signals, "moss_visible") &&
    hasSignal(input.signals, "low_light") &&
    hasSignal(input.signals, "wet_area")
  ) {
    return true;
  }

  if (input.topHypothesisId === "red-thread" && hasSignal(input.signals, "red_threads_visible")) {
    return true;
  }

  if (input.topHypothesisId === "rust" && hasSignal(input.signals, "orange_dust_visible")) {
    return true;
  }

  if (input.topHypothesisId === "fusarium" && hasSignal(input.signals, "white_cottony_growth")) {
    return true;
  }

  if (
    input.topHypothesisId === "fairy-ring" &&
    hasSignal(input.signals, "ring_pattern") &&
    hasSignal(input.signals, "mushrooms_present")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "chafer-grubs" &&
    hasSignal(input.signals, "birds_pecking") &&
    hasSignal(input.signals, "turf_lifts_easily") &&
    hasSignal(input.signals, "bare_soil")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "leatherjackets" &&
    hasSignal(input.signals, "birds_pecking") &&
    hasSignal(input.signals, "turf_lifts_easily") &&
    hasSignal(input.signals, "wet_area")
  ) {
    return true;
  }

  if (
    input.topHypothesisId === "new-lawn-failure" &&
    hasSignal(input.signals, "new_lawn") &&
    (hasSignal(input.signals, "washout_pattern") || hasSignal(input.signals, "bare_soil"))
  ) {
    return true;
  }

  if (input.hasUrgentChemicalSignal && input.rawTopScore >= 3.8) {
    return true;
  }

  return false;
};

const buildActionPlan = (input: {
  playbook: DiagnosticPlaybook;
  confidence: DiagnosticConfidence;
  snapshot: DiagnosticContextSnapshot;
  now: string;
  requestedMode: DiagnosticTurnRequest["requestedMode"];
}): DiagnosticActionPlan => {
  const dateBase =
    input.snapshot.sensorContext?.takenAt ??
    input.snapshot.weatherContext?.capturedAt ??
    input.now;

  const recheckDays =
    input.playbook.urgency === "high"
      ? 1
      : input.confidence.label === "low"
        ? 2
        : input.playbook.urgency === "medium"
          ? 3
          : 5;

  const recheckAt = new Date(
    new Date(dateBase).getTime() + recheckDays * 24 * 60 * 60 * 1000
  ).toISOString();

  if (isCoachingHypothesisId(input.playbook.id)) {
    const moisture = input.snapshot.sensorContext?.metrics.moisture;
    const soilTemp = input.snapshot.sensorContext?.metrics.soilTemperatureC;
    const { heavyRainSoon, frostRiskSoon, currentRainChance } = getNearTermWeather(input.snapshot);
    const likelySoftGround =
      moisture !== undefined ? moisture >= 72 : heavyRainSoon;
    const likelyDryRootZone = moisture !== undefined ? moisture <= 40 : currentRainChance < 35;

    switch (input.playbook.id) {
      case "mowing-window":
        return {
          doNow: [
            likelySoftGround
              ? "Hold off mowing until the surface firms up and the next wet spell passes."
              : "Mowing looks fine once the grass is dry on top and the surface feels firm.",
            "Keep the cut a touch higher if the lawn is patchy, soft, or shaded."
          ].slice(0, 2),
          avoid: [
            "Do not mow soft, smeary, or frosty turf.",
            "Do not scalp a recovering patch."
          ],
          watchFor: [
            "Wheel marks or smearing mean it is still too wet to cut cleanly.",
            "If the patch looks shredded after mowing, raise the height."
          ],
          recheckAt,
          whatWouldChange: ["A wetter forecast or softer ground would change the mowing advice."]
        };
      case "feeding-window":
        return {
          doNow: [
            soilTemp !== undefined && soilTemp >= 10 && !heavyRainSoon && !likelySoftGround
              ? "Feeding looks reasonable in the next few days if the lawn is actively growing."
              : "Hold off feeding until the lawn is actively growing and the ground is not soft or stressed.",
            "Use a steady growth window rather than forcing feed into stress."
          ].slice(0, 2),
          avoid: [
            "Do not feed a frosty, drought-stressed, or waterlogged lawn.",
            "Do not stack feed on top of recent chemical stress."
          ],
          watchFor: [
            "Skip it if heavy rain moves in or the lawn turns soft and wet.",
            "If growth is still sluggish in cold soil, wait."
          ],
          recheckAt,
          whatWouldChange: ["Warmer soil and a calmer forecast would improve the feeding window."]
        };
      case "seeding-window":
        return {
          doNow: [
            soilTemp !== undefined && soilTemp >= 10 && !frostRiskSoon
              ? "Seeding looks good once the surface is workable and moisture can stay even."
              : soilTemp !== undefined && soilTemp >= 8
                ? "Seeding is possible but still marginal, so only do it if you can protect moisture and avoid frost."
                : "Hold off seeding until the soil warms a bit more.",
            "Aim for even moisture rather than saturated soil."
          ].slice(0, 2),
          avoid: [
            "Do not overseed into cold soil with fresh frost risk.",
            "Do not let the seedbed swing between bone dry and waterlogged."
          ],
          watchFor: [
            "Warmer overnight temperatures make the window stronger.",
            "A sharper frost signal or heavy washout risk would weaken it."
          ],
          recheckAt,
          whatWouldChange: ["Soil temperature and frost risk are the main things that would change the seeding answer."]
        };
      case "watering-guidance":
        return {
          doNow: [
            likelyDryRootZone && !heavyRainSoon && currentRainChance < 45
              ? "A deep watering makes sense; let the root zone drink rather than sprinkling little and often."
              : "Hold off watering for now and let current moisture or upcoming rain do the work.",
            "Re-check the root-zone moisture before topping up again."
          ].slice(0, 2),
          avoid: [
            "Do not keep adding light water to already damp turf.",
            "Do not water just because the top surface looks tired after heat."
          ],
          watchFor: [
            "If the area still stays bone dry after watering, think about dry patch.",
            "If rain actually lands, re-check before watering again."
          ],
          recheckAt,
          whatWouldChange: ["A drier root zone or a sharper rain signal would change the watering advice."]
        };
      case "weekend-plan": {
        const weekendSteps = [
          likelySoftGround
            ? "Skip mowing until the surface is firmer."
            : "Mow if the grass is dry on top and the surface feels firm.",
          likelyDryRootZone && !heavyRainSoon
            ? "Water deeply only if the root zone is genuinely drying out."
            : "Hold off watering unless the root zone is clearly dry.",
          soilTemp !== undefined && soilTemp >= 10 && !heavyRainSoon && !likelySoftGround
            ? "Feeding is reasonable if the lawn is actively growing."
            : "Leave feeding for a steadier growth window."
        ];

        return {
          doNow: weekendSteps,
          avoid: [
            "Do not pile feed, mowing, and repair onto a lawn that is already stressed.",
            "Do not water and mow by habit if the weather is doing the job for you."
          ],
          watchFor: [
            "If the ground stays soft, keep heavy work off it.",
            "If a clear patch or disease clue appears, switch from planning to diagnosis."
          ],
          recheckAt,
          whatWouldChange: ["A wetter weekend forecast or a softer lawn surface would change the plan."]
        };
      }
      case "treatment-safety": {
        const treatmentLabel = getRecentTreatmentLabel(input.snapshot);

        return {
          doNow: [
            `Treat this as a label-first question for ${treatmentLabel}.`,
            "Keep kids and pets off until the product is dry and the packet says normal use is fine."
          ],
          avoid: [
            "Do not guess the re-entry window if you still have the packet or spray bottle.",
            "Do not assume every product has the same safety interval."
          ],
          watchFor: [
            "Any fresh contact with wet product changes the advice immediately.",
            "If the label gives a stricter interval, follow that rather than the app."
          ],
          recheckAt,
          whatWouldChange: ["The exact product label is the one thing most likely to change the safety answer."]
        };
      }
      case "zone-comparison-insight":
        return {
          doNow: [
            "Treat the wetter and drier zones as separate care conditions.",
            "If one zone stays soft after rain, check drainage, compaction, and shade there first."
          ],
          avoid: [
            "Do not water every zone to the same schedule.",
            "Do not assume a wetter back lawn needs the same feed timing as the drier front."
          ],
          watchFor: [
            "If the same zone stays wetter after every wet spell, site conditions are probably driving it.",
            "If the wetter zone also thins or mosses over, drainage and light become more likely."
          ],
          recheckAt,
          whatWouldChange: ["A new comparison reading after rain or dry weather would sharpen the zone insight."]
        };
    }
  }

  const doNow =
    input.confidence.label === "low" && input.playbook.issueFamily !== "chemical"
      ? ["Hold off strong treatments until one missing clue is confirmed."]
      : [...input.playbook.immediateActions];

  if (!input.snapshot.uploadedImages.length) {
    doNow.push("Add one close-up and one wider photo if you want the diagnosis narrowed faster.");
  }

  const whatWouldChange =
    input.requestedMode === "recovery-plan"
      ? ["A clear new symptom or spread pattern would change the plan."]
      : input.playbook.disambiguatingQuestionIds
          .map((questionId) => getDiagnosticQuestionTemplate(questionId)?.reason)
          .filter((value): value is string => Boolean(value))
          .slice(0, 2);

  return {
    doNow: Array.from(new Set(doNow)).slice(0, 3),
    avoid: input.playbook.avoidDoing.slice(0, 3),
    watchFor: input.playbook.whenToEscalate.slice(0, 3),
    recheckAt,
    whatWouldChange
  };
};

export const scoreDiagnosticCase = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  now: string;
  contextSnapshot: DiagnosticContextSnapshot;
}): DiagnosticScoringResult => {
  const signalResult = extractDiagnosticSignals({
    request: input.request,
    currentState: input.currentState,
    imageObservation: input.contextSnapshot.imageObservation
  });
  const requestRouting = classifyDiagnosticRequest({
    request: input.request,
    currentState: input.currentState,
    contextSnapshot: input.contextSnapshot
  });

  const rawScores = new Map<string, number>();
  const evidenceFor: DiagnosticEvidenceItem[] = [];
  const evidenceAgainst: DiagnosticEvidenceItem[] = [];

  for (const playbook of diagnosticPlaybooks) {
    rawScores.set(playbook.id, playbook.id === "other-stress" ? 0.22 : 0);

    for (const clue of playbook.positiveSignals) {
      if (signalResult.presentSignals.has(clue.signal)) {
        pushScore(rawScores, evidenceFor, {
          hypothesisId: playbook.id,
          weight: clue.weight,
          text: clue.text,
          source: sourceFromContext(playbook, clue.signal),
          signal: clue.signal
        });
      }

      if (signalResult.absentSignals.has(clue.signal)) {
        pullScore(rawScores, evidenceAgainst, {
          hypothesisId: playbook.id,
          weight: clue.weight * 0.55,
          text: signalFallbackText[clue.signal] ?? `No clear evidence for ${clue.signal}.`,
          source: "user",
          signal: clue.signal
        });
      }
    }

    for (const clue of playbook.negativeSignals) {
      if (signalResult.presentSignals.has(clue.signal)) {
        pullScore(rawScores, evidenceAgainst, {
          hypothesisId: playbook.id,
          weight: clue.weight,
          text: clue.text,
          source: sourceFromContext(playbook, clue.signal),
          signal: clue.signal
        });
      }
    }
  }

  addPatternBonuses(rawScores, evidenceFor, evidenceAgainst, signalResult);
  applyRequestRoutingBonuses({
    rawScores,
    evidenceFor,
    snapshot: input.contextSnapshot,
    routing: requestRouting,
    signals: signalResult.presentSignals as Set<string>
  });
  addContextualBonuses(
    rawScores,
    evidenceFor,
    evidenceAgainst,
    input.contextSnapshot,
    signalResult.presentSignals as Set<string>
  );
  if (requestRouting.kind !== "coaching") {
    applyScoreInertia(rawScores, evidenceFor, input.currentState);
  }

  if (
    requestRouting.kind !== "coaching" &&
    !input.contextSnapshot.uploadedImages.length &&
    signalResult.presentSignals.size < 3
  ) {
    pushScore(rawScores, evidenceFor, {
      hypothesisId: "other-stress",
      weight: 0.8,
      text: "The evidence is still fairly light, so Lawn Pal is leaving room for other explanations.",
      source: "system"
    });
  }

  const clampedScores = Array.from(rawScores.entries()).map(([id, value]) => [
    id,
    Math.max(value, 0.03)
  ] as const);
  const total = clampedScores.reduce((sum, [, value]) => sum + value, 0);

  const rankedHypotheses = clampedScores
    .map(([id, value]) => {
      const playbook = diagnosticPlaybooks.find((candidate) => candidate.id === id)!;
      const score = value / total;
      const evidenceForTexts = evidenceFor
        .filter((item) => item.hypothesisId === id)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((item) => item.text);
      const evidenceAgainstTexts = evidenceAgainst
        .filter((item) => item.hypothesisId === id)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2)
        .map((item) => item.text);

      return {
        id,
        label: playbook.label,
        issueFamily: playbook.issueFamily,
        score,
        confidence: confidenceFromScore(score),
        evidenceFor: evidenceForTexts,
        evidenceAgainst: evidenceAgainstTexts,
        missingSignals: playbook.disambiguatingQuestionIds
          .filter((questionId) => !(input.currentState?.questionsAsked ?? []).includes(questionId))
          .map((questionId) => getDiagnosticQuestionTemplate(questionId)?.text ?? questionId)
          .slice(0, 2),
        immediateActions: playbook.immediateActions.slice(0, 3),
        followUpQuestionIds: playbook.disambiguatingQuestionIds.slice(0, 4),
        productCategoriesIfConfirmed: playbook.productCategoriesIfConfirmed
      } satisfies DiagnosticHypothesis;
    })
    .sort((a, b) => b.score - a.score);

  const topHypotheses = rankedHypotheses.slice(0, 3).map((hypothesis) => ({
    id: hypothesis.id,
    label: hypothesis.label,
    issueFamily: hypothesis.issueFamily,
    score: hypothesis.score,
    confidence: hypothesis.confidence,
    evidenceFor: hypothesis.evidenceFor,
    evidenceAgainst: hypothesis.evidenceAgainst,
    missingSignals: hypothesis.missingSignals,
    productCategoriesIfConfirmed: hypothesis.productCategoriesIfConfirmed
  }));

  const topScore = topHypotheses[0]?.score ?? 0;
  const scoreGap = topHypotheses.length > 1 ? topHypotheses[0]!.score - topHypotheses[1]!.score : topScore;
  const rawTopScore = topHypotheses[0] ? rawScores.get(topHypotheses[0].id) ?? 0 : 0;
  const rawRunnerUpScore = topHypotheses[1] ? rawScores.get(topHypotheses[1].id) ?? 0 : 0;
  const rawScoreGap = rawTopScore - rawRunnerUpScore;
  const topPlaybook =
    diagnosticPlaybooks.find((playbook) => playbook.id === topHypotheses[0]?.id) ??
    diagnosticPlaybooks.find((playbook) => playbook.id === "other-stress")!;
  const hasUrgentChemicalSignal =
    signalResult.presentSignals.has("recent_fertiliser") ||
    signalResult.presentSignals.has("recent_weedkiller") ||
    signalResult.presentSignals.has("recent_mosskiller");
  const coachingResolved = isCoachingHypothesisId(topPlaybook.id);
  const resolved = coachingResolved || isResolvedDiagnosis({
    topHypothesisId: topHypotheses[0]?.id,
    signals: signalResult.presentSignals as Set<string>,
    hasUrgentChemicalSignal,
    rawTopScore,
    rawScoreGap
  });
  const canUseGenericStop =
    topPlaybook.id !== "dog-urine" &&
    topPlaybook.id !== "soil-ph-stress" &&
    topPlaybook.id !== "take-all-patch" &&
    topPlaybook.id !== "other-stress";
  const strongEnoughToStop =
    canUseGenericStop &&
    rawTopScore >= 5.4 &&
    rawScoreGap >= 1.6 &&
    topScore >= 0.36;
  const needsPetConfirmation =
    topPlaybook.id === "dog-urine" && !signalResult.presentSignals.has("pet_presence");
  const needsDogUrineConfirmation =
    topPlaybook.id === "dog-urine" &&
    signalResult.presentSignals.has("pet_presence") &&
    !signalResult.presentSignals.has("recent_pet_wee") &&
    !signalResult.presentSignals.has("dog_route");
  const needsSoilConfirmation = topPlaybook.id === "soil-ph-stress";
  const confidenceLabel: Confidence =
    coachingResolved
      ? rawTopScore >= 7 ? "high" : "medium"
      : resolved && topPlaybook.id !== "dog-urine" && rawTopScore >= 8.2
      ? "high"
      : resolved || strongEnoughToStop || rawTopScore >= 3.5 || topScore >= 0.3
        ? "medium"
        : "low";

  const confidence: DiagnosticConfidence = {
    label: confidenceLabel,
    topScore,
    scoreGap,
    rawTopScore,
    rawScoreGap,
    resolved,
    shouldAskFollowUp: coachingResolved
      ? false
      : !resolved &&
          !(topPlaybook.issueFamily === "chemical" && (strongEnoughToStop || hasUrgentChemicalSignal)) &&
          !strongEnoughToStop &&
          (needsPetConfirmation ||
            needsDogUrineConfirmation ||
            needsSoilConfirmation ||
            confidenceLabel === "low" ||
            rawScoreGap < 1.45)
  };

  const issueFamily = topHypotheses[0]?.issueFamily ?? "general";
  const currentActionPlan = buildActionPlan({
    playbook: topPlaybook,
    confidence,
    snapshot: input.contextSnapshot,
    now: input.now,
    requestedMode: input.request.requestedMode
  });

  const escalationFlags = Array.from(
    new Set(
      [
        signalResult.presentSignals.has("recent_fertiliser") ||
        signalResult.presentSignals.has("recent_weedkiller") ||
        signalResult.presentSignals.has("recent_mosskiller")
          ? "stop-extra-treatments"
          : null,
        signalResult.presentSignals.has("turf_lifts_easily") ? "check-roots" : null,
        signalResult.presentSignals.has("white_cottony_growth") ? "disease-watch" : null
      ].filter((value): value is string => Boolean(value))
    )
  );

  const productSuggestionCategories =
    input.request.requestedMode === "products" || (resolved && rawTopScore >= 5.6)
      ? Array.from(
          new Set(
            topHypotheses.flatMap((hypothesis, index) =>
              index === 0 || hypothesis.score >= topScore - 0.08
                ? hypothesis.productCategoriesIfConfirmed
                : []
            )
          )
        )
      : [];

  const unansweredQuestions = topPlaybook.disambiguatingQuestionIds
    .filter((questionId) => !(input.currentState?.questionsAsked ?? []).includes(questionId))
    .map((questionId) => getDiagnosticQuestionTemplate(questionId)?.text)
    .filter((value): value is string => Boolean(value));

  return {
    rankedHypotheses,
    topHypotheses,
    visibleHypotheses: buildVisibleHypotheses(rankedHypotheses),
    evidenceFor,
    evidenceAgainst,
    issueFamily,
    confidence,
    currentActionPlan,
    escalationFlags,
    productSuggestionCategories,
    missingInformation: unansweredQuestions.slice(0, 3),
    contextSnapshot: input.contextSnapshot,
    presentSignals: Array.from(signalResult.presentSignals),
    absentSignals: Array.from(signalResult.absentSignals)
  };
};
