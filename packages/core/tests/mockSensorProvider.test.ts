import { describe, expect, it } from "vitest";
import { MockSensorProvider } from "../src";

describe("mock sensor provider", () => {
  it("returns realistic readings for a chosen scenario", async () => {
    const provider = new MockSensorProvider();
    const devices = await provider.scanDevices();
    await provider.connect(devices[0]!.id);
    const reading = await provider.takeReading({
      zoneId: "zone_1",
      scenarioKey: "moss-risk"
    });

    expect(reading.metrics.moisture).toBeGreaterThanOrEqual(72);
    expect(reading.metrics.soilTemperatureC).toBeLessThanOrEqual(11);
    expect(reading.provider).toBe("mock");
  });
});
