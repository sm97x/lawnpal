import type { GrassStyle, Lawn, MetricSystem, SoilType, Zone } from "@lawnpal/core";
import { create } from "zustand";
import type { StoredLocation } from "../types";

type AppStoreState = {
  ready: boolean;
  lawn: Lawn | null;
  zones: Zone[];
  selectedZoneId: string | null;
  onboardingComplete: boolean;
  remindersEnabled: boolean;
  metricSystem: MetricSystem;
  location: StoredLocation | null;
  onboardingDraft: {
    lawnName: string;
    grassStyle: GrassStyle;
    soilType: SoilType;
  } | null;
  version: number;
  bootstrap: (payload: {
    lawn: Lawn | null;
    zones: Zone[];
    onboardingComplete: boolean;
    remindersEnabled: boolean;
    metricSystem: MetricSystem;
    location: StoredLocation | null;
  }) => void;
  setSelectedZoneId: (zoneId: string | null) => void;
  setLocation: (location: StoredLocation | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setLawnContext: (payload: { lawn: Lawn | null; zones: Zone[] }) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setMetricSystem: (metricSystem: MetricSystem) => void;
  setOnboardingDraft: (
    draft: {
      lawnName: string;
      grassStyle: GrassStyle;
      soilType: SoilType;
    } | null
  ) => void;
  bumpVersion: () => void;
  reset: () => void;
};

export const useAppStore = create<AppStoreState>((set) => ({
  ready: false,
  lawn: null,
  zones: [],
  selectedZoneId: null,
  onboardingComplete: false,
  remindersEnabled: true,
  metricSystem: "metric",
  location: null,
  onboardingDraft: null,
  version: 0,
  bootstrap: (payload) =>
    set({
      ready: true,
      lawn: payload.lawn,
      zones: payload.zones,
      selectedZoneId: payload.zones[0]?.id ?? null,
      onboardingComplete: payload.onboardingComplete,
      remindersEnabled: payload.remindersEnabled,
      metricSystem: payload.metricSystem,
      location: payload.location
    }),
  setSelectedZoneId: (selectedZoneId) => set({ selectedZoneId }),
  setLocation: (location) => set({ location }),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
  setLawnContext: ({ lawn, zones }) =>
    set((state) => ({
      lawn,
      zones,
      selectedZoneId:
        zones.find((zone) => zone.id === state.selectedZoneId)?.id ?? zones[0]?.id ?? null
    })),
  setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
  setMetricSystem: (metricSystem) => set({ metricSystem }),
  setOnboardingDraft: (onboardingDraft) => set({ onboardingDraft }),
  bumpVersion: () => set((state) => ({ version: state.version + 1 })),
  reset: () =>
    set({
      ready: true,
      lawn: null,
      zones: [],
      selectedZoneId: null,
      onboardingComplete: false,
      remindersEnabled: true,
      metricSystem: "metric",
      location: null,
      onboardingDraft: null,
      version: 0
    })
}));
