import type {
  LawnProfile,
  LawnStatus,
  NormalizedWeather,
  Recommendation,
  RecommendationSet,
  SensorReading,
  Zone
} from "../types";
import { addDays, average, clamp } from "../utils/date";
import { makeId } from "../utils/id";
import { buildTrendSummaries } from "./trendEngine";

type RecommendationContext = {
  reading: SensorReading;
  zone: Zone;
  weather: NormalizedWeather;
  profile: LawnProfile;
  recentZoneReadings: SensorReading[];
  allRecentReadings: SensorReading[];
  siblingZones: Zone[];
};

const pushRecommendation = (
  list: Recommendation[],
  partial: Omit<Recommendation, "id">
) => {
  list.push({ id: makeId("rec"), ...partial });
};

const statusFromScore = (score: number): LawnStatus => {
  if (score >= 85) return "thriving";
  if (score >= 70) return "stable";
  if (score >= 52) return "slightly-stressed";
  return "at-risk";
};

export const generateRecommendations = (context: RecommendationContext): RecommendationSet => {
  const { metrics } = context.reading;
  const nextThreeDays = context.weather.daily.slice(0, 3);
  const rainSoon = nextThreeDays.some(
    (day) => day.rainProbability >= 55 || day.precipitationMm >= 3
  );
  const frostSoon = nextThreeDays.some((day) => day.isFrostRisk);
  const lowLight = metrics.lightLux < 6500 || context.zone.exposure === "shade";
  const recommendations: Recommendation[] = [];
  const issues: string[] = [];
  const highlights: string[] = [];
  let score = 84;

  if (metrics.moisture >= 78) {
    score -= 18;
    issues.push("Soil moisture is very high.");
    pushRecommendation(recommendations, {
      title: "Too wet — do not water this week",
      explanation:
        "Hold off watering this week. The root zone is already saturated and extra water will slow recovery.",
      confidence: "high",
      actionType: "water",
      urgency: "high",
      sourceRules: ["moisture-high"]
    });
  }

  if (metrics.moisture <= 30 && !rainSoon) {
    score -= 16;
    issues.push("This zone is running dry.");
    pushRecommendation(recommendations, {
      title: "Water within the next day",
      explanation:
        "Moisture is low and there is no useful rain in the immediate forecast, so a light soak is justified.",
      confidence: "high",
      actionType: "water",
      urgency: "high",
      idealDateStart: context.weather.daily[0]?.date,
      idealDateEnd: context.weather.daily[1]?.date,
      positive: true,
      sourceRules: ["moisture-low", "rain-not-expected"]
    });
  }

  if (metrics.soilTemperatureC < 8) {
    score -= 10;
    issues.push("Soil is too cold for reliable germination.");
    pushRecommendation(recommendations, {
      title: "Too cold to seed",
      explanation:
        "Wait for warmer soil before overseeding. Seed will struggle to establish below 8C.",
      confidence: "high",
      actionType: "seed",
      urgency: "medium",
      sourceRules: ["soil-temp-below-8"]
    });
  } else if (metrics.soilTemperatureC < 10) {
    score -= 4;
    pushRecommendation(recommendations, {
      title: "Seeding window is only marginal",
      explanation:
        "You are close, but a little more warmth would make establishment more reliable.",
      confidence: "medium",
      actionType: "seed",
      urgency: "medium",
      sourceRules: ["soil-temp-8-to-10"]
    });
  } else if (!frostSoon) {
    highlights.push("Conditions are warm enough for seeding.");
    pushRecommendation(recommendations, {
      title: "Good seeding window opening",
      explanation:
        "Soil temperature is high enough and frost risk looks low over the next few days.",
      confidence: "high",
      actionType: "seed",
      urgency: "medium",
      positive: true,
      idealDateStart: context.weather.daily[0]?.date,
      idealDateEnd: context.weather.daily[2]?.date,
      sourceRules: ["soil-temp-above-10", "no-frost-risk"]
    });
  }

  if (metrics.moisture >= 72 && lowLight && metrics.soilTemperatureC <= 12 && metrics.ph < 6.2) {
    score -= 12;
    issues.push("Conditions are favouring moss.");
    pushRecommendation(recommendations, {
      title: "High moss risk",
      explanation:
        "Wet soil, lower light and slightly acidic conditions make this zone vulnerable to moss pressure.",
      confidence: "high",
      actionType: "moss",
      urgency: "high",
      sourceRules: ["moss-risk-combo"]
    });
  }

  if (metrics.ec >= 2.3 && metrics.moisture >= 68) {
    score -= 8;
    issues.push("Hold off feeding for now.");
    pushRecommendation(recommendations, {
      title: "Pause feeding",
      explanation:
        "Nutrient concentration is already elevated while the soil is wet, so extra feed could stress the lawn.",
      confidence: "high",
      actionType: "feed",
      urgency: "high",
      sourceRules: ["ec-high", "moisture-high"]
    });
  } else if (
    metrics.soilTemperatureC >= 10 &&
    metrics.soilTemperatureC <= 18 &&
    metrics.ec <= 2 &&
    context.weather.daily[1] &&
    context.weather.daily[1].rainProbability >= 30 &&
    context.weather.daily[1].rainProbability <= 65
  ) {
    highlights.push("A gentle feeding window is forming.");
    pushRecommendation(recommendations, {
      title: "Possible feeding window soon",
      explanation:
        "Growth conditions look active and there may be enough follow-up moisture to help a feed settle in.",
      confidence: "medium",
      actionType: "feed",
      urgency: "medium",
      idealDateStart: context.weather.daily[1].date,
      idealDateEnd: context.weather.daily[2]?.date,
      positive: true,
      sourceRules: ["feed-window"]
    });
  }

  if (metrics.ph < 6) {
    score -= 6;
    pushRecommendation(recommendations, {
      title: "Soil is a bit acidic",
      explanation:
        "Grass is usually happiest nearer neutral, so keep an eye on acidity if this trend continues.",
      confidence: "medium",
      actionType: "soil",
      urgency: "medium",
      sourceRules: ["ph-low"]
    });
  } else if (metrics.ph >= 6 && metrics.ph <= 7.2) {
    highlights.push("Soil acidity is in a healthy range.");
    pushRecommendation(recommendations, {
      title: "pH looks healthy",
      explanation:
        "Soil acidity is sitting in a range that generally suits lawn grasses well.",
      confidence: "high",
      actionType: "soil",
      urgency: "low",
      positive: true,
      sourceRules: ["ph-good-range"]
    });
  }

  if (context.weather.daily.some((day) => day.rainProbability >= 65 || day.precipitationMm >= 4)) {
    pushRecommendation(recommendations, {
      title: "Mowing is better later in the week",
      explanation: "Rainy spells make mowing untidy and can compact already soft ground.",
      confidence: "medium",
      actionType: "mow",
      urgency: "low",
      sourceRules: ["wet-mowing-caution"]
    });
  } else {
    highlights.push("Mowing conditions look reasonable.");
    pushRecommendation(recommendations, {
      title: "Mowing looks fine this weekend",
      explanation:
        "The forecast is fairly dry, so mowing should be practical if the grass height needs it.",
      confidence: "medium",
      actionType: "mow",
      urgency: "low",
      positive: true,
      idealDateStart: context.weather.daily[1]?.date,
      idealDateEnd: context.weather.daily[4]?.date,
      sourceRules: ["mow-window"]
    });
  }

  const otherZones = context.allRecentReadings.filter(
    (reading) => reading.zoneId !== context.zone.id
  );

  if (context.recentZoneReadings.length >= 2 && otherZones.length >= 2) {
    const currentAverage = average(
      context.recentZoneReadings.slice(-3).map((reading) => reading.metrics.moisture)
    );
    const otherAverage = average(otherZones.slice(-3).map((reading) => reading.metrics.moisture));

    if (currentAverage - otherAverage >= 12) {
      pushRecommendation(recommendations, {
        title: `${context.zone.name} is staying wetter than other zones`,
        explanation:
          "That usually points to slower drainage, compaction or reduced sun in this part of the lawn.",
        confidence: "medium",
        actionType: "drainage",
        urgency: "medium",
        sourceRules: ["zone-wetter-than-others"]
      });
      issues.push("This zone is persistently wetter than the rest.");
    }
  }

  if (context.profile.soilType === "clay" && metrics.moisture >= 70) {
    pushRecommendation(recommendations, {
      title: "Clay soil is holding onto water",
      explanation:
        "Heavy soils drain slowly, so focus on aeration and patience rather than adding feed now.",
      confidence: "medium",
      actionType: "drainage",
      urgency: "medium",
      sourceRules: ["clay-and-wet"]
    });
  }

  const trends = buildTrendSummaries(context.allRecentReadings, context.zone.id);
  highlights.push(...trends.map((trend) => trend.text));

  score = clamp(score, 28, 97);
  const lawnStatus = statusFromScore(score);

  const ranked = [...recommendations].sort((a, b) => {
    const urgencyWeight = { high: 3, medium: 2, low: 1 };
    return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
  });

  const mainIssue =
    issues[0] ??
    (ranked[0]?.positive ? "Conditions are generally supportive this week." : ranked[0]?.title) ??
    "Your lawn looks fairly settled.";

  const doNow = ranked
    .filter((recommendation) => recommendation.positive || recommendation.urgency === "high")
    .slice(0, 3)
    .map((recommendation) => recommendation.title);

  const avoid = ranked
    .filter(
      (recommendation) =>
        !recommendation.positive &&
        (recommendation.actionType === "water" || recommendation.actionType === "feed")
    )
    .slice(0, 3)
    .map((recommendation) => recommendation.title);

  const checkAgainAt = addDays(
    context.reading.takenAt,
    lawnStatus === "at-risk" ? 2 : lawnStatus === "slightly-stressed" ? 3 : 5
  );

  return {
    id: makeId("summary"),
    readingId: context.reading.id,
    zoneId: context.zone.id,
    generatedAt: new Date().toISOString(),
    lawnStatus,
    lawnScore: score,
    mainIssue,
    summary:
      lawnStatus === "thriving"
        ? "Your lawn looks healthy, with only light upkeep needed."
        : lawnStatus === "stable"
          ? "The lawn is in decent shape, but one or two small decisions matter this week."
          : lawnStatus === "slightly-stressed"
            ? "The lawn needs a little restraint and better timing this week."
            : "The lawn is under pressure and should be managed carefully this week.",
    interpretation: `${context.zone.name} is ${mainIssue.toLowerCase()}`,
    recommendations: ranked,
    issues,
    highlights: Array.from(new Set(highlights)).slice(0, 4),
    doNow,
    avoid,
    checkAgainAt
  };
};
