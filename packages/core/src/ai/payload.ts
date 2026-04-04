import type { AiAskPayload } from "../types";

const safeMetric = (label: string, value: number | undefined, unit = ""): string =>
  value === undefined ? `${label}: unavailable` : `${label}: ${value}${unit}`;

export const buildAiAskContextText = (payload: AiAskPayload): string => {
  const lines: string[] = [
    "You are Lawn Pal, a cautious British lawn care assistant.",
    "Give advisory guidance only. Do not present advice as guaranteed or definitive.",
    `User question: ${payload.question}`
  ];

  if (payload.zone) {
    lines.push(`Zone: ${payload.zone.name} (${payload.zone.exposure})`);
  }

  if (payload.latestReading) {
    const metrics = payload.latestReading.metrics;
    lines.push("Latest reading:");
    lines.push(`- ${safeMetric("Moisture", metrics.moisture, "%")}`);
    lines.push(`- ${safeMetric("Soil temperature", metrics.soilTemperatureC, "C")}`);
    lines.push(`- ${safeMetric("EC", metrics.ec)}`);
    lines.push(`- ${safeMetric("pH", metrics.ph)}`);
    lines.push(`- ${safeMetric("Light", metrics.lightLux, " lux")}`);
    lines.push(`- ${safeMetric("Humidity", metrics.humidity, "%")}`);
  }

  if (payload.weather) {
    lines.push("Recent weather:");
    lines.push(
      `- Current: ${payload.weather.current.summary}, ${payload.weather.current.temperatureC}C, rain chance ${payload.weather.current.rainProbability}%`
    );
    lines.push(
      `- Next 3 days: ${payload.weather.daily
        .slice(0, 3)
        .map(
          (day) =>
            `${day.date} ${day.summary}, ${day.minTempC}-${day.maxTempC}C, rain ${day.rainProbability}%`
        )
        .join(" | ")}`
    );
  }

  if (payload.recentRecommendations?.length) {
    lines.push("Current recommendation context:");
    for (const recommendation of payload.recentRecommendations.slice(0, 4)) {
      lines.push(`- ${recommendation.title}: ${recommendation.explanation}`);
    }
  }

  lines.push(
    "Respond with concise practical advice for a homeowner. Prefer the safest useful next step and say when uncertainty is high."
  );

  return lines.join("\n");
};

export const buildAiAskOpenAIRequest = (payload: AiAskPayload) => {
  const text = buildAiAskContextText(payload);
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [{ type: "input_text", text }];

  if (payload.imageDataUrl) {
    content.push({ type: "input_image", image_url: payload.imageDataUrl, detail: "auto" });
  }

  return {
    instructions:
      "You are Lawn Pal, a calm UK lawn care companion. Offer practical homeowner guidance, not scientific certainty. Mention uncertainty when the evidence is mixed.",
    input: [
      {
        role: "user" as const,
        content
      }
    ]
  };
};
