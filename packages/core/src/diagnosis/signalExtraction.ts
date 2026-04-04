import type {
  CareEvent,
  DiagnosticCaseState,
  DiagnosticImageObservation,
  DiagnosticSignalKey,
  DiagnosticTurnRequest,
  NormalizedWeather,
  SensorReading,
  Zone
} from "../types";

export type SignalExtractionResult = {
  presentSignals: Set<DiagnosticSignalKey>;
  absentSignals: Set<DiagnosticSignalKey>;
  notes: string[];
};

const containsAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const containsAnyWord = (text: string, terms: string[]) =>
  terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));

const addIf = (
  condition: boolean,
  signal: DiagnosticSignalKey,
  set: Set<DiagnosticSignalKey>,
  note: string,
  notes: string[]
) => {
  if (!condition) {
    return;
  }

  set.add(signal);
  notes.push(note);
};

const applyTextSignals = (
  text: string,
  presentSignals: Set<DiagnosticSignalKey>,
  notes: string[]
) => {
  const lower = text.toLowerCase();

  addIf(
    containsAny(lower, [
      "single patch",
      "one patch",
      "only patch",
      "one spot",
      "single spot",
      "isolated patch"
    ]),
    "isolated_patch",
    presentSignals,
    "The wording points to a single isolated patch.",
    notes
  );
  addIf(
    containsAny(lower, ["everywhere else is healthy", "rest of the lawn is healthy", "everywhere else looks fine"]),
    "rest_of_lawn_healthy",
    presentSignals,
    "The rest of the lawn appears healthier than the problem patch.",
    notes
  );
  addIf(
    containsAny(lower, ["appeared recently", "appeared suddenly", "came on quickly", "over a few days"]),
    "sudden_appearance",
    presentSignals,
    "The issue appears to have come on quickly.",
    notes
  );
  addIf(
    containsAny(lower, ["spreading", "gradually", "getting bigger", "widening", "getting wider", "keeps getting wider"]),
    "gradual_spread",
    presentSignals,
    "The issue sounds like it is spreading gradually.",
    notes
  );
  addIf(
    containsAnyWord(lower, ["ring", "circular"]),
    "ring_pattern",
    presentSignals,
    "The wording suggests a ring or circular pattern.",
    notes
  );
  addIf(
    containsAny(lower, ["stripe", "stripes"]),
    "stripe_pattern",
    presentSignals,
    "The wording suggests striping rather than one irregular patch.",
    notes
  );
  addIf(
    containsAny(lower, ["random patch", "irregular patch", "odd patch"]),
    "random_irregular_patch",
    presentSignals,
    "The patch sounds irregular rather than geometric.",
    notes
  );
  addIf(
    containsAnyWord(lower, ["dog", "pet", "wee", "urine"]),
    "pet_presence",
    presentSignals,
    "Pets are mentioned directly in the conversation.",
    notes
  );
  addIf(
    containsAny(lower, [
      "dog route",
      "toilet route",
      "where the dog goes",
      "uses this spot",
      "uses this area",
      "usual wee spot",
      "usual toilet spot",
      "where the dog wees",
      "dog wees here",
      "dog goes here",
      "pees here"
    ]),
    "dog_route",
    presentSignals,
    "The patch sounds like part of a pet route.",
    notes
  );
  addIf(
    containsAny(lower, [
      "weed there",
      "wee there",
      "peed there",
      "peeed there",
      "just weed",
      "just peed",
      "just wee",
      "just urinated",
      "dog wee",
      "dog wees",
      "dog peed",
      "dog pees"
    ]),
    "recent_pet_wee",
    presentSignals,
    "The wording suggests a recent pet wee in that area.",
    notes
  );
  addIf(
    containsAny(lower, ["feed", "fertiliser", "fertilizer"]),
    "recent_fertiliser",
    presentSignals,
    "Feed or fertiliser is mentioned as recent context.",
    notes
  );
  addIf(
    containsAny(lower, ["weedkiller", "weed killer"]),
    "recent_weedkiller",
    presentSignals,
    "Weedkiller is mentioned as recent context.",
    notes
  );
  addIf(
    containsAny(lower, ["moss killer", "mosskiller", "moss treatment"]),
    "recent_mosskiller",
    presentSignals,
    "Moss treatment is mentioned as recent context.",
    notes
  );
  addIf(
    containsAny(lower, ["under a tree", "tree", "hedge", "fence shade"]),
    "tree_shade",
    presentSignals,
    "Tree or hedge shade is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["shade", "shady", "low sun"]),
    "low_light",
    presentSignals,
    "Low light or shade is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["wet", "soft", "waterlogged", "squelchy", "soggy"]),
    "wet_area",
    presentSignals,
    "The patch is described as wet or soft.",
    notes
  );
  addIf(
    containsAny(lower, ["soggy", "squelchy"]),
    "soggy_soil",
    presentSignals,
    "The soil is described as soggy.",
    notes
  );
  addIf(
    containsAny(lower, ["dry", "parched", "crispy"]),
    "dry_area",
    presentSignals,
    "Dryness is mentioned directly.",
    notes
  );
  addIf(
    containsAny(lower, [
      "bone dry",
      "soil is dry",
      "stays dry",
      "even after watering",
      "won't soak up water",
      "water beads off",
      "does not absorb water"
    ]),
    "dry_soil",
    presentSignals,
    "The soil is described as staying dry.",
    notes
  );
  addIf(
    containsAny(lower, ["compacted", "hard ground"]),
    "compacted_area",
    presentSignals,
    "Compaction is mentioned directly.",
    notes
  );
  addIf(
    containsAny(lower, ["traffic", "gate", "kids play", "high use"]),
    "high_traffic",
    presentSignals,
    "Traffic pressure is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["historically underperformed", "historically struggled", "year after year", "long-term weak", "keeps failing"]),
    "historically_weak_area",
    presentSignals,
    "The area sounds like a long-term underperformer rather than a one-off incident.",
    notes
  );
  addIf(
    containsAny(lower, ["acidic", "acidic reading", "low ph", "low pH", "ph looks acidic", "ph reading looks acidic"]),
    "acidic_reading",
    presentSignals,
    "The wording suggests acidic soil context.",
    notes
  );
  addIf(
    containsAny(lower, ["birds peck", "birds are pecking", "foxes", "badgers"]),
    "birds_pecking",
    presentSignals,
    "Bird or animal activity is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["lifts easily", "peels back", "comes up easily"]),
    "turf_lifts_easily",
    presentSignals,
    "The turf may be losing anchorage.",
    notes
  );
  addIf(
    containsAny(lower, ["mushroom", "mushrooms"]),
    "mushrooms_present",
    presentSignals,
    "Mushrooms are mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["red thread", "red threads"]),
    "red_threads_visible",
    presentSignals,
    "Red thread-like growth is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["orange dust", "orange powder", "rust on shoes"]),
    "orange_dust_visible",
    presentSignals,
    "Orange dusty spores are mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["white growth", "cottony", "white mould", "snow mould"]),
    "white_cottony_growth",
    presentSignals,
    "White cottony growth is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["moss"]),
    "moss_visible",
    presentSignals,
    "Moss is mentioned.",
    notes
  );
  addIf(
    containsAnyWord(lower, ["thin", "sparse"]),
    "thin_shaded_grass",
    presentSignals,
    "The grass is described as thin or sparse.",
    notes
  );
  addIf(
    containsAny(lower, ["burnt", "burned", "scorched"]),
    "scorched_centre",
    presentSignals,
    "The patch is described as scorched.",
    notes
  );
  addIf(
    containsAny(lower, ["object", "pool", "chair", "table", "toy"]),
    "under_object",
    presentSignals,
    "Something may have been resting on the lawn.",
    notes
  );
  addIf(
    containsAny(lower, ["after mowing", "after i mowed", "after cutting"]),
    "after_mowing",
    presentSignals,
    "The timing is linked to mowing.",
    notes
  );
  addIf(
    containsAny(lower, [
      "scalped",
      "cut too low",
      "clipped a bump",
      "on a bump",
      "on a slope",
      "mower scalp"
    ]),
    "scalped_look",
    presentSignals,
    "The wording suggests scalping.",
    notes
  );
  addIf(
    containsAny(lower, ["new lawn", "newly seeded", "new turf", "new grass"]),
    "new_lawn",
    presentSignals,
    "This may be newly established turf.",
    notes
  );
  addIf(
    containsAny(lower, ["washout", "washed out"]),
    "washout_pattern",
    presentSignals,
    "Washout is mentioned directly.",
    notes
  );
  addIf(
    containsAny(lower, ["bare soil", "bare patch"]),
    "bare_soil",
    presentSignals,
    "Bare soil is mentioned.",
    notes
  );
  addIf(
    containsAny(lower, ["weeds", "weed"]),
    "weeds_present",
    presentSignals,
    "Weeds are mentioned.",
    notes
  );
};

