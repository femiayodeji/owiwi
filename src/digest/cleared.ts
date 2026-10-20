// "Caught up": once the reader finishes a digest, its cards and articles are
// deleted and the digest row is marked cleared. The row stays so (date, slot)
// still counts as built (no auto-generation, no network), and the card titles
// are kept on the row so the evening digest can still skip morning stories.
import { z } from 'zod';
import type { DigestStatus } from '../db/queries';

const ShownTitlesSchema = z.array(z.string());

/** Serializes card titles for `digests.shown_titles`. */
export function serializeShownTitles(titles: readonly string[]): string {
  return JSON.stringify(titles);
}

/** Parses `digests.shown_titles`. Missing or malformed data yields []. */
export function parseShownTitles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  const res = ShownTitlesSchema.safeParse(json);
  return res.success ? res.data.map((t) => t.trim()).filter((t) => t.length > 0) : [];
}

export interface ClearableDigest {
  status: DigestStatus;
  clearedAt: number | null;
  shownTitles: string | null;
}

export function isCleared(d: Pick<ClearableDigest, 'status' | 'clearedAt'>): boolean {
  return d.status === 'ready' && d.clearedAt !== null;
}

/**
 * Titles of a digest's stories for the evening "already_shown" list: the live
 * card titles, or the titles saved when the digest was cleared.
 */
export function resolveShownTitles(d: ClearableDigest | null, cardTitles: readonly string[]): string[] {
  if (!d || d.status !== 'ready') return [];
  return isCleared(d) ? parseShownTitles(d.shownTitles) : [...cardTitles];
}

export type LoadedSlotStatus = 'none' | 'generating' | 'ready' | 'caught-up' | 'failed';

/** What the feed shows for a stored digest row. */
export function slotStatusFor(
  d: Pick<ClearableDigest, 'status' | 'clearedAt'> | null,
  generatingHere: boolean,
): LoadedSlotStatus {
  if (!d) return 'none';
  if (d.status === 'ready') return isCleared(d) ? 'caught-up' : 'ready';
  if (d.status === 'failed') return 'failed';
  // 'generating' without a live run here is an orphan from a killed app.
  return generatingHere ? 'generating' : 'none';
}

/**
 * Status to restore after a failed (re)generation: a digest that still has
 * cards, or was already read and cleared, stays ready; otherwise failed.
 */
export function statusAfterFailure(hasCards: boolean, cleared: boolean): 'ready' | 'failed' {
  return hasCards || cleared ? 'ready' : 'failed';
}

/**
 * True when the feed should swap a just-finished slot (cards still in memory
 * for the celebration, already cleared in the DB) to its caught-up state.
 */
export function caughtUpOnLeave(s: { status: string; cleared: boolean }): boolean {
  return s.cleared && s.status === 'ready';
}

export interface KeepContext {
  /** The local date rolled over since the previous refresh. */
  dayChanged: boolean;
  /** The slot is the one on screen after this refresh. */
  isViewSlot: boolean;
  /** A generation for (today, slot) is running in this process. */
  generatingHere: boolean;
}

/**
 * True when refresh() should keep the in-memory slot instead of the state just
 * read from the DB: a live generation (even before its first step is reported),
 * or a just-finished digest the reader is still looking at (its cards stay in
 * memory until they leave the slot, so a refresh after "Read more" or Share
 * doesn't yank the story away).
 */
export function shouldKeepSlot(
  prev: { status: string; cleared: boolean; cards: readonly unknown[] },
  next: { status: string },
  ctx: KeepContext,
): boolean {
  if (ctx.dayChanged) return false;
  if (prev.status === 'generating' && ctx.generatingHere) return true;
  return ctx.isViewSlot && caughtUpOnLeave(prev) && prev.cards.length > 0 && next.status === 'caught-up';
}
