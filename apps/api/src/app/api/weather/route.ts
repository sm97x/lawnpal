import { z } from "zod";
import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { OpenWeatherProvider } from "@/lib/openWeatherProvider";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  label: z.string().default("Current location")
});

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      lat: url.searchParams.get("lat"),
      lon: url.searchParams.get("lon"),
      label: url.searchParams.get("label") ?? "Current location"
    });

    const provider = new OpenWeatherProvider();
    const forecast = await provider.getForecast(query);
    return withCors(NextResponse.json(forecast));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch weather.";
    return withCors(NextResponse.json({ error: message }, { status: 400 }));
  }
}
