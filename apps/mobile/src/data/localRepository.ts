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
import * as SQLite from "expo-sqlite";
import { migrateLegacyAiAskEntry } from "./diagnosticMigration";
import type { AiAskHistoryItem, StoredLocation } from "../types";

type JsonRow = {
  payload: string;
};

type SettingRow = {
  value: string;
};

class LocalRepository {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private dbPromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

  private getDb() {
    if (!this.dbPromise) {
      this.dbPromise = SQLite.openDatabaseAsync("lawnpal.db");
    }

    return this.dbPromise;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInit();
    await this.initPromise;
  }

  private async performInit() {
    const db = await this.getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS lawns (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY NOT NULL,
        lawn_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY NOT NULL,
        zone_id TEXT NOT NULL,
        taken_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_readings_zone_taken_at ON readings(zone_id, taken_at DESC);
      CREATE TABLE IF NOT EXISTS weather_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        captured_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY NOT NULL,
        reading_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        reading_id TEXT NOT NULL,
        status TEXT NOT NULL,
        start_date TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date ASC);
      CREATE TABLE IF NOT EXISTS ai_asks (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        question TEXT NOT NULL,
        payload TEXT NOT NULL,
        response TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS diagnostic_cases (
        id TEXT PRIMARY KEY NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS diagnostic_messages (
        id TEXT PRIMARY KEY NOT NULL,
        case_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        role TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_diagnostic_messages_case_id ON diagnostic_messages(case_id, created_at ASC);
      CREATE TABLE IF NOT EXISTS diagnostic_case_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        case_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_diagnostic_snapshots_case_id ON diagnostic_case_snapshots(case_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS care_events (
        id TEXT PRIMARY KEY NOT NULL,
        case_id TEXT,
        zone_id TEXT,
        created_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS case_reminders (
        id TEXT PRIMARY KEY NOT NULL,
        case_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS product_taps (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL,
        tapped_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    await this.ensureDefaultSetting(db, "onboardingComplete", false);
    await this.ensureDefaultSetting(db, "remindersEnabled", true);
    await this.ensureDefaultSetting(db, "metricSystem", "metric");
    await this.migrateLegacyAiAsks(db);
    this.initialized = true;
  }

  private async migrateLegacyAiAsks(
    db: Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>
  ) {
    const existingCases = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM diagnostic_cases"
    );

    if ((existingCases?.count ?? 0) > 0) {
      return;
    }

    const legacyRows = await db.getAllAsync<{
      id: string;
      created_at: string;
      question: string;
      payload: string;
      response: string;
    }>("SELECT * FROM ai_asks ORDER BY created_at ASC");

    for (const row of legacyRows) {
      const migrated = migrateLegacyAiAskEntry({
        id: row.id,
        createdAt: row.created_at,
        question: row.question,
        payload: JSON.parse(row.payload) as AiAskPayload,
        response: JSON.parse(row.response) as AiAskStructuredResponse
      });

      await db.runAsync(
        "INSERT OR REPLACE INTO diagnostic_cases (id, updated_at, payload) VALUES (?, ?, ?)",
        migrated.caseItem.id,
        migrated.caseItem.updatedAt,
        JSON.stringify(migrated.caseItem)
      );

      for (const message of migrated.messages) {
        await db.runAsync(
          "INSERT OR REPLACE INTO diagnostic_messages (id, case_id, created_at, role, payload) VALUES (?, ?, ?, ?, ?)",
          message.id,
          migrated.caseItem.id,
          message.createdAt,
          message.role,
          JSON.stringify(message)
        );
      }

      await db.runAsync(
        "INSERT OR REPLACE INTO diagnostic_case_snapshots (id, case_id, created_at, payload) VALUES (?, ?, ?, ?)",
        `${migrated.caseItem.id}_snapshot`,
        migrated.caseItem.id,
        migrated.caseItem.updatedAt,
        JSON.stringify(migrated.snapshot)
      );
    }
  }

  private async ensureDefaultSetting<T>(
    db: Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>,
    key: string,
    value: T
  ) {
    const row = await db.getFirstAsync<SettingRow>(
      "SELECT value FROM settings WHERE key = ? LIMIT 1",
      key
    );

    if (!row) {
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        key,
        JSON.stringify(value)
      );
    }
  }

  private parsePayload<T>(row?: JsonRow | null): T | null {
    if (!row) {
      return null;
    }

    return JSON.parse(row.payload) as T;
  }

  async saveSetting<T>(key: string, value: T) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value)
    );
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<SettingRow>(
      "SELECT value FROM settings WHERE key = ? LIMIT 1",
      key
    );

    if (!row) {
      return fallback;
    }

    return JSON.parse(row.value) as T;
  }

  async saveLawn(lawn: Lawn) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO lawns (id, created_at, payload) VALUES (?, ?, ?)",
      lawn.id,
      lawn.createdAt,
      JSON.stringify(lawn)
    );
  }

