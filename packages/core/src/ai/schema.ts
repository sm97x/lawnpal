import { z } from "zod";

export const aiAskResponseSchema = z.object({
  answer: z.string().min(1),
  confidenceNote: z.string().min(1),
  suggestedActions: z.array(z.string().min(1)).min(1).max(4),
  disclaimer: z.string().min(1)
});

export type AiAskResponseSchema = z.infer<typeof aiAskResponseSchema>;
