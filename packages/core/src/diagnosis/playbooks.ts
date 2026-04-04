import type {
  DiagnosticIssueFamily,
  DiagnosticQuestion,
  DiagnosticSignalKey,
  ProductCategory,
  UiSuggestionChip,
  Urgency
} from "../types";

export type WeightedSignal = {
  signal: DiagnosticSignalKey;
  weight: number;
  text: string;
};

export type DiagnosticQuestionTemplate = DiagnosticQuestion & {
  infoGainWeight: number;
};

export type DiagnosticPlaybook = {
  id: string;
  label: string;
  issueFamily: DiagnosticIssueFamily;
  hallmarkSymptoms: string[];
  commonLookalikes: string[];
  environmentalClues: string[];
  immediateActions: string[];
  avoidDoing: string[];
  recoveryExpectations: string[];
  whenToEscalate: string[];
  productCategoriesIfConfirmed: ProductCategory[];
  positiveSignals: WeightedSignal[];
  negativeSignals: WeightedSignal[];
  disambiguatingQuestionIds: string[];
  urgency: Urgency;
};

const chip = (id: string, label: string, value: string, questionId?: string): UiSuggestionChip => ({
  id,
  label,
  value,
  questionId
});

export const diagnosticQuestionTemplates: DiagnosticQuestionTemplate[] = [
  {
    id: "q-pets",
    text: "Do you have a dog or other pet using this area?",
    reason: "That sharply separates local scorch from most disease and water issues.",
    effort: "low",
    targetHypothesisIds: ["dog-urine", "fertiliser-scorch", "object-heat-scorch"],
    quickReplies: [
      chip("pets-yes", "Yes, I have dogs", "pet_presence", "q-pets"),
      chip("pets-no", "No pets", "no_pet_presence", "q-pets")
    ],
    infoGainWeight: 1.6
  },
  {
    id: "q-recent-wee",
    text: "Is this where the dog wee'd recently, or a spot they often use?",
    reason: "That is the fastest way to confirm dog urine rather than keep chasing unrelated causes.",
    effort: "low",
    targetHypothesisIds: ["dog-urine"],
    quickReplies: [
      chip("wee-yes", "Yes, likely dog wee", "recent_pet_wee", "q-recent-wee"),
      chip("wee-no", "No, not that I know of", "no_recent_pet_wee", "q-recent-wee")
    ],
    infoGainWeight: 1.95
  },
  {
    id: "q-dog-route",
    text: "Is this on a usual toilet route or near where a dog often stops?",
    reason: "Repeated dog traffic makes urine scorch much more likely than a random disease patch.",
    effort: "low",
    targetHypothesisIds: ["dog-urine"],
    quickReplies: [
      chip("dog-route-yes", "Yes, common route", "dog_route", "q-dog-route"),
      chip("dog-route-no", "No, not really", "not_dog_route", "q-dog-route")
    ],
    infoGainWeight: 1.3
  },
  {
    id: "q-sudden",
    text: "Did this appear quite suddenly over a few days, rather than gradually spreading?",
    reason: "Sudden change points more toward scorch or incident damage than a slow structural problem.",
    effort: "low",
    targetHypothesisIds: [
      "dog-urine",
      "fertiliser-scorch",
      "weedkiller-damage",
      "object-heat-scorch"
    ],
    quickReplies: [
      chip("sudden-yes", "Appeared suddenly", "sudden_appearance", "q-sudden"),
      chip("sudden-no", "Gradually spread", "gradual_spread", "q-sudden")
    ],
    infoGainWeight: 1.5
  },
  {
    id: "q-products",
    text: "Was anything applied in the last 1 to 2 weeks: feed, weedkiller, or moss treatment?",
    reason: "Recent products strongly separate chemical damage from disease, shade, or pests.",
    effort: "low",
    targetHypothesisIds: ["fertiliser-scorch", "weedkiller-damage", "mosskiller-damage"],
    quickReplies: [
      chip("prod-feed", "Yes, feed", "recent_fertiliser", "q-products"),
      chip("prod-weedkiller", "Yes, weedkiller", "recent_weedkiller", "q-products"),
      chip("prod-mosskiller", "Yes, moss treatment", "recent_mosskiller", "q-products"),
      chip("prod-none", "No products", "no_recent_products", "q-products")
    ],
    infoGainWeight: 1.8
  },
  {
    id: "q-shape",
    text: "Are the marks in stripes or regular shapes rather than one odd patch?",
    reason: "Regular geometry often points to spreader, spray, mowing, or object damage.",
    effort: "low",
    targetHypothesisIds: [
      "fertiliser-scorch",
      "weedkiller-damage",
      "scalping",
      "object-heat-scorch"
    ],
    quickReplies: [
      chip("shape-stripes", "Yes, stripes", "stripe_pattern", "q-shape"),
      chip("shape-regular", "Yes, regular shape", "uniform_object_shape", "q-shape"),
      chip("shape-random", "No, random patch", "random_irregular_patch", "q-shape")
    ],
    infoGainWeight: 1.2
  },
  {
    id: "q-tree",
    text: "Is the patch under a tree, beside a hedge, or in a notably shady spot?",
    reason: "Shade and root competition change the likely causes and recovery plan.",
    effort: "low",
    targetHypothesisIds: ["shade-weakness", "moss-dominance", "dry-patch", "compaction", "soil-ph-stress"],
    quickReplies: [
      chip("tree-yes", "Yes, under tree or hedge", "tree_shade", "q-tree"),
      chip("tree-no", "No, fairly open", "no_tree_shade", "q-tree")
    ],
    infoGainWeight: 1.4
  },
  {
    id: "q-wet",
    text: "Does this area stay wetter or softer than the rest after rain?",
    reason: "That separates drainage and compaction problems from scorch, drought, and many diseases.",
    effort: "low",
    targetHypothesisIds: ["waterlogging", "compaction", "moss-dominance", "fusarium"],
    quickReplies: [
      chip("wet-yes", "Yes, stays wet", "wet_area", "q-wet"),
      chip("wet-soggy", "Yes, feels soggy", "soggy_soil", "q-wet"),
      chip("wet-no", "No, dries normally", "not_wet_area", "q-wet")
    ],
    infoGainWeight: 1.6
  },
  {
    id: "q-dry",
    text: "Has it been hot and dry there, and does the patch stay dry even after watering?",
    reason: "That distinguishes drought and dry patch from most incident damage.",
    effort: "medium",
    targetHypothesisIds: ["drought-stress", "dry-patch"],
    quickReplies: [
      chip("dry-hot", "Hot and dry", "dry_area", "q-dry"),
      chip("dry-soil", "Soil stays dry", "dry_soil", "q-dry"),
      chip("dry-no", "No, not especially", "not_dry_area", "q-dry")
    ],
    infoGainWeight: 1.6
  },
  {
    id: "q-birds",
    text: "Have birds or animals been pecking or pulling at the lawn here?",
    reason: "Secondary bird activity often points toward root-feeding pests.",
    effort: "low",
    targetHypothesisIds: ["chafer-grubs", "leatherjackets"],
    quickReplies: [
      chip("birds-yes", "Yes, birds pecking", "birds_pecking", "q-birds"),
      chip("birds-no", "No, nothing like that", "not_birds_pecking", "q-birds")
    ],
    infoGainWeight: 1.7
  },
  {
    id: "q-lift",
    text: "If you gently pull the turf, does it lift easily from the soil?",
    reason: "That is a strong differentiator for root loss and grub damage.",
    effort: "medium",
    targetHypothesisIds: ["chafer-grubs", "leatherjackets", "new-lawn-failure"],
    quickReplies: [
      chip("lift-yes", "Yes, lifts easily", "turf_lifts_easily", "q-lift"),
      chip("lift-no", "No, roots hold well", "not_turf_lifts_easily", "q-lift")
    ],
    infoGainWeight: 1.8
  },
  {
    id: "q-fungi",
    text: "Can you see mushrooms, orange dust, red threads, or any white cottony growth?",
    reason: "Those visual clues sharply narrow which disease family is plausible.",
    effort: "medium",
    targetHypothesisIds: ["red-thread", "rust", "fusarium", "fairy-ring"],
    quickReplies: [
      chip("fungi-red", "Red threads", "red_threads_visible", "q-fungi"),
      chip("fungi-orange", "Orange dust", "orange_dust_visible", "q-fungi"),
      chip("fungi-white", "White cottony growth", "white_cottony_growth", "q-fungi"),
      chip("fungi-mushrooms", "Mushrooms or ring", "mushrooms_present", "q-fungi"),
      chip("fungi-none", "None of those", "no_fungal_signs", "q-fungi")
    ],
    infoGainWeight: 1.9
  },
  {
    id: "q-object",
    text: "Was anything sitting on that patch recently, like furniture, a toy, or a paddling pool?",
    reason: "Object scorch and smothering often look alarming but recover differently from disease.",
    effort: "low",
    targetHypothesisIds: ["object-heat-scorch"],
    quickReplies: [
      chip("object-yes", "Yes, something sat there", "under_object", "q-object"),
      chip("object-no", "No, nothing like that", "not_under_object", "q-object")
    ],
    infoGainWeight: 1.4
  },
  {
    id: "q-mowing",
    text: "Did this appear straight after mowing, or on a bump where the mower might have cut too low?",
    reason: "That separates scalping and mechanical damage from most other causes.",
    effort: "low",
    targetHypothesisIds: ["scalping"],
    quickReplies: [
      chip("mowing-after", "Yes, after mowing", "after_mowing", "q-mowing"),
      chip("mowing-scalped", "Looks cut too low", "scalped_look", "q-mowing"),
      chip("mowing-no", "No clear mowing link", "not_after_mowing", "q-mowing")
    ],
    infoGainWeight: 1.5
  },
  {
    id: "q-new-lawn",
    text: "Is this newly seeded or newly laid turf rather than an established lawn?",
    reason: "Establishment problems behave very differently from stress in mature turf.",
    effort: "low",
    targetHypothesisIds: ["new-lawn-failure"],
    quickReplies: [
      chip("new-lawn-yes", "Yes, newly established", "new_lawn", "q-new-lawn"),
      chip("new-lawn-washout", "Yes, seed washed out", "washout_pattern", "q-new-lawn"),
      chip("new-lawn-no", "No, established lawn", "not_new_lawn", "q-new-lawn")
    ],
    infoGainWeight: 1.3
  },
  {
    id: "q-closeup",
    text: "Can you add one close-up photo of the grass blades and one wider shot of the area?",
    reason: "A close-up and a wider frame often separate fungus, scorch, shade thinning, and pest damage.",
    effort: "high",
    targetHypothesisIds: ["red-thread", "rust", "fusarium", "fairy-ring", "dog-urine", "dry-patch"],
    quickReplies: [
      chip("closeup-add", "I will add photos", "request_more_photos", "q-closeup")
    ],
    infoGainWeight: 1.1
  }
];

