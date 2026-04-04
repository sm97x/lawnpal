import {
  buildComposerPrompt,
  buildDiagnosticContextSnapshot,
  buildObservationPrompt,
  diagnosticComposerDraftSchema,
  diagnosticImageObservationSchema,
  diagnosticTurnRequestSchema,
  runDiagnosticTurn,
  type DiagnosticComposerDraft,
  type DiagnosticImageObservation,
  type DiagnosticTurnRequest
} from "@lawnpal/core";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { buildFallbackDiagnosticResponse, buildFallbackObservation, mergeComposerDraft } from "@/lib/diagnosticFallback";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

const getClient = () => new OpenAI({ apiKey: env.OPENAI_API_KEY });

const extractObservation = async (
  client: OpenAI,
  request: DiagnosticTurnRequest
): Promise<DiagnosticImageObservation> => {
  if (!request.images?.length) {
    return buildFallbackObservation(request);
  }

  const prompt = buildObservationPrompt({
    request,
    currentState: request.historyContext?.currentCaseState,
    snapshot: buildDiagnosticContextSnapshot({
      request,
      currentState: request.historyContext?.currentCaseState
    })
  });

  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    instructions: prompt.instructions,
    input: prompt.input,
    text: {
      format: zodTextFormat(diagnosticImageObservationSchema, "lawnpal_image_observation")
    }
  });

  return diagnosticImageObservationSchema.parse(response.output_parsed);
};

const composeDraft = async (
  client: OpenAI,
  request: DiagnosticTurnRequest,
  deterministicResponse: ReturnType<typeof runDiagnosticTurn>,
  observation: DiagnosticImageObservation
): Promise<DiagnosticComposerDraft> => {
  const prompt = buildComposerPrompt({
    request,
    state: deterministicResponse.updatedState,
    topHypotheses: deterministicResponse.updatedState.topHypotheses,
    snapshot: buildDiagnosticContextSnapshot({
      request,
      currentState: request.historyContext?.currentCaseState,
      imageObservation: observation
    })
  });

  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    instructions: prompt.instructions,
    input: prompt.input,
    text: {
      format: zodTextFormat(diagnosticComposerDraftSchema, "lawnpal_composer_draft")
    }
  });

  return diagnosticComposerDraftSchema.parse(response.output_parsed);
};

export async function POST(request: Request) {
  let payload: DiagnosticTurnRequest | undefined;

  try {
    payload = diagnosticTurnRequestSchema.parse(await request.json()) as DiagnosticTurnRequest;

    if (!env.OPENAI_API_KEY) {
      return withCors(NextResponse.json(buildFallbackDiagnosticResponse(payload)));
    }

    const client = getClient();
    let observation: DiagnosticImageObservation;

    try {
      observation = await extractObservation(client, payload);
    } catch {
      observation = buildFallbackObservation(payload);
    }

    const deterministicResponse = runDiagnosticTurn({
      request: payload,
      imageObservation: observation
    });

    try {
      const draft = await composeDraft(client, payload, deterministicResponse, observation);
      return withCors(NextResponse.json(mergeComposerDraft(deterministicResponse, draft)));
    } catch {
      return withCors(NextResponse.json(deterministicResponse));
    }
  } catch (error) {
    if (payload) {
      return withCors(NextResponse.json(buildFallbackDiagnosticResponse(payload)));
    }

    const message = error instanceof Error ? error.message : "Unable to generate AI answer.";
    return withCors(NextResponse.json({ error: message }, { status: 400 }));
  }
}
