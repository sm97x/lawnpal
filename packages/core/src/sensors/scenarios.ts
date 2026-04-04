import type { SensorMetrics } from "../types";
import type { SensorScenarioKey } from "./provider";

type Range = { min: number; max: number };

type ScenarioDefinition = {
  key: SensorScenarioKey;
  name: string;
  metrics: {
    moisture: Range;
    soilTemperatureC: Range;
    ec: Range;
    ph: Range;
    lightLux: Range;
    humidity: Range;
  };
};

const randomBetween = (range: Range): number =>
  Number((Math.random() * (range.max - range.min) + range.min).toFixed(1));

export const sensorScenarioDefinitions: ScenarioDefinition[] = [
  {
    key: "healthy-lawn",
    name: "Healthy lawn",
    metrics: {
      moisture: { min: 48, max: 60 },
      soilTemperatureC: { min: 12, max: 18 },
      ec: { min: 1.2, max: 1.8 },
      ph: { min: 6.3, max: 6.8 },
      lightLux: { min: 12000, max: 24000 },
      humidity: { min: 55, max: 70 }
    }
  },
  {
    key: "too-wet",
    name: "Too wet",
    metrics: {
      moisture: { min: 78, max: 92 },
      soilTemperatureC: { min: 8, max: 14 },
      ec: { min: 1.6, max: 2.4 },
      ph: { min: 5.8, max: 6.4 },
      lightLux: { min: 3000, max: 9000 },
      humidity: { min: 75, max: 90 }
    }
  },
  {
    key: "too-dry",
    name: "Too dry",
    metrics: {
      moisture: { min: 18, max: 30 },
      soilTemperatureC: { min: 12, max: 22 },
      ec: { min: 0.9, max: 1.6 },
      ph: { min: 6.1, max: 6.8 },
      lightLux: { min: 10000, max: 28000 },
      humidity: { min: 35, max: 55 }
    }
  },
  {
    key: "moss-risk",
    name: "Moss risk",
    metrics: {
      moisture: { min: 72, max: 86 },
      soilTemperatureC: { min: 6, max: 11 },
      ec: { min: 1.0, max: 1.5 },
      ph: { min: 5.4, max: 6.0 },
      lightLux: { min: 2000, max: 6500 },
      humidity: { min: 80, max: 95 }
    }
  },
  {
    key: "seed-ready",
    name: "Seed ready",
    metrics: {
      moisture: { min: 42, max: 58 },
      soilTemperatureC: { min: 10, max: 14 },
      ec: { min: 1.1, max: 1.6 },
      ph: { min: 6.0, max: 6.7 },
      lightLux: { min: 8000, max: 18000 },
      humidity: { min: 55, max: 70 }
    }
  },
  {
    key: "feed-caution",
    name: "Feed caution",
    metrics: {
      moisture: { min: 65, max: 80 },
      soilTemperatureC: { min: 11, max: 18 },
      ec: { min: 2.3, max: 3.2 },
      ph: { min: 6.1, max: 6.8 },
      lightLux: { min: 9000, max: 16000 },
      humidity: { min: 65, max: 85 }
    }
  }
];

export const listSensorScenarios = (): Array<{ key: SensorScenarioKey; name: string }> => [
  ...sensorScenarioDefinitions.map(({ key, name }) => ({ key, name })),
  { key: "random-realistic", name: "Random realistic" }
];

export const buildScenarioMetrics = (scenarioKey: SensorScenarioKey): SensorMetrics => {
  const scenario =
    scenarioKey === "random-realistic"
      ? sensorScenarioDefinitions[Math.floor(Math.random() * sensorScenarioDefinitions.length)]
      : sensorScenarioDefinitions.find((item) => item.key === scenarioKey);

  if (!scenario) {
    return {
      moisture: 52,
      soilTemperatureC: 13.6,
      ec: 1.4,
      ph: 6.4,
      lightLux: 12000,
      humidity: 62
    };
  }

  return {
    moisture: randomBetween(scenario.metrics.moisture),
    soilTemperatureC: randomBetween(scenario.metrics.soilTemperatureC),
    ec: randomBetween(scenario.metrics.ec),
    ph: randomBetween(scenario.metrics.ph),
    lightLux: Math.round(randomBetween(scenario.metrics.lightLux)),
    humidity: randomBetween(scenario.metrics.humidity)
  };
};