  async getPrimaryLawn(): Promise<Lawn | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM lawns ORDER BY created_at ASC LIMIT 1"
    );
    return this.parsePayload<Lawn>(row);
  }

  async saveZones(zones: Zone[]) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync("DELETE FROM zones");
    for (const zone of zones) {
      await db.runAsync(
        "INSERT OR REPLACE INTO zones (id, lawn_id, sort_order, created_at, payload) VALUES (?, ?, ?, ?, ?)",
        zone.id,
        zone.lawnId,
        zone.sortOrder,
        zone.createdAt,
        JSON.stringify(zone)
      );
    }
  }

  async getZones(): Promise<Zone[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>("SELECT payload FROM zones ORDER BY sort_order ASC");
    return rows.map((row) => JSON.parse(row.payload) as Zone);
  }

  async getZoneById(zoneId: string): Promise<Zone | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM zones WHERE id = ? LIMIT 1",
      zoneId
    );
    return this.parsePayload<Zone>(row);
  }

  async saveReading(reading: SensorReading) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO readings (id, zone_id, taken_at, payload) VALUES (?, ?, ?, ?)",
      reading.id,
      reading.zoneId,
      reading.takenAt,
      JSON.stringify(reading)
    );
  }

  async updateReadingMedia(
    readingId: string,
    input: {
      photoUri?: string;
      note?: string;
    }
  ) {
    const reading = await this.getReadingById(readingId);
    if (!reading) {
      return;
    }

    await this.saveReading({
      ...reading,
      photoUri: input.photoUri ?? reading.photoUri,
      note: input.note ?? reading.note
    });
  }

  async getReadingById(readingId: string): Promise<SensorReading | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM readings WHERE id = ? LIMIT 1",
      readingId
    );
    return this.parsePayload<SensorReading>(row);
  }

  async getReadingHistory(limit = 50): Promise<SensorReading[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM readings ORDER BY taken_at DESC LIMIT ?",
      limit
    );
    return rows.map((row) => JSON.parse(row.payload) as SensorReading);
  }

  async getZoneReadings(zoneId: string, limit = 20): Promise<SensorReading[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM readings WHERE zone_id = ? ORDER BY taken_at DESC LIMIT ?",
      zoneId,
      limit
    );
    return rows.map((row) => JSON.parse(row.payload) as SensorReading);
  }

  async saveWeatherSnapshot(weather: NormalizedWeather): Promise<string> {
    await this.init();
    const db = await this.getDb();
    const id = makeId("weather");
    await db.runAsync(
      "INSERT INTO weather_snapshots (id, captured_at, payload) VALUES (?, ?, ?)",
      id,
      weather.capturedAt,
      JSON.stringify(weather)
    );
    return id;
  }

  async getLatestWeatherSnapshot(): Promise<NormalizedWeather | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM weather_snapshots ORDER BY captured_at DESC LIMIT 1"
    );
    return this.parsePayload<NormalizedWeather>(row);
  }

  async saveRecommendationSet(recommendationSet: RecommendationSet) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO recommendations (id, reading_id, generated_at, payload) VALUES (?, ?, ?, ?)",
      recommendationSet.id,
      recommendationSet.readingId,
      recommendationSet.generatedAt,
      JSON.stringify(recommendationSet)
    );
  }

  async getRecommendationSetByReadingId(readingId: string): Promise<RecommendationSet | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM recommendations WHERE reading_id = ? LIMIT 1",
      readingId
    );
    return this.parsePayload<RecommendationSet>(row);
  }

  async getLatestRecommendationSet(): Promise<RecommendationSet | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM recommendations ORDER BY generated_at DESC LIMIT 1"
    );
    return this.parsePayload<RecommendationSet>(row);
  }

  async saveTasks(tasks: ScheduleTask[]) {
    await this.init();
    const db = await this.getDb();
    for (const task of tasks) {
      await db.runAsync(
        "INSERT OR REPLACE INTO tasks (id, reading_id, status, start_date, payload) VALUES (?, ?, ?, ?, ?)",
        task.id,
        task.readingId,
        task.status,
        task.startDate,
        JSON.stringify(task)
      );
    }
  }

  async getTasks(limit = 30): Promise<ScheduleTask[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM tasks ORDER BY start_date ASC LIMIT ?",
      limit
    );
    return rows.map((row) => JSON.parse(row.payload) as ScheduleTask);
  }

  async updateTaskStatus(taskId: string, status: ScheduleTask["status"]) {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM tasks WHERE id = ? LIMIT 1",
      taskId
    );
    if (!row) {
      return;
    }

    const task = JSON.parse(row.payload) as ScheduleTask;
    const updated = { ...task, status };
    await db.runAsync(
      "UPDATE tasks SET status = ?, payload = ? WHERE id = ?",
      status,
      JSON.stringify(updated),
      taskId
    );
  }

  async saveAiAskEntry(input: {
    payload: AiAskPayload;
    response: AiAskStructuredResponse;
  }) {
    await this.init();
    const db = await this.getDb();
    const id = makeId("ask");
    const createdAt = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO ai_asks (id, created_at, question, payload, response) VALUES (?, ?, ?, ?, ?)",
      id,
      createdAt,
      input.payload.question,
      JSON.stringify(input.payload),
      JSON.stringify(input.response)
    );
  }

  async getAiAskHistory(limit = 20): Promise<AiAskHistoryItem[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<{
      id: string;
      created_at: string;
      question: string;
      payload: string;
      response: string;
    }>("SELECT * FROM ai_asks ORDER BY created_at DESC LIMIT ?", limit);

    return rows.map((row) => {
      const payload = JSON.parse(row.payload) as AiAskPayload;
      return {
        id: row.id,
        createdAt: row.created_at,
        question: row.question,
        imageDataUrl: payload.imageDataUrl,
        response: JSON.parse(row.response) as AiAskStructuredResponse
      };
    });
  }

  async createDiagnosticCase(caseItem: DiagnosticCase) {
    await this.saveDiagnosticCase(caseItem);
  }

  async saveDiagnosticCase(caseItem: DiagnosticCase) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO diagnostic_cases (id, updated_at, payload) VALUES (?, ?, ?)",
      caseItem.id,
      caseItem.updatedAt,
      JSON.stringify(caseItem)
    );
  }

  async listDiagnosticCases(limit = 20): Promise<DiagnosticCase[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM diagnostic_cases ORDER BY updated_at DESC LIMIT ?",
      limit
    );
    return rows.map((row) => JSON.parse(row.payload) as DiagnosticCase);
  }

  async getDiagnosticCase(caseId: string): Promise<DiagnosticCase | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM diagnostic_cases WHERE id = ? LIMIT 1",
      caseId
    );
    return this.parsePayload<DiagnosticCase>(row);
  }

  async saveDiagnosticMessage(message: DiagnosticMessage) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO diagnostic_messages (id, case_id, created_at, role, payload) VALUES (?, ?, ?, ?, ?)",
      message.id,
      message.caseId,
      message.createdAt,
      message.role,
      JSON.stringify(message)
    );
  }

  async getDiagnosticMessages(caseId: string): Promise<DiagnosticMessage[]> {
    await this.init();
    const db = await this.getDb();
    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM diagnostic_messages WHERE case_id = ? ORDER BY created_at ASC",
      caseId
    );
    return rows.map((row) => JSON.parse(row.payload) as DiagnosticMessage);
  }

  async saveDiagnosticSnapshot(snapshot: DiagnosticCaseState) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT INTO diagnostic_case_snapshots (id, case_id, created_at, payload) VALUES (?, ?, ?, ?)",
      makeId("case-snapshot"),
      snapshot.caseId,
      new Date().toISOString(),
      JSON.stringify(snapshot)
    );
  }

  async getLatestDiagnosticSnapshot(caseId: string): Promise<DiagnosticCaseState | null> {
    await this.init();
    const db = await this.getDb();
    const row = await db.getFirstAsync<JsonRow>(
      "SELECT payload FROM diagnostic_case_snapshots WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
      caseId
    );
    return this.parsePayload<DiagnosticCaseState>(row);
  }

  async saveCareEvent(event: CareEvent) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO care_events (id, case_id, zone_id, created_at, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)",
      event.id,
      event.caseId ?? null,
      event.zoneId ?? null,
      event.createdAt,
      event.type,
      JSON.stringify(event)
    );
  }

  async getCareEvents(input?: {
    caseId?: string;
    zoneId?: string;
    limit?: number;
  }): Promise<CareEvent[]> {
    await this.init();
    const db = await this.getDb();

    if (input?.caseId) {
      const rows = await db.getAllAsync<JsonRow>(
        "SELECT payload FROM care_events WHERE case_id = ? ORDER BY created_at DESC LIMIT ?",
        input.caseId,
        input.limit ?? 20
      );
      return rows.map((row) => JSON.parse(row.payload) as CareEvent);
    }

    if (input?.zoneId) {
      const rows = await db.getAllAsync<JsonRow>(
        "SELECT payload FROM care_events WHERE zone_id = ? ORDER BY created_at DESC LIMIT ?",
        input.zoneId,
        input.limit ?? 20
      );
      return rows.map((row) => JSON.parse(row.payload) as CareEvent);
    }

    const rows = await db.getAllAsync<JsonRow>(
      "SELECT payload FROM care_events ORDER BY created_at DESC LIMIT ?",
      input?.limit ?? 20
    );
    return rows.map((row) => JSON.parse(row.payload) as CareEvent);
  }

  async setCaseReminder(reminder: CaseReminder) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO case_reminders (id, case_id, remind_at, status, payload) VALUES (?, ?, ?, ?, ?)",
      reminder.id,
      reminder.caseId,
      reminder.remindAt,
      reminder.status,
      JSON.stringify(reminder)
    );
  }

  async getCaseReminders(caseId?: string): Promise<CaseReminder[]> {
    await this.init();
    const db = await this.getDb();
    const rows = caseId
      ? await db.getAllAsync<JsonRow>(
          "SELECT payload FROM case_reminders WHERE case_id = ? ORDER BY remind_at DESC",
          caseId
        )
      : await db.getAllAsync<JsonRow>(
          "SELECT payload FROM case_reminders ORDER BY remind_at DESC"
        );

    return rows.map((row) => JSON.parse(row.payload) as CaseReminder);
  }

  async archiveDiagnosticCase(caseId: string) {
    const caseItem = await this.getDiagnosticCase(caseId);
    if (!caseItem) {
      return;
    }

    await this.saveDiagnosticCase({
      ...caseItem,
      archived: true,
      status: "closed",
      updatedAt: new Date().toISOString()
    });
  }

  async saveProductTap(productId: string) {
    await this.init();
    const db = await this.getDb();
    await db.runAsync(
      "INSERT INTO product_taps (id, product_id, tapped_at) VALUES (?, ?, ?)",
      makeId("tap"),
      productId,
      new Date().toISOString()
    );
  }

  async getSettingsSnapshot(): Promise<{
    onboardingComplete: boolean;
    remindersEnabled: boolean;
    metricSystem: MetricSystem;
    location: StoredLocation | null;
  }> {
    return {
      onboardingComplete: await this.getSetting("onboardingComplete", false),
      remindersEnabled: await this.getSetting("remindersEnabled", true),
      metricSystem: await this.getSetting("metricSystem", "metric"),
      location: await this.getSetting<StoredLocation | null>("location", null)
    };
  }

  async exportAllData() {
    await this.init();
    const db = await this.getDb();
    const [
      lawns,
      zones,
      readings,
      weatherSnapshots,
      recommendations,
      tasks,
      aiAsks,
      diagnosticCases,
      diagnosticMessages,
      diagnosticSnapshots,
      careEvents,
      caseReminders,
      productTaps
    ] =
      await Promise.all([
        db.getAllAsync<JsonRow>("SELECT payload FROM lawns"),
        db.getAllAsync<JsonRow>("SELECT payload FROM zones"),
        db.getAllAsync<JsonRow>("SELECT payload FROM readings"),
        db.getAllAsync<JsonRow>("SELECT payload FROM weather_snapshots"),
        db.getAllAsync<JsonRow>("SELECT payload FROM recommendations"),
        db.getAllAsync<JsonRow>("SELECT payload FROM tasks"),
        db.getAllAsync("SELECT id, created_at, question, payload, response FROM ai_asks"),
        db.getAllAsync<JsonRow>("SELECT payload FROM diagnostic_cases"),
        db.getAllAsync<JsonRow>("SELECT payload FROM diagnostic_messages"),
        db.getAllAsync<JsonRow>("SELECT payload FROM diagnostic_case_snapshots"),
        db.getAllAsync<JsonRow>("SELECT payload FROM care_events"),
        db.getAllAsync<JsonRow>("SELECT payload FROM case_reminders"),
        db.getAllAsync("SELECT * FROM product_taps")
      ]);

    return {
      lawns: lawns.map((row) => JSON.parse(row.payload)),
      zones: zones.map((row) => JSON.parse(row.payload)),
      readings: readings.map((row) => JSON.parse(row.payload)),
      weatherSnapshots: weatherSnapshots.map((row) => JSON.parse(row.payload)),
      recommendations: recommendations.map((row) => JSON.parse(row.payload)),
      tasks: tasks.map((row) => JSON.parse(row.payload)),
      aiAsks,
      diagnosticCases: diagnosticCases.map((row) => JSON.parse(row.payload)),
      diagnosticMessages: diagnosticMessages.map((row) => JSON.parse(row.payload)),
      diagnosticSnapshots: diagnosticSnapshots.map((row) => JSON.parse(row.payload)),
      careEvents: careEvents.map((row) => JSON.parse(row.payload)),
      caseReminders: caseReminders.map((row) => JSON.parse(row.payload)),
      productTaps,
      settings: await this.getSettingsSnapshot()
    };
  }

  async clearAllData() {
    await this.init();
    const db = await this.getDb();
    await db.execAsync(`
      DELETE FROM lawns;
      DELETE FROM zones;
      DELETE FROM readings;
      DELETE FROM weather_snapshots;
      DELETE FROM recommendations;
      DELETE FROM tasks;
      DELETE FROM ai_asks;
      DELETE FROM diagnostic_cases;
      DELETE FROM diagnostic_messages;
      DELETE FROM diagnostic_case_snapshots;
      DELETE FROM care_events;
      DELETE FROM case_reminders;
      DELETE FROM product_taps;
      DELETE FROM settings;
    `);
    this.initialized = false;
    this.initPromise = null;
    await this.init();
  }

  async clearActivityData() {
    await this.init();
    const db = await this.getDb();
    await db.execAsync(`
      DELETE FROM readings;
      DELETE FROM weather_snapshots;
      DELETE FROM recommendations;
      DELETE FROM tasks;
      DELETE FROM ai_asks;
      DELETE FROM diagnostic_cases;
      DELETE FROM diagnostic_messages;
      DELETE FROM diagnostic_case_snapshots;
      DELETE FROM care_events;
      DELETE FROM case_reminders;
      DELETE FROM product_taps;
    `);
  }
}

export const localRepository = new LocalRepository();
