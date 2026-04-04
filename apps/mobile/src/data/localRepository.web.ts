import type {
  AiAskPayload,
  AiAskStructuredResponse,
  CareEvent,
  CaseReminder,
  DiagnosticCase,
  DiagnosticCaseState,
  DiagnosticMessage,
  Lawn,
  MetricSystem,
  NormalizedWeather,
  RecommendationSet,
  ScheduleTask,
  SensorReading,
  Zone
} from "@lawnpal/core";
import { makeId } from "@lawnpal/core";
import { migrateLegacyAiAskEntry } from "./diagnosticMigration";
import type { AiAskHistoryItem, StoredLocation } from "../types";

type WebState = {
  lawns: Lawn[];
  zones: Zone[];
  readings: SensorReading[];
  weatherSnapshots: { id: string; payload: NormalizedWeather }[];
  recommendations: RecommendationSet[];
  tasks: ScheduleTask[];
  aiAsks: {
    id: string;
    createdAt: string;
    question: string;
    payload: AiAskPayload;
    response: AiAskStructuredResponse;
  }[];
  diagnosticCases: DiagnosticCase[];
  diagnosticMessages: DiagnosticMessage[];
  diagnosticSnapshots: {
    id: string;
    caseId: string;
    createdAt: string;
    payload: DiagnosticCaseState;
  }[];
  careEvents: CareEvent[];
  caseReminders: CaseReminder[];
  productTaps: { id: string; productId: string; tappedAt: string }[];
  settings: {
    onboardingComplete: boolean;
    remindersEnabled: boolean;
    metricSystem: MetricSystem;
    location: StoredLocation | null;
  };
};

const STORAGE_KEY = "lawnpal-web-state-v3";
const LEGACY_STORAGE_KEYS = ["lawnpal-web-state", "lawnpal-web-state-v2"];

