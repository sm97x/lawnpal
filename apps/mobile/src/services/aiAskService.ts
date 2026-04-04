import type { DiagnosticTurnRequest, DiagnosticTurnResponse } from "@lawnpal/core";
import { env } from "../env";

export const aiAskService = {
  async ask(payload: DiagnosticTurnRequest): Promise<DiagnosticTurnResponse> {
    const response = await fetch(`${env.apiBaseUrl}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => null as { error?: string } | null);
      throw new Error(errorPayload?.error ?? "Unable to reach AI Ask right now.");
    }

    return (await response.json()) as DiagnosticTurnResponse;
  }
};
