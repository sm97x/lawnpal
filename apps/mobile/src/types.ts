import type { AiAskStructuredResponse, MetricSystem } from "@lawnpal/core";

export type StoredLocation = {
  lat: number;
  lon: number;
  label: string;
  source: "device" | "postcode";
  postcode?: string;
};

export type AiAskHistoryItem = {
  id: string;
  createdAt: string;
  question: string;
  imageDataUrl?: string;
  response: AiAskStructuredResponse;
};

export type AppSettings = {
  onboardingComplete: boolean;
  remindersEnabled: boolean;
  metricSystem: MetricSystem;
  location?: StoredLocation;
};

