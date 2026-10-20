import type { Db } from '../db/client';
import {
  beginDigest,
  completeDigest,
  deleteDigest,
  getActiveProvider,
  getCardTitles,
  getCards,
  getDigest,
  listKeywords,
  setDigestStatus,
} from '../db/queries';
import { loadSettings, parseLocale } from '../db/settings';
import { AppError, toAppError } from '../lib/errors';
import { getApiKey } from '../lib/secureStore';
import type { Slot } from '../llm/types';
import { buildSystemPrompt, buildUserPrompt, createProvider, generateCards } from '../llm';
import { collectArticles, getNewsSource } from '../news';
import { statusAfterFailure } from './cleared';
import { decideGeneration } from './guard';
import { wipeStale } from './retention';

export type GenerationStep = 'fetching' | 'writing' | 'saving';

export const STEP_LABEL: Record<GenerationStep, string> = {
  fetching: 'Fetching headlines',
  writing: 'Writing your gist',
  saving: 'Saving your digest',
};

export type GenerateResult =
  | { kind: 'ready'; digestId: string; failedKeywords: string[] }
  | { kind: 'empty'; failedKeywords: string[] }
  | { kind: 'busy' };

export interface GenerateOptions {
  date: string;
  slot: Slot;
  /** User-confirmed regenerate: overwrite an existing ready digest. */
  force?: boolean;
  onStep?: (step: GenerationStep) => void;
  signal?: AbortSignal;
}

// In-process lock on top of the DB 'generating' status.
const inFlight = new Set<string>();

export function isGenerating(date: string, slot: Slot): boolean {
  return inFlight.has(`${date}:${slot}`);
}

/**
 * Builds the digest for (date, slot): wipe, guard, fetch RSS, one LLM call,
 * validate, persist in one transaction. Throws AppError with a friendly message.
 */
export async function generateDigest(db: Db, opts: GenerateOptions): Promise<GenerateResult> {
  const lockKey = `${opts.date}:${opts.slot}`;
  if (inFlight.has(lockKey)) return { kind: 'busy' };
  inFlight.add(lockKey);
  try {
    return await run(db, opts);
  } finally {
    inFlight.delete(lockKey);
  }
}

async function run(db: Db, { date, slot, force = false, onStep, signal }: GenerateOptions): Promise<GenerateResult> {
  await wipeStale(db, date);

  const existing = await getDigest(db, date, slot);
  const decision = decideGeneration(existing, Date.now(), force);
  // A fresh 'generating' row is 'busy' to the DB guard, but only this process
  // generates and generateDigest() holds the lock, so the row is an
  // orphan from a killed app and safe to restart.
  if (decision === 'use-cached' && existing) return { kind: 'ready', digestId: existing.id, failedKeywords: [] };

  // Check prerequisites before touching the digest row.
  const provider = await getActiveProvider(db);
  if (!provider) throw new AppError('no_provider');
  const apiKey = await getApiKey(provider.id);
  if (!apiKey) throw new AppError('no_key');
  const keywords = (await listKeywords(db)).filter((k) => k.enabled);
  if (keywords.length === 0) throw new AppError('no_keywords');
  const settings = await loadSettings(db);

  const { id: digestId, previousStatus } = await beginDigest(db, date, slot, provider);
  try {
    onStep?.('fetching');
    const { articles, failedKeywords } = await collectArticles(
      keywords.map((k) => ({ label: k.label, query: k.query })),
      getNewsSource(settings.rss_provider),
      { locale: parseLocale(settings.locale), signal },
    );

    if (articles.length === 0) {
      await restoreOrDiscard(db, digestId, previousStatus === null, date, slot);
      return { kind: 'empty', failedKeywords };
    }

    onStep?.('writing');
    const n = settings.cards_per_digest;
    const alreadyShown = slot === 'evening' ? await getCardTitles(db, date, 'morning') : [];
    const { cards } = await generateCards(createProvider(provider, apiKey), {
      system: buildSystemPrompt(n, slot),
      user: buildUserPrompt({ slot, n, articles, alreadyShown }),
      allowedUrls: new Set(articles.map((a) => a.url)),
      max: n,
      signal,
    });
    if (cards.length === 0) throw new AppError('invalid_output');

    onStep?.('saving');
    await completeDigest(db, digestId, provider, articles, cards);
    return { kind: 'ready', digestId, failedKeywords };
  } catch (e) {
    await restoreOrFail(db, digestId, date, slot);
    throw toAppError(e);
  }
}

/**
 * On failure: a regenerate keeps its previous cards (or its caught-up state if
 * they were already read and cleared); a first attempt is marked failed with
 * nothing cached.
 */
async function restoreOrFail(db: Db, digestId: string, date: string, slot: Slot): Promise<void> {
  const hasCards = (await getCards(db, digestId)).length > 0;
  const row = await getDigest(db, date, slot);
  const cleared = row !== null && row.clearedAt !== null;
  await setDigestStatus(db, digestId, statusAfterFailure(hasCards, cleared));
}

async function restoreOrDiscard(db: Db, digestId: string, isNew: boolean, date: string, slot: Slot): Promise<void> {
  if (isNew) await deleteDigest(db, digestId);
  else await restoreOrFail(db, digestId, date, slot);
}
