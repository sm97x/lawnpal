import type { SensorReading } from "@lawnpal/core";
import type { SensorDevice, SensorProvider, TakeReadingInput } from "@lawnpal/core";

const BLE_UNAVAILABLE_MESSAGE =
  "BLE sensor mode requires a native iOS or Android development build. Expo Go and web do not support this LawnPal BLE integration.";

export class BleSensorProvider implements SensorProvider {
  readonly kind = "ble" as const;

  async scanDevices(): Promise<SensorDevice[]> {
    throw new Error(BLE_UNAVAILABLE_MESSAGE);
  }

  async connect(_deviceId: string): Promise<void> {
    throw new Error(BLE_UNAVAILABLE_MESSAGE);
  }

  async disconnect(): Promise<void> {
    return;
  }

  async takeReading(_input: TakeReadingInput): Promise<SensorReading> {
    throw new Error(BLE_UNAVAILABLE_MESSAGE);
  }
}
