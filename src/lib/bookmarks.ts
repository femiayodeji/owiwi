// Pure bookmark helpers. Bookmarks copy a card's content so they survive the
// daily wipe and any removal of read cards; they never reference cards rows.

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  summary: string;
  topic: string | null;
  source: string | null;
  publishedAt: string | null;
  createdAt: number;
}

/** The card fields a bookmark copies. */
export interface BookmarkSource {
  url: string;
  title: string;
  summary: string;
  topic: string | null;
  source: string | null;
  publishedAt: string | null;
}

export function toBookmark(card: BookmarkSource, id: string, now: number): Bookmark {
  return {
    id,
    url: card.url,
    title: card.title,
    summary: card.summary,
    topic: card.topic,
    source: card.source,
    publishedAt: card.publishedAt,
    createdAt: now,
  };
}

/** Newest first; ties broken by title so the order is stable. */
export function sortBookmarks(list: readonly Bookmark[]): Bookmark[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title));
}

/** Returns a new set with `url` added or removed (sets in zustand state must be replaced, not mutated). */
export function withUrl(urls: ReadonlySet<string>, url: string, saved: boolean): Set<string> {
  const next = new Set(urls);
  if (saved) next.add(url);
  else next.delete(url);
  return next;
}
