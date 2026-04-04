const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  useMockSensor: parseBool(process.env.EXPO_PUBLIC_USE_MOCK_SENSOR, true),
  useMockAi: parseBool(process.env.EXPO_PUBLIC_USE_MOCK_AI, false),
  useMockWeather: parseBool(process.env.EXPO_PUBLIC_USE_MOCK_WEATHER, false)
};

