import { z } from "zod";
import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { OpenWeatherProvider } from "@/lib/openWeatherProvider";

export const runtime = "nodejs";

const querySchema = z.object({
  postcode: z.string().min(3)
});

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      postcode: url.searchParams.get("postcode")
    });

    const provider = new OpenWeatherProvider();
    const result = await provider.geocode(query.postcode);
    return withCors(NextResponse.json(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to geocode postcode.";
    return withCors(NextResponse.json({ error: message }, { status: 400 }));
  }
}