const q = (questionId: string) => questionId;

export const diagnosticPlaybooks: DiagnosticPlaybook[] = [
  {
    id: "dog-urine",
    label: "Dog urine / local scorch",
    issueFamily: "patch",
    hallmarkSymptoms: ["single isolated yellow patch", "straw-coloured centre", "sometimes darker green edge"],
    commonLookalikes: ["fertiliser scorch", "object scorch", "dry patch"],
    environmentalClues: ["rest of lawn otherwise healthy", "common pet route"],
    immediateActions: ["Rinse the patch thoroughly", "Hold off feed or weedkiller", "Lightly rake dead material after a few days"],
    avoidDoing: ["Do not add fertiliser yet", "Do not over-treat a single patch"],
    recoveryExpectations: ["Minor scorch may green back up within 1 to 3 weeks", "Severe spots may need patch repair"],
    whenToEscalate: ["multiple new patches appearing daily", "patches spreading without pet activity"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "isolated_patch", weight: 2.1, text: "It looks like one localised patch." },
      { signal: "rest_of_lawn_healthy", weight: 1.7, text: "The rest of the lawn looks healthy." },
      { signal: "pet_presence", weight: 2.8, text: "Pets using the area strongly support local scorch." },
      { signal: "recent_pet_wee", weight: 3.6, text: "A recent dog wee in the spot is near-confirmatory evidence." },
      { signal: "dog_route", weight: 2.1, text: "It sits on a likely toilet route." },
      { signal: "dark_green_border", weight: 1.8, text: "A darker green border often appears around urine scorch." },
      { signal: "sudden_appearance", weight: 1.2, text: "It appeared suddenly rather than gradually." },
      { signal: "scorched_centre", weight: 1.4, text: "The centre looks scorched rather than thinned." }
    ],
    negativeSignals: [
      { signal: "multiple_patches", weight: 1.3, text: "Multiple patches make a single local scorch less likely." },
      { signal: "ring_pattern", weight: 1.2, text: "Ring pattern points away from dog urine." },
      { signal: "recent_fertiliser", weight: 1.7, text: "Recent fertiliser makes scorch from feed plausible too." },
      { signal: "gradual_spread", weight: 1, text: "Gradual spread points away from a one-off urine burn." }
    ],
    disambiguatingQuestionIds: [q("q-pets"), q("q-recent-wee"), q("q-dog-route"), q("q-products")],
    urgency: "medium"
  },
  {
    id: "fertiliser-scorch",
    label: "Fertiliser scorch",
    issueFamily: "chemical",
    hallmarkSymptoms: ["yellow or burnt patch after feeding", "striping or spreader pattern", "rapid change after application"],
    commonLookalikes: ["dog urine", "weedkiller damage", "object scorch"],
    environmentalClues: ["recent feed application", "warm or dry weather after feeding"],
    immediateActions: ["Water the area deeply once", "Stop further feeding", "Track whether the pattern matches spreader passes"],
    avoidDoing: ["Do not reapply feed", "Do not overseed immediately into chemical stress"],
    recoveryExpectations: ["Light scorch may recover over 2 to 4 weeks", "Heavy scorch may need reseeding"],
    whenToEscalate: ["whole sections continuing to bleach", "clear chemical spill or over-application"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "recent_fertiliser", weight: 3.1, text: "Recent feed is the strongest clue here." },
      { signal: "stripe_pattern", weight: 2, text: "Striping is typical of spreader overlap." },
      { signal: "uniform_object_shape", weight: 0.7, text: "A regular boundary suggests application pattern rather than disease." },
      { signal: "sudden_appearance", weight: 1.1, text: "Rapid onset fits scorch." },
      { signal: "scorched_centre", weight: 1.3, text: "The patch reads more like scorch than thinning." }
    ],
    negativeSignals: [
      { signal: "pet_presence", weight: 1.3, text: "Pet activity keeps dog urine in play." },
      { signal: "mushrooms_present", weight: 1.5, text: "Mushrooms point away from fertiliser scorch." }
    ],
    disambiguatingQuestionIds: [q("q-products"), q("q-shape"), q("q-sudden"), q("q-pets")],
    urgency: "high"
  },
  {
    id: "weedkiller-damage",
    label: "Weedkiller damage",
    issueFamily: "chemical",
    hallmarkSymptoms: ["yellowing or bleaching after spraying", "irregular but treatment-linked patch", "damage near overspray edge"],
    commonLookalikes: ["fertiliser scorch", "drought stress"],
    environmentalClues: ["recent weedkiller", "windy conditions during application"],
    immediateActions: ["Stop further spraying", "Water once if label permits", "Watch for distinct overspray pattern"],
    avoidDoing: ["Do not stack more treatments", "Do not fertilise immediately"],
    recoveryExpectations: ["Mild overspray may grow out", "Severe damage may need repair"],
    whenToEscalate: ["damage widening after repeat spray", "large sections affected"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "recent_weedkiller", weight: 3.3, text: "Recent weedkiller is the dominant clue." },
      { signal: "sudden_appearance", weight: 1.1, text: "Rapid change fits spray damage." },
      { signal: "stripe_pattern", weight: 1.1, text: "Regular application marks support product damage." },
      { signal: "random_irregular_patch", weight: 0.8, text: "Patchy overspray often looks irregular." }
    ],
    negativeSignals: [
      { signal: "pet_presence", weight: 1.1, text: "Pets keep local scorch plausible." },
      { signal: "ring_pattern", weight: 1, text: "Ring pattern points away from weedkiller damage." }
    ],
    disambiguatingQuestionIds: [q("q-products"), q("q-shape"), q("q-sudden")],
    urgency: "high"
  },
  {
    id: "mosskiller-damage",
    label: "Moss treatment damage",
    issueFamily: "chemical",
    hallmarkSymptoms: ["darkening then thinning after moss control", "stressed patch in damp shady lawn"],
    commonLookalikes: ["weedkiller damage", "moss dominance", "shade weakness"],
    environmentalClues: ["recent moss treatment", "underlying moss problem"],
    immediateActions: ["Pause further treatment", "Rake out dead material only once it dries", "Focus on the underlying damp and shade conditions"],
    avoidDoing: ["Do not retreat immediately", "Do not feed aggressively right away"],
    recoveryExpectations: ["The treated area often looks worse before improving", "Recovery depends on fixing shade and dampness"],
    whenToEscalate: ["blackened area continues to expand", "surface stays slimy or waterlogged"],
    productCategoriesIfConfirmed: ["moss-control", "seed"],
    positiveSignals: [
      { signal: "recent_mosskiller", weight: 3.2, text: "Recent moss treatment is the clearest explanation." },
      { signal: "moss_visible", weight: 1.5, text: "Visible moss makes treatment effects believable." },
      { signal: "low_light", weight: 1, text: "Shade fits the usual moss story." },
      { signal: "wet_area", weight: 1, text: "Damp conditions support moss pressure." }
    ],
    negativeSignals: [{ signal: "pet_presence", weight: 1, text: "Pets keep scorch plausible." }],
    disambiguatingQuestionIds: [q("q-products"), q("q-tree"), q("q-wet")],
    urgency: "medium"
  },
  {
    id: "object-heat-scorch",
    label: "Object or heat scorch",
    issueFamily: "patch",
    hallmarkSymptoms: ["one distinct patch", "regular shape", "damage where something sat"],
    commonLookalikes: ["dog urine", "fertiliser scorch"],
    environmentalClues: ["recent garden furniture or toys", "hot sunny weather"],
    immediateActions: ["Lift pressure from the area", "Water lightly and allow recovery", "Rake dead material once dry"],
    avoidDoing: ["Do not apply chemical treatments", "Do not assume fungus from one regular patch"],
    recoveryExpectations: ["Light scorching often recovers in 1 to 3 weeks", "Severe smothering may need reseeding"],
    whenToEscalate: ["pattern no longer matches object footprint", "multiple new patches appear"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "isolated_patch", weight: 1.4, text: "It is one distinct patch." },
      { signal: "under_object", weight: 3, text: "A recent object on the lawn strongly supports this." },
      { signal: "uniform_object_shape", weight: 2.1, text: "Regular shape fits object damage." },
      { signal: "sudden_appearance", weight: 1, text: "Fast onset fits heat or smothering." }
    ],
    negativeSignals: [
      { signal: "pet_presence", weight: 1.2, text: "Pets keep dog urine in play." },
      { signal: "gradual_spread", weight: 1.4, text: "Gradual spread points away from object scorch." }
    ],
    disambiguatingQuestionIds: [q("q-object"), q("q-sudden"), q("q-pets")],
    urgency: "medium"
  },
  {
    id: "drought-stress",
    label: "Drought stress",
    issueFamily: "water",
    hallmarkSymptoms: ["widespread strawing", "dry hard soil", "recovery after rain"],
    commonLookalikes: ["dry patch", "scalping", "take-all patch"],
    environmentalClues: ["hot dry weather", "sunny exposed lawn"],
    immediateActions: ["Water deeply rather than little and often", "Reduce mowing stress", "Re-check after good rain"],
    avoidDoing: ["Do not overfeed a stressed dry lawn"],
    recoveryExpectations: ["Established lawns often recover after rain", "Some dormant areas green back up slowly"],
    whenToEscalate: ["one area never rehydrates", "hydrophobic surface persists"],
    productCategoriesIfConfirmed: ["wetting-agent"],
    positiveSignals: [
      { signal: "dry_area", weight: 2.3, text: "Hot, dry conditions make drought stress plausible." },
      { signal: "dry_soil", weight: 2.1, text: "Bone-dry soil is a strong sign." },
      { signal: "rest_of_lawn_healthy", weight: 0.6, text: "The rest of the lawn being healthier fits a stress pocket." }
    ],
    negativeSignals: [
      { signal: "wet_area", weight: 1.8, text: "A wet patch points away from drought." },
      { signal: "mushrooms_present", weight: 1.2, text: "Mushrooms point away from simple drought." }
    ],
    disambiguatingQuestionIds: [q("q-dry"), q("q-tree"), q("q-products")],
    urgency: "medium"
  },
  {
    id: "dry-patch",
    label: "Dry patch / hydrophobic soil",
    issueFamily: "water",
    hallmarkSymptoms: ["one area stays dry despite watering", "patch under tree or near wall", "water beads off surface"],
    commonLookalikes: ["drought stress", "dog urine", "take-all patch"],
    environmentalClues: ["under tree roots", "free-draining or thatchy area"],
    immediateActions: ["Wet the patch slowly and repeatedly", "Lightly spike the area", "Consider a wetting agent once confirmed"],
    avoidDoing: ["Do not rely on a quick surface sprinkle", "Do not feed a parched patch first"],
    recoveryExpectations: ["Dry patch improves gradually once water starts penetrating"],
    whenToEscalate: ["patch remains bone dry below surface", "patch expands despite deep watering"],
    productCategoriesIfConfirmed: ["wetting-agent", "top-dressing"],
    positiveSignals: [
      { signal: "isolated_patch", weight: 1.2, text: "A single patch fits dry patch." },
      { signal: "dry_area", weight: 1.8, text: "Dry conditions support the diagnosis." },
      { signal: "dry_soil", weight: 2.5, text: "Surface and subsoil staying dry is a strong clue." },
      { signal: "tree_shade", weight: 0.9, text: "Tree roots often compete hard for water." }
    ],
    negativeSignals: [
      { signal: "wet_area", weight: 2.1, text: "A wet patch points away from dry patch." },
      { signal: "pet_presence", weight: 1, text: "Pet damage stays plausible if there are dogs." }
    ],
    disambiguatingQuestionIds: [q("q-dry"), q("q-tree"), q("q-sudden"), q("q-pets")],
    urgency: "medium"
  },
  {
    id: "overwatering",
    label: "Overwatering",
    issueFamily: "water",
    hallmarkSymptoms: ["soft lawn", "yellowing in persistently wet soil", "low oxygen at roots"],
    commonLookalikes: ["waterlogging", "fusarium", "moss dominance"],
    environmentalClues: ["recent frequent watering", "sprinklers or hose routine"],
    immediateActions: ["Pause watering", "Let the surface dry slightly", "Check whether the area drains naturally"],
    avoidDoing: ["Do not keep topping up moisture", "Do not feed a saturated lawn"],
    recoveryExpectations: ["Improvement usually follows once the root zone dries back a little"],
    whenToEscalate: ["patch stays waterlogged without irrigation", "fungal signs appear"],
    productCategoriesIfConfirmed: ["aeration"],
    positiveSignals: [
      { signal: "wet_area", weight: 2.1, text: "Persistent wetness supports overwatering." },
      { signal: "soggy_soil", weight: 2.3, text: "Soggy soil is a strong clue." }
    ],
    negativeSignals: [{ signal: "dry_soil", weight: 2.4, text: "Dry soil points away from overwatering." }],
    disambiguatingQuestionIds: [q("q-wet"), q("q-products")],
    urgency: "medium"
  },
  {
    id: "waterlogging",
    label: "Waterlogging / poor drainage",
    issueFamily: "drainage",
    hallmarkSymptoms: ["area stays wet longer", "squelchy soil", "patch weakens repeatedly in rain"],
    commonLookalikes: ["overwatering", "compaction", "moss dominance"],
    environmentalClues: ["clay soil", "poor drainage", "winter wet"],
    immediateActions: ["Keep off the area when soft", "Aerate once conditions allow", "Delay feeding until the root zone is healthier"],
    avoidDoing: ["Do not keep watering", "Do not work the soil while saturated"],
    recoveryExpectations: ["Structural drainage issues improve slowly rather than overnight"],
    whenToEscalate: ["standing water persists", "large sections remain soft for weeks"],
    productCategoriesIfConfirmed: ["aeration", "top-dressing"],
    positiveSignals: [
      { signal: "wet_area", weight: 2.7, text: "The area staying wetter is central evidence." },
      { signal: "soggy_soil", weight: 2.2, text: "Squelchy ground strongly supports drainage trouble." },
      { signal: "moss_visible", weight: 0.8, text: "Moss often accompanies persistent wetness." }
    ],
    negativeSignals: [{ signal: "dry_soil", weight: 2.3, text: "Dry soil points away from waterlogging." }],
    disambiguatingQuestionIds: [q("q-wet"), q("q-tree"), q("q-fungi")],
    urgency: "medium"
  },
  {
    id: "compaction",
    label: "Compaction",
    issueFamily: "drainage",
    hallmarkSymptoms: ["thin patch in traffic area", "soil feels hard", "wet and slow to recover"],
    commonLookalikes: ["waterlogging", "shade weakness", "dry patch"],
    environmentalClues: ["gateways", "turning points", "heavy use"],
    immediateActions: ["Reduce traffic if possible", "Aerate when ground is right", "Keep mowing height a touch higher"],
    avoidDoing: ["Do not keep walking it when soft", "Do not assume feed will solve a structural issue"],
    recoveryExpectations: ["Improvement is gradual and usually follows aeration plus lighter use"],
    whenToEscalate: ["compaction is severe across large zones", "rubble or poor build-up suspected"],
    productCategoriesIfConfirmed: ["aeration", "top-dressing"],
    positiveSignals: [
      { signal: "compacted_area", weight: 2.6, text: "The patch appears compacted." },
      { signal: "high_traffic", weight: 2.2, text: "High traffic strongly supports compaction." },
      { signal: "wet_area", weight: 1.1, text: "Compaction often causes a wetter patch too." },
      { signal: "tree_shade", weight: 0.4, text: "Tree roots can worsen surface compaction." }
    ],
    negativeSignals: [{ signal: "sudden_appearance", weight: 1.1, text: "Very sudden onset is less typical for compaction." }],
    disambiguatingQuestionIds: [q("q-wet"), q("q-tree"), q("q-mowing")],
    urgency: "medium"
  },
  {
    id: "shade-weakness",
    label: "Shade weakness",
    issueFamily: "shade",
    hallmarkSymptoms: ["thin sparse grass", "decline in shaded corner", "worse under trees or fences"],
    commonLookalikes: ["moss dominance", "dry patch", "compaction"],
    environmentalClues: ["under tree canopy", "low hours of direct sun"],
    immediateActions: ["Raise mowing height slightly", "Reduce expectations in deep shade", "Consider a shade-tolerant seed mix"],
    avoidDoing: ["Do not keep cutting very low", "Do not expect sun-lawn density in deep shade"],
    recoveryExpectations: ["Shade lawns improve slowly and may never match sunny areas"],
    whenToEscalate: ["deep tree shade with severe thinning year after year"],
    productCategoriesIfConfirmed: ["seed"],
    positiveSignals: [
      { signal: "tree_shade", weight: 2.2, text: "Tree or hedge shade strongly supports this." },
      { signal: "low_light", weight: 2.5, text: "Low light is a central cause." },
      { signal: "thin_shaded_grass", weight: 2, text: "The grass looks thin rather than scorched." },
      { signal: "moss_visible", weight: 0.7, text: "Moss often accompanies weak shaded turf." }
    ],
    negativeSignals: [
      { signal: "sudden_appearance", weight: 1.2, text: "Shade weakness is usually gradual, not sudden." },
      { signal: "isolated_patch", weight: 1, text: "One isolated patch points away from a broad shade issue." },
      { signal: "rest_of_lawn_healthy", weight: 1.1, text: "If the rest of the lawn is healthy, shade is less convincing as the main cause." },
      { signal: "scorched_centre", weight: 1, text: "A scorched centre points away from simple shade weakness." }
    ],
    disambiguatingQuestionIds: [q("q-tree"), q("q-wet"), q("q-closeup")],
    urgency: "low"
  },
  {
    id: "moss-dominance",
    label: "Moss dominance",
    issueFamily: "moss",
    hallmarkSymptoms: ["mossy patch in shade or damp", "weak grass underneath", "worse after winter"],
    commonLookalikes: ["shade weakness", "waterlogging", "moss treatment damage"],
    environmentalClues: ["damp, shaded, acidic or compacted site"],
    immediateActions: ["Fix the underlying damp, shade or compaction first", "Rake lightly once conditions suit", "Overseed with a more suitable mix if needed"],
    avoidDoing: ["Do not treat moss repeatedly without fixing the cause"],
    recoveryExpectations: ["Moss returns unless the underlying site conditions improve"],
    whenToEscalate: ["slimy algae-like surface or year-round saturation"],
    productCategoriesIfConfirmed: ["moss-control", "seed", "aeration"],
    positiveSignals: [
      { signal: "moss_visible", weight: 3, text: "Visible moss is the clearest clue." },
      { signal: "low_light", weight: 1.5, text: "Shade strongly supports moss pressure." },
      { signal: "wet_area", weight: 1.4, text: "Damp conditions favour moss." },
      { signal: "compacted_area", weight: 0.8, text: "Compaction often sits behind moss." }
    ],
    negativeSignals: [
      { signal: "sudden_appearance", weight: 0.9, text: "Moss dominance is usually not a sudden event." },
      { signal: "isolated_patch", weight: 0.9, text: "One isolated patch makes moss less likely as the main explanation." },
      { signal: "scorched_centre", weight: 0.9, text: "Scorch-like damage points away from moss dominance." }
    ],
    disambiguatingQuestionIds: [q("q-tree"), q("q-wet"), q("q-products")],
    urgency: "low"
  },
  {
    id: "red-thread",
    label: "Red thread",
    issueFamily: "disease",
    hallmarkSymptoms: ["strawy pinkish patch", "red thread-like structures on blades"],
    commonLookalikes: ["drought stress", "fusarium", "rust"],
    environmentalClues: ["humid weather", "low nutrition", "late spring to autumn"],
    immediateActions: ["Avoid panic treatment", "Improve airflow if possible", "Feed only when conditions suit and stress is low"],
    avoidDoing: ["Do not overwater a humid lawn"],
    recoveryExpectations: ["Mild cases often grow out once conditions improve"],
    whenToEscalate: ["rapid spread with obvious fungal growth"],
    productCategoriesIfConfirmed: ["feed"],
    positiveSignals: [
      { signal: "red_threads_visible", weight: 3.5, text: "Red threads are highly characteristic." },
      { signal: "multiple_patches", weight: 0.8, text: "Red thread often appears in scattered patches." },
      { signal: "wet_area", weight: 0.9, text: "Humid conditions help it along." }
    ],
    negativeSignals: [{ signal: "dark_green_border", weight: 1, text: "A green border suggests scorch more than red thread." }],
    disambiguatingQuestionIds: [q("q-fungi"), q("q-closeup"), q("q-products")],
    urgency: "medium"
  },
  {
    id: "rust",
    label: "Rust",
    issueFamily: "disease",
    hallmarkSymptoms: ["orange dust on shoes or blades", "widespread orange tint"],
    commonLookalikes: ["red thread", "drought stress"],
    environmentalClues: ["late summer or autumn", "slower growth"],
    immediateActions: ["Reduce stress", "Mow once conditions are dry", "Support steady growth if the lawn is otherwise ready"],
    avoidDoing: ["Do not treat as scorch without checking the blades"],
    recoveryExpectations: ["Rust usually eases once growth picks up"],
    whenToEscalate: ["extensive leaf damage across the lawn"],
    productCategoriesIfConfirmed: ["feed"],
    positiveSignals: [
      { signal: "orange_dust_visible", weight: 3.5, text: "Orange dust is the strongest rust clue." },
      { signal: "multiple_patches", weight: 0.7, text: "Rust can appear across scattered patches." }
    ],
    negativeSignals: [{ signal: "isolated_patch", weight: 0.9, text: "One isolated patch is less classic for rust." }],
    disambiguatingQuestionIds: [q("q-fungi"), q("q-closeup")],
    urgency: "medium"
  },
  {
    id: "fusarium",
    label: "Fusarium / snow mould",
    issueFamily: "disease",
    hallmarkSymptoms: ["patchy discoloured turf in cool wet conditions", "white cottony growth in humid spells"],
    commonLookalikes: ["red thread", "waterlogging"],
    environmentalClues: ["cool damp weather", "poor airflow", "winter or shoulder seasons"],
    immediateActions: ["Reduce traffic", "Improve airflow and surface dryness", "Pause feeding if the lawn is soft and wet"],
    avoidDoing: ["Do not keep the area wet", "Do not scarify an actively diseased patch"],
    recoveryExpectations: ["Light cases may grow out as conditions dry"],
    whenToEscalate: ["white growth obvious and patches widening fast"],
    productCategoriesIfConfirmed: ["aeration"],
    positiveSignals: [
      { signal: "white_cottony_growth", weight: 3.6, text: "White cottony growth is a strong fusarium clue." },
      { signal: "wet_area", weight: 1.4, text: "Cool wet conditions support fusarium." },
      { signal: "low_light", weight: 0.6, text: "Poor airflow and shade can contribute." }
    ],
    negativeSignals: [{ signal: "dry_soil", weight: 1.8, text: "Dry soil points away from fusarium." }],
    disambiguatingQuestionIds: [q("q-fungi"), q("q-wet"), q("q-closeup")],
    urgency: "high"
  },
  {
    id: "fairy-ring",
    label: "Fairy ring",
    issueFamily: "disease",
    hallmarkSymptoms: ["ring pattern", "mushrooms", "green ring or dead ring"],
    commonLookalikes: ["dog urine ring", "dry patch"],
    environmentalClues: ["repeating ring", "organic matter under soil"],
    immediateActions: ["Avoid aggressive chemical guesses", "Improve wetting if the ring stays dry", "Monitor the shape over time"],
    avoidDoing: ["Do not assume one-off scorch if the ring is persistent"],
    recoveryExpectations: ["Fairy rings can be persistent and often need management rather than a quick fix"],
    whenToEscalate: ["rings enlarging consistently", "significant hydrophobic dry ring"],
    productCategoriesIfConfirmed: ["wetting-agent"],
    positiveSignals: [
      { signal: "ring_pattern", weight: 3.5, text: "Ring pattern is the defining clue." },
      { signal: "mushrooms_present", weight: 2.4, text: "Mushrooms make fairy ring more plausible." },
      { signal: "circular_expansion", weight: 1.8, text: "A slowly expanding circle supports it." }
    ],
    negativeSignals: [{ signal: "pet_presence", weight: 0.9, text: "Pet activity keeps scorch on the board." }],
    disambiguatingQuestionIds: [q("q-fungi"), q("q-dry"), q("q-closeup")],
    urgency: "medium"
  },
  {
    id: "take-all-patch",
    label: "Take-all patch",
    issueFamily: "disease",
    hallmarkSymptoms: ["patches that keep failing in warm dry periods", "persistent weak turf that struggles to recover"],
    commonLookalikes: ["dry patch", "drought stress"],
    environmentalClues: ["established lawn repeatedly weak in same spot"],
    immediateActions: ["Reduce stress", "Avoid forcing growth into a struggling patch", "Observe whether the same area keeps failing each season"],
    avoidDoing: ["Do not assume a quick chemical fix"],
    recoveryExpectations: ["Recovery tends to be slow and management-led"],
    whenToEscalate: ["same patch failing year after year without obvious site cause"],
    productCategoriesIfConfirmed: ["patch-repair", "top-dressing"],
    positiveSignals: [
      { signal: "dry_area", weight: 1.3, text: "Warm dry stress often reveals the issue." },
      { signal: "gradual_spread", weight: 1.2, text: "Slowly developing patch fits better than sudden scorch." }
    ],
    negativeSignals: [
      { signal: "sudden_appearance", weight: 1.5, text: "Sudden onset points away from take-all patch." },
      { signal: "recent_fertiliser", weight: 0.8, text: "Recent products keep chemical explanations in play." }
    ],
    disambiguatingQuestionIds: [q("q-dry"), q("q-sudden"), q("q-closeup")],
    urgency: "medium"
  },
  {
    id: "chafer-grubs",
    label: "Chafer grub damage",
    issueFamily: "pest",
    hallmarkSymptoms: ["patch lifts like a carpet", "birds or mammals digging", "root loss under turf"],
    commonLookalikes: ["leatherjackets", "new lawn failure"],
    environmentalClues: ["late summer into autumn damage, then secondary bird activity"],
    immediateActions: ["Check beneath the turf before treating", "Photograph roots and any grubs", "Reduce further disturbance until confirmed"],
    avoidDoing: ["Do not assume fungus if the turf lifts cleanly"],
    recoveryExpectations: ["Recovery depends on root regrowth and patch repair"],
    whenToEscalate: ["large areas lifting easily", "obvious grub numbers present"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "birds_pecking", weight: 2.1, text: "Bird activity often follows grub feeding." },
      { signal: "turf_lifts_easily", weight: 3.4, text: "Turf lifting easily is one of the strongest clues." },
      { signal: "bare_soil", weight: 0.7, text: "Root loss leaves weak bare patches behind." }
    ],
    negativeSignals: [{ signal: "recent_fertiliser", weight: 0.6, text: "Recent products keep scorch in play." }],
    disambiguatingQuestionIds: [q("q-birds"), q("q-lift"), q("q-closeup")],
    urgency: "high"
  },
  {
    id: "leatherjackets",
    label: "Leatherjacket damage",
    issueFamily: "pest",
    hallmarkSymptoms: ["weak patch with easy lift", "bird activity", "root chewing close to surface"],
    commonLookalikes: ["chafer grubs", "waterlogging"],
    environmentalClues: ["cool-season damage", "bird pecking on soft lawns"],
    immediateActions: ["Check the root zone before deciding next steps", "Photograph what is under the turf"],
    avoidDoing: ["Do not assume simple water stress if roots are failing"],
    recoveryExpectations: ["Recovery depends on re-rooting and sometimes reseeding"],
    whenToEscalate: ["large areas losing anchorage", "clear widespread larvae"],
    productCategoriesIfConfirmed: ["patch-repair"],
    positiveSignals: [
      { signal: "birds_pecking", weight: 1.8, text: "Bird activity fits leatherjacket feeding too." },
      { signal: "turf_lifts_easily", weight: 2.9, text: "Easy lift strongly supports root-feeding damage." },
      { signal: "wet_area", weight: 1.2, text: "Soft lawns often show secondary damage sooner." }
    ],
    negativeSignals: [{ signal: "dry_soil", weight: 0.9, text: "Very dry soil makes leatherjacket damage less obvious." }],
    disambiguatingQuestionIds: [q("q-birds"), q("q-lift"), q("q-wet")],
    urgency: "high"
  },
  {
    id: "scalping",
    label: "Scalping / mowing damage",
    issueFamily: "mowing",
    hallmarkSymptoms: ["yellow patch after mowing", "low cut on a bump or edge", "thin shredded look"],
    commonLookalikes: ["drought stress", "fertiliser scorch"],
    environmentalClues: ["recent low mowing", "wheel turns or raised ground"],
    immediateActions: ["Raise mowing height", "Let the area recover before stressing it again", "Water only if genuinely dry"],
    avoidDoing: ["Do not keep cutting low", "Do not mistake scalping for fungus on its own"],
    recoveryExpectations: ["Scalped patches often recover if roots remain healthy"],
    whenToEscalate: ["ongoing mechanical damage from repeated turns or spills"],
    productCategoriesIfConfirmed: ["seed"],
    positiveSignals: [
      { signal: "after_mowing", weight: 2.7, text: "Timing after mowing is the key clue." },
      { signal: "scalped_look", weight: 3, text: "The visual looks like scalping." },
      { signal: "high_traffic", weight: 0.5, text: "Turns and wheel pressure often worsen it." }
    ],
    negativeSignals: [{ signal: "mushrooms_present", weight: 1.1, text: "Mushrooms point away from simple mowing damage." }],
    disambiguatingQuestionIds: [q("q-mowing"), q("q-products"), q("q-closeup")],
    urgency: "medium"
  },
  {
    id: "new-lawn-failure",
    label: "New lawn establishment problem",
    issueFamily: "seeding",
    hallmarkSymptoms: ["patchy germination", "washout", "young turf not knitting in"],
    commonLookalikes: ["pest damage", "dry patch"],
    environmentalClues: ["recent seeding or laid turf", "heavy rain or birds", "foot traffic"],
    immediateActions: ["Protect the area", "Keep moisture even rather than soaked", "Re-level or re-seed washed-out sections when timing is right"],
    avoidDoing: ["Do not treat like a mature-lawn disease problem"],
    recoveryExpectations: ["New lawns are more variable and often need targeted repair"],
    whenToEscalate: ["large-scale washout", "turf failing to root in"],
    productCategoriesIfConfirmed: ["seed", "top-dressing", "patch-repair"],
    positiveSignals: [
      { signal: "new_lawn", weight: 3.4, text: "New establishment changes the diagnosis completely." },
      { signal: "washout_pattern", weight: 2.4, text: "Washout pattern strongly supports establishment failure." },
      { signal: "bare_soil", weight: 1.1, text: "Bare soil is common after washout or poor take." }
    ],
    negativeSignals: [{ signal: "pet_presence", weight: 0.7, text: "Pets can still damage new lawns, but establishment remains central." }],
    disambiguatingQuestionIds: [q("q-new-lawn"), q("q-lift"), q("q-dry")],
    urgency: "medium"
  },
  {
    id: "soil-ph-stress",
    label: "Soil pH or soil-health stress",
    issueFamily: "soil",
    hallmarkSymptoms: ["persistent underperformance", "poor response to feeding", "mossy or weak turf"],
    commonLookalikes: ["shade weakness", "waterlogging", "compaction"],
    environmentalClues: ["historically weak area", "acidic readings", "moss pressure"],
    immediateActions: ["Use soil readings before treating aggressively", "Focus on the underlying site issue first"],
    avoidDoing: ["Do not assume pH is the sole problem from one symptom"],
    recoveryExpectations: ["Soil corrections take time to show in turf performance"],
    whenToEscalate: ["long-term failure despite good basic care"],
    productCategoriesIfConfirmed: ["soil-amendment"],
    positiveSignals: [
      { signal: "historically_weak_area", weight: 1.8, text: "A patch that underperforms year after year fits background soil stress." },
      { signal: "acidic_reading", weight: 2.1, text: "An acidic reading or acidic wording points toward soil-health issues." },
      { signal: "moss_visible", weight: 0.8, text: "Moss can accompany acidic, weak turf." },
      { signal: "thin_shaded_grass", weight: 0.5, text: "Weak turf can be a soil-health clue too." }
    ],
    negativeSignals: [{ signal: "sudden_appearance", weight: 1.3, text: "Sudden change is less typical of slow soil issues." }],
    disambiguatingQuestionIds: [q("q-tree"), q("q-products"), q("q-closeup")],
    urgency: "low"
  },
  {
    id: "mowing-window",
    label: "Mowing timing advice",
    issueFamily: "seasonal",
    hallmarkSymptoms: ["timing question about mowing rather than a new diagnosis"],
    commonLookalikes: ["weekend plan", "watering guidance"],
    environmentalClues: ["surface firmness", "recent rain", "frost risk"],
    immediateActions: ["Mow only once the surface feels firm and the grass is dry on top."],
    avoidDoing: ["Do not mow soft, smeary, or frosty turf."],
    recoveryExpectations: ["Good timing reduces visible stress and rutting."],
    whenToEscalate: ["wheel marks or smearing even in light passes"],
    productCategoriesIfConfirmed: [],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "low"
  },
  {
    id: "feeding-window",
    label: "Feeding timing advice",
    issueFamily: "seasonal",
    hallmarkSymptoms: ["timing question about feeding rather than a patch diagnosis"],
    commonLookalikes: ["treatment safety", "weekend plan"],
    environmentalClues: ["soil temperature", "growth conditions", "rain timing"],
    immediateActions: ["Feed only when the lawn is actively growing and not under obvious stress."],
    avoidDoing: ["Do not feed a drought-stressed, frosty, or waterlogged lawn."],
    recoveryExpectations: ["Correct timing gives a cleaner response than pushing feed into stress."],
    whenToEscalate: ["the lawn is already bleached, soft, or chemically stressed"],
    productCategoriesIfConfirmed: ["feed"],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "medium"
  },
  {
    id: "seeding-window",
    label: "Seeding timing advice",
    issueFamily: "seeding",
    hallmarkSymptoms: ["timing question about seeding or overseeding"],
    commonLookalikes: ["weekend plan", "new lawn establishment problem"],
    environmentalClues: ["soil temperature", "frost risk", "moisture"],
    immediateActions: ["Seed when soil warmth and moisture are steady enough for clean germination."],
    avoidDoing: ["Do not overseed into cold soil or obvious frost risk."],
    recoveryExpectations: ["Good timing improves germination speed and reduces patchy take."],
    whenToEscalate: ["seed repeatedly failing in suitable weather"],
    productCategoriesIfConfirmed: ["seed", "top-dressing"],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "medium"
  },
  {
    id: "watering-guidance",
    label: "Watering guidance",
    issueFamily: "water",
    hallmarkSymptoms: ["timing question about watering rather than cause diagnosis"],
    commonLookalikes: ["drought stress", "weekend plan"],
    environmentalClues: ["current moisture", "near-term rain", "recent heat"],
    immediateActions: ["Water only if the root zone is dry and rain is not about to do the job for you."],
    avoidDoing: ["Do not keep topping up a lawn that is already damp enough."],
    recoveryExpectations: ["Deep, well-timed watering is usually better than frequent light watering."],
    whenToEscalate: ["the area stays dry or hydrophobic despite watering"],
    productCategoriesIfConfirmed: ["wetting-agent"],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "medium"
  },
  {
    id: "weekend-plan",
    label: "Weekend lawn plan",
    issueFamily: "seasonal",
    hallmarkSymptoms: ["general planning question for this weekend or week"],
    commonLookalikes: ["mowing timing advice", "feeding timing advice", "watering guidance"],
    environmentalClues: ["weather window", "recent reading", "current stress level"],
    immediateActions: ["Keep the weekend plan simple and let current conditions drive it."],
    avoidDoing: ["Do not pile feed, mowing, and repair onto a lawn that is already stressed."],
    recoveryExpectations: ["A calm, weather-aware plan usually prevents avoidable setbacks."],
    whenToEscalate: ["a clear patch or disease issue appears instead of a timing question"],
    productCategoriesIfConfirmed: [],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "low"
  },
  {
    id: "treatment-safety",
    label: "Treatment safety guidance",
    issueFamily: "chemical",
    hallmarkSymptoms: ["safety or re-entry question after a treatment"],
    commonLookalikes: ["feeding timing advice", "weedkiller damage"],
    environmentalClues: ["recent product use", "kids or pets using the lawn"],
    immediateActions: ["Treat this as a label-first question and keep people and pets off until the product is dry and the label says normal use is fine."],
    avoidDoing: ["Do not guess a re-entry window if you still have the product packet."],
    recoveryExpectations: ["Clear label guidance avoids unnecessary risk or delay."],
    whenToEscalate: ["the product is still wet on the leaf or someone had direct contact"],
    productCategoriesIfConfirmed: [],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "high"
  },
  {
    id: "zone-comparison-insight",
    label: "Zone comparison insight",
    issueFamily: "drainage",
    hallmarkSymptoms: ["one zone consistently wetter or drier than another"],
    commonLookalikes: ["waterlogging", "compaction", "shade weakness"],
    environmentalClues: ["back lawn vs front lawn", "different exposure or drainage"],
    immediateActions: ["Treat the wetter and drier zones as separate conditions rather than one schedule."],
    avoidDoing: ["Do not water or feed every zone in exactly the same way."],
    recoveryExpectations: ["Zone-specific care usually outperforms one-size-fits-all scheduling."],
    whenToEscalate: ["one zone stays persistently soft or bare after every wet spell"],
    productCategoriesIfConfirmed: ["aeration", "wetting-agent"],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [],
    urgency: "medium"
  },
  {
    id: "other-stress",
    label: "Other or mixed lawn stress",
    issueFamily: "general",
    hallmarkSymptoms: ["insufficient evidence", "mixed or ambiguous picture"],
    commonLookalikes: ["all of the above"],
    environmentalClues: ["missing close-up or timeline detail"],
    immediateActions: ["Gather one better close-up and one wider photo", "Avoid stacking treatments before narrowing the cause"],
    avoidDoing: ["Do not guess with chemicals on thin evidence"],
    recoveryExpectations: ["Most cases narrow quickly once one or two missing clues are added"],
    whenToEscalate: ["rapid spread", "large sections failing", "severe safety concern"],
    productCategoriesIfConfirmed: [],
    positiveSignals: [],
    negativeSignals: [],
    disambiguatingQuestionIds: [q("q-sudden"), q("q-products"), q("q-closeup")],
    urgency: "low"
  }
];

export const getDiagnosticPlaybook = (hypothesisId: string): DiagnosticPlaybook | undefined =>
  diagnosticPlaybooks.find((playbook) => playbook.id === hypothesisId);

export const getDiagnosticQuestionTemplate = (
  questionId: string
): DiagnosticQuestionTemplate | undefined =>
  diagnosticQuestionTemplates.find((question) => question.id === questionId);
