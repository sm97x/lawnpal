import type { SensorReading } from "../types";

export type SensorScenarioKey =
  | "healthy-lawn"
  | "too-wet"
  | "too-dry"
  | "moss-risk"
  | "seed-ready"
  | "feed-caution"
  | "random-realistic";

export type SensorDevice = {
  id: string;
  name: string;
  signalStrength: number;
  provider: "mock" | "ble";
};

export type TakeReadingInput = {
  zoneId: string;
  scenarioKey?: SensorScenarioKey;
};

export interface SensorProvider {
  readonly kind: "mock" | "ble";
  scanDevices(): Promise<SensorDevice[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  takeReading(input: TakeReadingInput): Promise<SensorReading>;
}