const applyQuickReplySignals = (
  quickReplyValue: string | undefined,
  presentSignals: Set<DiagnosticSignalKey>,
  absentSignals: Set<DiagnosticSignalKey>
) => {
  if (!quickReplyValue) {
    return;
  }

  const addAbsent = (signal: DiagnosticSignalKey) => absentSignals.add(signal);

  switch (quickReplyValue) {
    case "pet_presence":
    case "recent_pet_wee":
    case "dog_route":
    case "sudden_appearance":
    case "recent_fertiliser":
    case "recent_weedkiller":
    case "recent_mosskiller":
    case "stripe_pattern":
    case "uniform_object_shape":
    case "random_irregular_patch":
    case "tree_shade":
    case "wet_area":
    case "soggy_soil":
    case "dry_area":
    case "dry_soil":
    case "birds_pecking":
    case "turf_lifts_easily":
    case "red_threads_visible":
    case "orange_dust_visible":
    case "white_cottony_growth":
    case "mushrooms_present":
    case "under_object":
    case "after_mowing":
    case "scalped_look":
    case "new_lawn":
    case "washout_pattern":
      presentSignals.add(quickReplyValue);
      return;
    case "no_pet_presence":
      addAbsent("pet_presence");
      addAbsent("recent_pet_wee");
      return;
    case "no_recent_pet_wee":
      addAbsent("recent_pet_wee");
      return;
    case "not_dog_route":
      addAbsent("dog_route");
      return;
    case "gradual_spread":
      presentSignals.add("gradual_spread");
      return;
    case "no_recent_products":
      addAbsent("recent_fertiliser");
      addAbsent("recent_weedkiller");
      addAbsent("recent_mosskiller");
      return;
    case "no_tree_shade":
      addAbsent("tree_shade");
      addAbsent("low_light");
      return;
    case "not_wet_area":
      addAbsent("wet_area");
      addAbsent("soggy_soil");
      return;
    case "not_dry_area":
      addAbsent("dry_area");
      addAbsent("dry_soil");
      return;
    case "not_birds_pecking":
      addAbsent("birds_pecking");
      return;
    case "not_turf_lifts_easily":
      addAbsent("turf_lifts_easily");
      return;
    case "no_fungal_signs":
      addAbsent("red_threads_visible");
      addAbsent("orange_dust_visible");
      addAbsent("white_cottony_growth");
      addAbsent("mushrooms_present");
      return;
    case "not_under_object":
      addAbsent("under_object");
      addAbsent("uniform_object_shape");
      return;
    case "not_after_mowing":
      addAbsent("after_mowing");
      addAbsent("scalped_look");
      return;
    case "not_new_lawn":
      addAbsent("new_lawn");
      addAbsent("washout_pattern");
      return;
    default:
      return;
  }
};

