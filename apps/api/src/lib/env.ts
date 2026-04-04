import { z } from "zod";

const envSchema = z.object({
  OPENWEATHER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini")
});

export const env = envSchema.parse({
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL
});
