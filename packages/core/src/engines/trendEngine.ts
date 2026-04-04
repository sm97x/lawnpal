import type { SensorReading, TrendSummary } from "../types";
import { average } from "../utils/date";

export const buildTrendSummaries = (
  readings: SensorReading[],
  currentZoneId: string
): TrendSummary[] => {
  const zoneReadings = readings
    .filter((reading) => reading.zoneId === currentZoneId)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  if (zoneReadings.length < 2) {
    return [];
  }

  const recent = zoneReadings.slice(-3);
  const previous = zoneReadings.slice(-6, -3);
  const summaries: TrendSummary[] = [];

  if (previous.length) {
    const recentMoisture = average(recent.map((item) => item.metrics.moisture));
    const previousMoisture = average(previous.map((item) => item.metrics.moisture));
    const recentTemp = average(recent.map((item) => item.metrics.soilTemperatureC));
    const previousTemp = average(previous.map((item) => item.metrics.soilTemperatureC));

    if (recentMoisture - previousMoisture >= 8) {
      summaries.push({
        key: "moisture-rising",
        text: "This zone has been wetter than usual across the last few checks."
      });
    }

    if (previousMoisture - recentMoisture >= 8) {
      summaries.push({
        key: "moisture-falling",
        text: "This zone has been drying out over recent readings."
      });
    }

    if (recentTemp - previousTemp >= 1.5) {
      summaries.push({
        key: "temp-rising",
        text: "Soil temperature is rising, which should improve growth conditions."
      });
    }
  }

  return summaries;
};