const applyQuestionAnswerSignals = (
  replyToQuestionId: string | undefined,
  userMessage: string,
  presentSignals: Set<DiagnosticSignalKey>,
  absentSignals: Set<DiagnosticSignalKey>
) => {
  if (!replyToQuestionId) {
    return;
  }

  const lower = userMessage.toLowerCase();
  const yes = /(?:^|\b)(yes|yeah|yep|correct|exactly|it did|they did|she did|he did)\b/i.test(lower);
  const no = /(?:^|\b)(no|nope|not really|don't think so|didn't|did not)\b/i.test(lower);

  const confirm = (signal: DiagnosticSignalKey) => presentSignals.add(signal);
  const reject = (signal: DiagnosticSignalKey) => absentSignals.add(signal);

  if (replyToQuestionId === "q-pets") {
    if (yes) confirm("pet_presence");
    if (no) reject("pet_presence");
  }

  if (replyToQuestionId === "q-recent-wee") {
    if (yes) confirm("recent_pet_wee");
    if (no) reject("recent_pet_wee");
  }

  if (replyToQuestionId === "q-dog-route") {
    if (yes) confirm("dog_route");
    if (no) reject("dog_route");
  }

  if (replyToQuestionId === "q-sudden") {
    if (yes) confirm("sudden_appearance");
    if (no) confirm("gradual_spread");
  }

  if (replyToQuestionId === "q-tree") {
    if (yes) confirm("tree_shade");
    if (no) {
      reject("tree_shade");
      reject("low_light");
    }
  }

  if (replyToQuestionId === "q-wet") {
    if (yes) confirm("wet_area");
    if (no) {
      reject("wet_area");
      reject("soggy_soil");
    }
  }

  if (replyToQuestionId === "q-dry") {
    if (yes) confirm("dry_area");
    if (no) {
      reject("dry_area");
      reject("dry_soil");
    }
  }
};

const applyZoneSignals = (
  zoneContext: Zone | undefined,
  notes: string[]
) => {
  if (!zoneContext) {
    return;
  }

  if (zoneContext.exposure === "shade") {
    notes.push("The zone itself is marked as shaded.");
  }

  if (zoneContext.exposure === "part-shade") {
    notes.push("The zone is partly shaded.");
  }
};

