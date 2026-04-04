import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
} as const;

export const withCors = (response: NextResponse): NextResponse => {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
};

export const corsPreflight = (): NextResponse =>
  withCors(new NextResponse(null, { status: 204 }));
