import type { SensorReading } from "../types";
import type { SensorProvider, TakeReadingInput } from "./provider";

export class BleSensorProvider implements SensorProvider {
  readonly kind = "ble" as const;

  async scanDevices() {
    return [];
  }

  async connect(_deviceId: string) {
    throw new Error("BLE integration is not available in this MVP.");
  }

  async disconnect() {
    return;
  }

  async takeReading(_input: TakeReadingInput): Promise<SensorReading> {
    throw new Error("BLE integration is not available in this MVP.");
  }
}