const applySensorSignals = (
  sensorContext: SensorReading | undefined,
  notes: string[]
) => {
  if (!sensorContext) {
    return;
  }

  if (sensorContext.metrics.moisture >= 76) {
    notes.push("Sensor moisture is high.");
  }

  if (sensorContext.metrics.moisture <= 30) {
    notes.push("Sensor moisture is low.");
  }

  if (sensorContext.metrics.lightLux <= 6500) {
    notes.push("Light readings are on the low side.");
  }
};

const applyWeatherSignals = (
  weatherContext: NormalizedWeather | undefined,
  presentSignals: Set<DiagnosticSignalKey>,
  notes: string[]
) => {
  if (!weatherContext) {
    return;
  }

  const heavyRainSoon = weatherContext.daily
    .slice(0, 3)
    .some((day) => day.rainProbability >= 60 || day.precipitationMm >= 4);
  const drySpell =
    weatherContext.daily.slice(0, 3).every((day) => day.rainProbability <= 25) &&
    weatherContext.current.precipitationMm === 0;

  if (heavyRainSoon || weatherContext.current.humidity >= 86) {
    notes.push("Recent weather has been damp or humid.");
  }

  if (drySpell) {
    notes.push("Recent weather has been fairly dry.");
  }

  if (weatherContext.current.isFrostRisk) {
    notes.push("There is current frost risk in the weather context.");
  }
};

const applyCareEventSignals = (
  careEvents: CareEvent[],
  presentSignals: Set<DiagnosticSignalKey>,
  notes: string[]
) => {
  for (const event of careEvents) {
    switch (event.type) {
      case "fertiliser":
        presentSignals.add("recent_fertiliser");
        notes.push("A recent fertiliser event is logged.");
        break;
      case "weedkiller":
        presentSignals.add("recent_weedkiller");
        notes.push("A recent weedkiller event is logged.");
        break;
      case "mosskiller":
        presentSignals.add("recent_mosskiller");
        notes.push("A recent moss treatment event is logged.");
        break;
      case "pet-urine":
        presentSignals.add("pet_presence");
        presentSignals.add("dog_route");
        notes.push("A pet urine event is logged.");
        break;
      case "heavy-traffic":
        presentSignals.add("high_traffic");
        notes.push("Heavy traffic is logged for this area.");
        break;
      case "object-left":
        presentSignals.add("under_object");
        presentSignals.add("uniform_object_shape");
        notes.push("An object was recently left on the lawn.");
        break;
      default:
        break;
    }
  }
};

const applyImageObservationSignals = (
  imageObservation: DiagnosticImageObservation | undefined,
  presentSignals: Set<DiagnosticSignalKey>,
  notes: string[]
) => {
  if (!imageObservation) {
    return;
  }

  for (const signal of imageObservation.observedSignals) {
    presentSignals.add(signal);
  }

  if (imageObservation.summary) {
    notes.push(imageObservation.summary);
  }
};

export const extractDiagnosticSignals = (input: {
  request: DiagnosticTurnRequest;
  currentState?: DiagnosticCaseState;
  imageObservation?: DiagnosticImageObservation;
}): SignalExtractionResult => {
  const presentSignals = new Set<DiagnosticSignalKey>(input.currentState?.confirmedSignals ?? []);
  const absentSignals = new Set<DiagnosticSignalKey>(input.currentState?.ruledOutSignals ?? []);
  const notes: string[] = [];

  const currentTurnText = [input.request.userMessage, input.request.quickReplyValue]
    .filter(Boolean)
    .join(" ");

  applyTextSignals(currentTurnText, presentSignals, notes);
  applyQuickReplySignals(input.request.quickReplyValue, presentSignals, absentSignals);
  applyQuestionAnswerSignals(
    input.request.replyToQuestionId,
    input.request.userMessage,
    presentSignals,
    absentSignals
  );
  applyZoneSignals(input.request.zoneContext ?? input.currentState?.zoneContext, notes);
  applySensorSignals(
    input.request.sensorContext ?? input.currentState?.sensorContext,
    notes
  );
  applyWeatherSignals(
    input.request.weatherContext ?? input.currentState?.weatherContext,
    presentSignals,
    notes
  );
  applyCareEventSignals(
    input.request.careEvents ?? input.currentState?.careEvents ?? [],
    presentSignals,
    notes
  );
  applyImageObservationSignals(input.imageObservation, presentSignals, notes);

  return {
    presentSignals,
    absentSignals,
    notes
  };
};
