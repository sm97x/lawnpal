import type { NormalizedWeather, RecommendationSet, ScheduleTask } from "../types";
import { addDays } from "../utils/date";
import { makeId } from "../utils/id";

export const generateSchedule = (input: {
  recommendationSet: RecommendationSet;
  weather: NormalizedWeather;
}): ScheduleTask[] => {
  const { recommendationSet, weather } = input;
  const tasks: ScheduleTask[] = [];
  const latestDate = recommendationSet.generatedAt;
  const primary = recommendationSet.recommendations.slice(0, 5);

  for (const recommendation of primary) {
    if (recommendation.actionType === "water" && recommendation.positive) {
      tasks.push({
        id: makeId("task"),
        readingId: recommendationSet.readingId,
        title: "Water lightly",
        reason: recommendation.explanation,
        actionType: "water",
        urgency: recommendation.urgency,
        status: "pending",
        startDate: recommendation.idealDateStart ?? latestDate,
        endDate: recommendation.idealDateEnd
      });
    }

    if (recommendation.actionType === "water" && !recommendation.positive) {
      tasks.push({
        id: makeId("task"),
        readingId: recommendationSet.readingId,
        title: "Do not water today",
        reason: recommendation.explanation,
        actionType: "water",
        urgency: recommendation.urgency,
        status: "pending",
        startDate: latestDate
      });
    }

    if (recommendation.actionType === "feed") {
      tasks.push({
        id: makeId("task"),
        readingId: recommendationSet.readingId,
        title: recommendation.positive ? "Possible feeding window" : "Hold off feeding",
        reason: recommendation.explanation,
        actionType: "feed",
        urgency: recommendation.urgency,
        status: "pending",
        startDate: recommendation.idealDateStart ?? addDays(latestDate, 1),
        endDate: recommendation.idealDateEnd
      });
    }

    if (recommendation.actionType === "seed") {
      tasks.push({
        id: makeId("task"),
        readingId: recommendationSet.readingId,
        title: recommendation.positive ? "Seed if you are planning to overseed" : "Avoid overseeding",
        reason: recommendation.explanation,
        actionType: "seed",
        urgency: recommendation.urgency,
        status: "pending",
        startDate: recommendation.idealDateStart ?? latestDate,
        endDate: recommendation.idealDateEnd
      });
    }

    if (recommendation.actionType === "mow" && recommendation.positive) {
      tasks.push({
        id: makeId("task"),
        readingId: recommendationSet.readingId,
        title: "Mowing is fine this weekend",
        reason: recommendation.explanation,
        actionType: "mow",
        urgency: "low",
        status: "pending",
        startDate: recommendation.idealDateStart ?? addDays(latestDate, 2),
        endDate: recommendation.idealDateEnd
      });
    }
  }

  tasks.push({
    id: makeId("task"),
    readingId: recommendationSet.readingId,
    title: "Check the lawn again",
    reason: "A fresh scan will confirm whether this week's decision worked.",
    actionType: "scan",
    urgency:
      recommendationSet.lawnStatus === "at-risk"
        ? "high"
        : recommendationSet.lawnStatus === "slightly-stressed"
          ? "medium"
          : "low",
    status: "pending",
    startDate: recommendationSet.checkAgainAt
  });

  if (weather.daily[0]?.rainProbability && weather.daily[0].rainProbability >= 60) {
    tasks.push({
      id: makeId("task"),
      readingId: recommendationSet.readingId,
      title: "Let today’s rain do the work",
      reason: "Rain is likely, so avoid doubling up with manual watering.",
      actionType: "general",
      urgency: "medium",
      status: "pending",
      startDate: latestDate
    });
  }

  return tasks.sort((a, b) => a.startDate.localeCompare(b.startDate));
};
