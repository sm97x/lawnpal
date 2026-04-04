import type { AiAskPayload, AiAskStructuredResponse } from "@lawnpal/core";

export const buildMockAiAnswer = (
  payload: AiAskPayload,
  reason = "live AI is unavailable in this environment"
): AiAskStructuredResponse => ({
  answer:
    payload.question.toLowerCase().includes("patch")
      ? "Patchiness is often a symptom rather than the root issue. The safest reading from the latest context is that this zone needs steadier conditions before any extra treatment."
      : "The latest context suggests a cautious week: follow the current plan, avoid doubling up treatments, and re-check after the next forecast change.",
  confidenceNote: `Low to moderate confidence. This is a development fallback because ${reason}.`,
  suggestedActions: [
    "Stick to the current weekly recommendation rather than adding another product today.",
    "Take another reading after the next rain or dry spell.",
    "Attach a close-up photo if you want a more visual answer."
  ],
  disclaimer: "Advisory only. Lawn conditions can vary by zone and over short periods."
});
