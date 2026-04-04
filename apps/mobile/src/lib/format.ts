import type { LawnStatus, SensorMetrics } from "@lawnpal/core";

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

export const describeMetric = (key: keyof SensorMetrics, value: number): string => {
  switch (key) {
    case "moisture":
      return `${Math.round(value)}% moisture`;
    case "soilTemperatureC":
      return `${value.toFixed(1)}C soil`;
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

