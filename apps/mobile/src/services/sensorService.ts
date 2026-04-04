import { BleSensorProvider, MockSensorProvider, type SensorProvider } from "@lawnpal/core";
import { env } from "../env";

let provider: SensorProvider | null = null;

export const getSensorProvider = (): SensorProvider => {
  if (!provider) {
    provider = env.useMockSensor ? new MockSensorProvider() : new BleSensorProvider();
  }

  return provider;
};
