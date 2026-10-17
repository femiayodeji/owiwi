import { AppError } from '../lib/errors';
import { RETRY_NUDGE } from './prompt';
import { CardsResponseSchema } from './schema';
import type { CardDraft, LLMProvider } from './types';

/** Pulls the outermost JSON object out of a model reply (fences, stray prose). Throws on failure. */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json|JSON)?/g, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found');
  return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
}

const stripSlash = (url: string) => url.replace(/\/+$/, '');

export type ParseResult =
  | { ok: true; cards: CardDraft[]; dropped: number }
  | { ok: false; error: string };

/**
 * Validates a model reply. Drops cards whose url isn't in the input set
 * (`dropped` counts those), dedupes by url and caps at `max`.
 */
export function parseCards(text: string, allowedUrls: ReadonlySet<string>, max: number): ParseResult {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const parsed = CardsResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'schema_mismatch' };

  // normalized url -> the exact input url, so stored cards always use the article's url
  const allowed = new Map<string, string>();
  for (const u of allowedUrls) allowed.set(stripSlash(u.trim()), u);

  const seen = new Set<string>();
  const cards: CardDraft[] = [];
  let dropped = 0;
  for (const c of parsed.data.cards) {
    const key = stripSlash(c.url);
    const url = allowedUrls.has(c.url) ? c.url : allowed.get(key);
    if (url === undefined) {
      dropped++;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    if (cards.length >= max) continue;
    cards.push({
      title: c.title,
      summary: c.summary,
      topic: c.topic,
      source: c.source,
      url,
      publishedAt: c.published_at,
    });
  }
  return { ok: true, cards, dropped };
}

export interface GenerateCardsArgs {
  system: string;
  user: string;
  allowedUrls: ReadonlySet<string>;
  max: number;
  signal?: AbortSignal;
}

/**
 * One completion, validated. On unreadable output retries once with a JSON nudge;
 * still failing throws AppError('invalid_output'). Provider (HTTP) errors are rethrown as-is.
 */
export async function generateCards(
  provider: LLMProvider,
  { system, user, allowedUrls, max, signal }: GenerateCardsArgs,
): Promise<{ cards: CardDraft[]; dropped: number }> {
  const first = parseCards(await provider.complete({ system, user, signal }), allowedUrls, max);
  if (first.ok) return { cards: first.cards, dropped: first.dropped };

  const retryUser = `${user}\n\n${RETRY_NUDGE}`;
  const second = parseCards(await provider.complete({ system, user: retryUser, signal }), allowedUrls, max);
  if (second.ok) return { cards: second.cards, dropped: second.dropped };
  throw new AppError('invalid_output');
}
