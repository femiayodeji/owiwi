// Seen stories: a card counts as seen once its page is shown in the feed. They
// are kept for 48 hours so later digests (any slot, regenerate included) skip
// them. URLs and titles are compared in the news dedupe's normalized form.
import { normalizeTitle, normalizeUrl } from '../news/dedupe';
import type { Article } from '../news/types';

export const SEEN_TTL_MS = 48 * 60 * 60 * 1000;

/** Titles of recently seen stories sent to the LLM as already_shown. */
export const MAX_ALREADY_SHOWN = 60;

export interface SeenStory {
  /** Normalized URL (see normalizeUrl). */
  url: string;
  /** Card title, as the reader saw it. */
  title: string;
  /** Normalized title of the source article (see normalizeTitle). */
  titleKey: string;
}

/** True for an article whose normalized URL or title matches a seen story. */
export function seenMatcher(seen: readonly SeenStory[]): (a: Article) => boolean {
  const urls = new Set(seen.map((s) => s.url));
  const titles = new Set(seen.map((s) => s.titleKey).filter((t) => t.length > 0));
  return (a) => urls.has(normalizeUrl(a.url)) || titles.has(normalizeTitle(a.title));
}

/**
 * Page to open a digest on: the first card not seen yet, or the completion
 * page (cards.length) when every card was seen, so the reader can swipe back.
 */
export function resumeIndex(cards: readonly { url: string }[], seenUrls: ReadonlySet<string>): number {
  const i = cards.findIndex((c) => !seenUrls.has(normalizeUrl(c.url)));
  return i === -1 ? cards.length : i;
}