const clearLegacyState = () => {
  if (typeof localStorage === "undefined") {
    return;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
};

const defaultState = (): WebState => ({
  lawns: [],
  zones: [],
  readings: [],
  weatherSnapshots: [],
  recommendations: [],
  tasks: [],
  aiAsks: [],
  diagnosticCases: [],
  diagnosticMessages: [],
  diagnosticSnapshots: [],
  careEvents: [],
  caseReminders: [],
  productTaps: [],
  settings: {
    onboardingComplete: false,
    remindersEnabled: true,
    metricSystem: "metric",
    location: null
  }
});

let memoryState = defaultState();

const migrateLegacyAiAsksInState = (state: WebState): WebState => {
  if (state.diagnosticCases.length || !state.aiAsks.length) {
    return state;
  }

  const diagnosticCases: DiagnosticCase[] = [];
  const diagnosticMessages: DiagnosticMessage[] = [];
  const diagnosticSnapshots: WebState["diagnosticSnapshots"] = [];

  for (const entry of state.aiAsks) {
    const migrated = migrateLegacyAiAskEntry({
      id: entry.id,
      createdAt: entry.createdAt,
      question: entry.question,
      payload: entry.payload,
      response: entry.response
    });

    diagnosticCases.push(migrated.caseItem);
    diagnosticMessages.push(...migrated.messages);
    diagnosticSnapshots.push({
      id: `${migrated.caseItem.id}_snapshot`,
      caseId: migrated.caseItem.id,
      createdAt: migrated.caseItem.updatedAt,
      payload: migrated.snapshot
    });
  }

  return {
    ...state,
    diagnosticCases,
    diagnosticMessages,
    diagnosticSnapshots
  };
};

const readState = (): WebState => {
  if (typeof localStorage === "undefined") {
    return memoryState;
  }

  clearLegacyState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const state = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  try {
    return migrateLegacyAiAsksInState({ ...defaultState(), ...JSON.parse(raw) } as WebState);
  } catch {
    const state = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
};

const writeState = (state: WebState) => {
  memoryState = state;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

class LocalRepositoryWeb {
  async init() {
    const state = readState();
    writeState(state);
  }

  async saveSetting<T>(key: string, value: T) {
    const state = readState();
    writeState({
      ...state,
      settings: {
        ...state.settings,
        [key]: value
      }
    });
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const state = readState();
    const value = (state.settings as Record<string, unknown>)[key];
    return (value === undefined ? fallback : value) as T;
  }

  async saveLawn(lawn: Lawn) {
    const state = readState();
    writeState({
      ...state,
      lawns: [lawn]
    });
  }

  async getPrimaryLawn(): Promise<Lawn | null> {
    return readState().lawns[0] ?? null;
  }

  async saveZones(zones: Zone[]) {
    const state = readState();
    writeState({
      ...state,
      zones
    });
  }

  async getZones(): Promise<Zone[]> {
    return readState().zones.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getZoneById(zoneId: string): Promise<Zone | null> {
    return readState().zones.find((zone) => zone.id === zoneId) ?? null;
  }

  async saveReading(reading: SensorReading) {
    const state = readState();
    const readings = state.readings.filter((item) => item.id !== reading.id);
    readings.push(reading);
    writeState({
      ...state,
      readings
    });
  }

  async updateReadingMedia(
    readingId: string,
    input: {
      photoUri?: string;
      note?: string;
    }
  ) {
    const state = readState();
    writeState({
      ...state,
      readings: state.readings.map((reading) =>
        reading.id === readingId
          ? {
              ...reading,
              photoUri: input.photoUri ?? reading.photoUri,
              note: input.note ?? reading.note
            }
          : reading
      )
    });
  }

  async getReadingById(readingId: string): Promise<SensorReading | null> {
    return readState().readings.find((reading) => reading.id === readingId) ?? null;
  }

  async getReadingHistory(limit = 50): Promise<SensorReading[]> {
    return [...readState().readings]
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .slice(0, limit);
  }

  async getZoneReadings(zoneId: string, limit = 20): Promise<SensorReading[]> {
    return [...readState().readings]
      .filter((reading) => reading.zoneId === zoneId)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .slice(0, limit);
  }

  async saveWeatherSnapshot(weather: NormalizedWeather): Promise<string> {
    const state = readState();
    const id = makeId("weather");
    writeState({
      ...state,
      weatherSnapshots: [...state.weatherSnapshots, { id, payload: weather }]
    });
    return id;
  }

  async getLatestWeatherSnapshot(): Promise<NormalizedWeather | null> {
    return (
      [...readState().weatherSnapshots]
        .sort((a, b) => b.payload.capturedAt.localeCompare(a.payload.capturedAt))[0]
        ?.payload ?? null
    );
  }

  async saveRecommendationSet(recommendationSet: RecommendationSet) {
    const state = readState();
    writeState({
      ...state,
      recommendations: [
        ...state.recommendations.filter((item) => item.id !== recommendationSet.id),
        recommendationSet
      ]
    });
  }

  async getRecommendationSetByReadingId(readingId: string): Promise<RecommendationSet | null> {
    return (
      readState().recommendations.find((recommendation) => recommendation.readingId === readingId) ??
      null
    );
  }

  async getLatestRecommendationSet(): Promise<RecommendationSet | null> {
    return (
      [...readState().recommendations].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ??
      null
    );
  }

  async saveTasks(tasks: ScheduleTask[]) {
    const state = readState();
    const existing = new Map(state.tasks.map((task) => [task.id, task] as const));
    for (const task of tasks) {
      existing.set(task.id, task);
    }
    writeState({
      ...state,
      tasks: Array.from(existing.values())
    });
  }

  async getTasks(limit = 30): Promise<ScheduleTask[]> {
    return [...readState().tasks]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, limit);
  }

  async updateTaskStatus(taskId: string, status: ScheduleTask["status"]) {
    const state = readState();
    writeState({
      ...state,
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
    });
  }

  async saveAiAskEntry(input: {
    payload: AiAskPayload;
    response: AiAskStructuredResponse;
  }) {
    const state = readState();
    const id = makeId("ask");
    writeState({
      ...state,
      aiAsks: [
        ...state.aiAsks,
        {
          id,
          createdAt: new Date().toISOString(),
          question: input.payload.question,
          payload: input.payload,
          response: input.response
        }
      ]
    });
  }

  async getAiAskHistory(limit = 20): Promise<AiAskHistoryItem[]> {
    return [...readState().aiAsks]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        question: item.question,
        imageDataUrl: item.payload.imageDataUrl,
        response: item.response
      }));
  }

  async createDiagnosticCase(caseItem: DiagnosticCase) {
    await this.saveDiagnosticCase(caseItem);
  }

  async saveDiagnosticCase(caseItem: DiagnosticCase) {
    const state = readState();
    writeState({
      ...state,
      diagnosticCases: [
        ...state.diagnosticCases.filter((existing) => existing.id !== caseItem.id),
        caseItem
      ]
    });
  }

  async listDiagnosticCases(limit = 20): Promise<DiagnosticCase[]> {
    return [...readState().diagnosticCases]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async getDiagnosticCase(caseId: string): Promise<DiagnosticCase | null> {
    return readState().diagnosticCases.find((caseItem) => caseItem.id === caseId) ?? null;
  }

  async saveDiagnosticMessage(message: DiagnosticMessage) {
    const state = readState();
    writeState({
      ...state,
      diagnosticMessages: [
        ...state.diagnosticMessages.filter((existing) => existing.id !== message.id),
        message
      ]
    });
  }

  async getDiagnosticMessages(caseId: string): Promise<DiagnosticMessage[]> {
    return [...readState().diagnosticMessages]
      .filter((message) => message.caseId === caseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveDiagnosticSnapshot(snapshot: DiagnosticCaseState) {
    const state = readState();
    writeState({
      ...state,
      diagnosticSnapshots: [
        ...state.diagnosticSnapshots.filter((existing) => existing.caseId !== snapshot.caseId),
        {
          id: makeId("case-snapshot"),
          caseId: snapshot.caseId,
          createdAt: new Date().toISOString(),
          payload: snapshot
        }
      ]
    });
  }

  async getLatestDiagnosticSnapshot(caseId: string): Promise<DiagnosticCaseState | null> {
    return (
      [...readState().diagnosticSnapshots]
        .filter((snapshot) => snapshot.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.payload ?? null
    );
  }

  async saveCareEvent(event: CareEvent) {
    const state = readState();
    writeState({
      ...state,
      careEvents: [...state.careEvents.filter((existing) => existing.id !== event.id), event]
    });
  }

  async getCareEvents(input?: {
    caseId?: string;
    zoneId?: string;
    limit?: number;
  }): Promise<CareEvent[]> {
    const filtered = readState().careEvents.filter((event) => {
      if (input?.caseId && event.caseId !== input.caseId) {
        return false;
      }

      if (input?.zoneId && event.zoneId !== input.zoneId) {
        return false;
      }

      return true;
    });

    return [...filtered]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, input?.limit ?? 20);
  }

  async setCaseReminder(reminder: CaseReminder) {
    const state = readState();
    writeState({
      ...state,
      caseReminders: [
        ...state.caseReminders.filter((existing) => existing.id !== reminder.id),
        reminder
      ]
    });
  }

  async getCaseReminders(caseId?: string): Promise<CaseReminder[]> {
    const reminders = caseId
      ? readState().caseReminders.filter((reminder) => reminder.caseId === caseId)
      : readState().caseReminders;

    return [...reminders].sort((a, b) => b.remindAt.localeCompare(a.remindAt));
  }

  async archiveDiagnosticCase(caseId: string) {
    const state = readState();
    writeState({
      ...state,
      diagnosticCases: state.diagnosticCases.map((caseItem) =>
        caseItem.id === caseId
          ? {
              ...caseItem,
              archived: true,
              status: "closed",
              updatedAt: new Date().toISOString()
            }
          : caseItem
      )
    });
  }

  async saveProductTap(productId: string) {
    const state = readState();
    writeState({
      ...state,
      productTaps: [
        ...state.productTaps,
        {
          id: makeId("tap"),
          productId,
          tappedAt: new Date().toISOString()
        }
      ]
    });
  }

  async getSettingsSnapshot(): Promise<{
    onboardingComplete: boolean;
    remindersEnabled: boolean;
    metricSystem: MetricSystem;
    location: StoredLocation | null;
  }> {
    return readState().settings;
  }

  async exportAllData() {
    return readState();
  }

  async clearAllData() {
    writeState(defaultState());
  }

  async clearActivityData() {
    const state = readState();
    writeState({
      ...state,
      readings: [],
      weatherSnapshots: [],
      recommendations: [],
      tasks: [],
      aiAsks: [],
      diagnosticCases: [],
      diagnosticMessages: [],
      diagnosticSnapshots: [],
      careEvents: [],
      caseReminders: [],
      productTaps: []
    });
  }
}

export const localRepository = new LocalRepositoryWeb();
