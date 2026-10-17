import { z } from 'zod';

export const TITLE_MAX = 90;

// Optional text: trimmed, empty/missing becomes null.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  });

export const CardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .transform((t) => (t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1).trimEnd()}…` : t)),
  summary: z.string().trim().min(1),
  topic: optionalText,
  source: optionalText,
  url: z.string().trim().min(1),
  published_at: optionalText,
});

export const CardsResponseSchema = z.object({ cards: z.array(CardSchema) });

export type CardsResponse = z.infer<typeof CardsResponseSchema>;
