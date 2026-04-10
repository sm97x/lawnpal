import type { LawnStatus, MetricSystem, SensorMetrics } from "@lawnpal/core";

export const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(isoDate));

export const formatDateTime = (isoDate: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoDate));

export const statusLabel = (status: LawnStatus): string => {
  switch (status) {
    case "thriving":
      return "Thriving";
    case "stable":
      return "Stable";
    case "slightly-stressed":
      return "Slightly stressed";
    case "at-risk":
      return "At risk";
  }
};

const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32;

export const formatTemperature = (
  celsius: number,
  metricSystem: MetricSystem = "metric"
): string =>
  metricSystem === "imperial"
    ? `${Math.round(toFahrenheit(celsius))} F`
    : `${celsius.toFixed(1)} C`;

export const formatTemperatureRange = (
  minC: number,
  maxC: number,
  metricSystem: MetricSystem = "metric"
): string =>
  metricSystem === "imperial"
    ? `${Math.round(toFahrenheit(minC))}-${Math.round(toFahrenheit(maxC))} F`
    : `${Math.round(minC)}-${Math.round(maxC)} C`;

export const describeMetric = (key: keyof SensorMetrics, value: number): string => {
  switch (key) {
    case "moisture":
      return `${Math.round(value)}% moisture`;
    case "soilTemperatureC":
      return `${value.toFixed(1)} C soil`;
    case "ec":
      return `EC ${value.toFixed(1)}`;
    case "ph":
      return `pH ${value.toFixed(1)}`;
    case "lightLux":
      return `${Math.round(value).toLocaleString("en-GB")} lux`;
    case "humidity":
      return `${Math.round(value)}% humidity`;
  }
};

export const relativeCheckLabel = (isoDate: string): string => {
  const target = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "Check again today";
  }

  if (diffDays === 1) {
    return "Check again tomorrow";
  }

  return `Check again in ${diffDays} days`;
};

export const formatShortTime = (isoDate: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoDate));

export const formatRelativeTimestamp = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.round(diff / (60 * 1000)));

  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
};

export const dayBucketLabel = (
  isoDate: string
): "Today" | "Yesterday" | "This Week" | "Earlier" => {
  const date = new Date(isoDate);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  if (date >= startOfToday) {
    return "Today";
  }

  if (date >= startOfYesterday) {
    return "Yesterday";
  }

  if (date >= startOfWeek) {
    return "This Week";
  }

  return "Earlier";
};
