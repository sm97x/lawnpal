import type { SensorReading } from "../types";
import { makeId } from "../utils/id";
import type { SensorProvider, TakeReadingInput } from "./provider";
import { buildScenarioMetrics } from "./scenarios";

export class MockSensorProvider implements SensorProvider {
  readonly kind = "mock" as const;
  private connectedDeviceId: string | null = null;

  async scanDevices() {
    return [
      {
        id: "mock-sensor-1",
        name: "LawnPal Demo Sensor",
        signalStrength: 92,
        provider: "mock" as const
      }
    ];
  }

  async connect(deviceId: string) {
    this.connectedDeviceId = deviceId;
  }

  async disconnect() {
    this.connectedDeviceId = null;
  }

  async takeReading(input: TakeReadingInput): Promise<SensorReading> {
    if (!this.connectedDeviceId) {
      throw new Error("Mock sensor is not connected.");
    }

    const scenarioKey = input.scenarioKey ?? "random-realistic";
    return {
      id: makeId("reading"),
      zoneId: input.zoneId,
      provider: "mock",
      scenarioKey,
      takenAt: new Date().toISOString(),
      metrics: buildScenarioMetrics(scenarioKey)
    };
  }
}
