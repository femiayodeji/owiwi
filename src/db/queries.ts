import type { Db } from './client';
import type { Article } from '../news/types';
import type { CardDraft, ProviderConfig, ProviderKind, Slot } from '../llm/types';
import { newId } from '../lib/ids';
import { isCleared, resolveShownTitles, serializeShownTitles } from '../digest/cleared';
import { toBookmark, type Bookmark, type BookmarkSource } from '../lib/bookmarks';

export type { Bookmark } from '../lib/bookmarks';

// ---------- keywords ----------

export interface Keyword {
  id: string;
  label: string;
  query: string;
  enabled: boolean;
  sort: number;
  createdAt: number;
}

export const MAX_ENABLED_KEYWORDS = 8;

interface KeywordRow {
  id: string;
  label: string;
  query: string;
  enabled: number;
  sort: number;
  created_at: number;
}

const toKeyword = (r: KeywordRow): Keyword => ({
  id: r.id,
  label: r.label,
  query: r.query,
  enabled: r.enabled === 1,
  sort: r.sort,
  createdAt: r.created_at,
});

export async function listKeywords(db: Db): Promise<Keyword[]> {
  const rows = await db.getAllAsync<KeywordRow>('SELECT * FROM keywords ORDER BY sort, created_at');
  return rows.map(toKeyword);
}

export async function countEnabledKeywords(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM keywords WHERE enabled = 1');
  return row?.n ?? 0;
}

/** Adds a keyword. It starts disabled if the enabled cap is already reached. */
export async function addKeyword(db: Db, label: string, query?: string): Promise<Keyword> {
  const enabled = (await countEnabledKeywords(db)) < MAX_ENABLED_KEYWORDS;
  const max = await db.getFirstAsync<{ s: number | null }>('SELECT MAX(sort) AS s FROM keywords');
  const row: KeywordRow = {
    id: newId(),
    label: label.trim(),
    query: (query ?? label).trim(),
    enabled: enabled ? 1 : 0,
    sort: (max?.s ?? -1) + 1,
    created_at: Date.now(),
  };
  await db.runAsync(
    'INSERT INTO keywords (id, label, query, enabled, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    row.id,
    row.label,
    row.query,
    row.enabled,
    row.sort,
    row.created_at,
  );
  return toKeyword(row);
}

export async function updateKeyword(db: Db, id: string, patch: { label?: string; query?: string }): Promise<void> {
  if (patch.label !== undefined) await db.runAsync('UPDATE keywords SET label = ? WHERE id = ?', patch.label.trim(), id);
  if (patch.query !== undefined) await db.runAsync('UPDATE keywords SET query = ? WHERE id = ?', patch.query.trim(), id);
}

/** Returns false if enabling would exceed the cap. */
export async function setKeywordEnabled(db: Db, id: string, enabled: boolean): Promise<boolean> {
  if (enabled && (await countEnabledKeywords(db)) >= MAX_ENABLED_KEYWORDS) return false;
  await db.runAsync('UPDATE keywords SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
  return true;
}

export async function deleteKeyword(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM keywords WHERE id = ?', id);
}

export async function reorderKeywords(db: Db, orderedIds: readonly string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE keywords SET sort = ? WHERE id = ?', i, orderedIds[i]);
    }
  });
}

// ---------- providers (non-secret config only) ----------

interface ProviderRow {
  id: string;
  kind: string;
  label: string;
  base_url: string | null;
  model: string;
  is_active: number;
}

const toProvider = (r: ProviderRow): ProviderConfig => ({
  id: r.id,
  kind: r.kind as ProviderKind,
  label: r.label,
  baseUrl: r.base_url,
  model: r.model,
  isActive: r.is_active === 1,
});

export async function listProviders(db: Db): Promise<ProviderConfig[]> {
  const rows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers ORDER BY label');
  return rows.map(toProvider);
}

export async function getActiveProvider(db: Db): Promise<ProviderConfig | null> {
  const row = await db.getFirstAsync<ProviderRow>('SELECT * FROM providers WHERE is_active = 1 LIMIT 1');
  return row ? toProvider(row) : null;
}

export async function getProvider(db: Db, id: string): Promise<ProviderConfig | null> {
  const row = await db.getFirstAsync<ProviderRow>('SELECT * FROM providers WHERE id = ?', id);
  return row ? toProvider(row) : null;
}

/** Inserts or updates. The first provider ever saved becomes active. */
export async function saveProvider(db: Db, p: Omit<ProviderConfig, 'isActive'>): Promise<void> {
  await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ id: string }>('SELECT id FROM providers WHERE is_active = 1');
    const isActive = !active || active.id === p.id ? 1 : 0;
    await db.runAsync(
      `INSERT INTO providers (id, kind, label, base_url, model, is_active) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, label = excluded.label,
         base_url = excluded.base_url, model = excluded.model`,
      p.id,
      p.kind,
      p.label,
      p.baseUrl,
      p.model,
      isActive,
    );
  });
}

export async function setActiveProvider(db: Db, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE providers SET is_active = 0');
    await db.runAsync('UPDATE providers SET is_active = 1 WHERE id = ?', id);
  });
}

/** Deletes a provider. If it was active, another one (if any) becomes active. */
export async function deleteProvider(db: Db, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM providers WHERE id = ?', id);
    const active = await db.getFirstAsync<{ id: string }>('SELECT id FROM providers WHERE is_active = 1');
    if (!active) {
      await db.runAsync('UPDATE providers SET is_active = 1 WHERE id = (SELECT id FROM providers ORDER BY label LIMIT 1)');
    }
  });
}

// ---------- digests, articles, cards ----------

export type DigestStatus = 'generating' | 'ready' | 'failed';

export interface Digest {
  id: string;
  date: string;
  slot: Slot;
  status: DigestStatus;
  providerId: string | null;
  model: string | null;
  createdAt: number;
  /** Set once the reader finished this digest and its cards were deleted. */
  clearedAt: number | null;
  /** JSON array of the cleared cards' titles (see src/digest/cleared.ts). */
  shownTitles: string | null;
}

interface DigestRow {
  id: string;
  date: string;
  slot: Slot;
  status: DigestStatus;
  provider_id: string | null;
  model: string | null;
  created_at: number;
  cleared_at: number | null;
  shown_titles: string | null;
}

const toDigest = (r: DigestRow): Digest => ({
  id: r.id,
  date: r.date,
  slot: r.slot,
  status: r.status,
  providerId: r.provider_id,
  model: r.model,
  createdAt: r.created_at,
  clearedAt: r.cleared_at ?? null,
  shownTitles: r.shown_titles ?? null,
});

export interface Card {
  id: string;
  digestId: string;
  position: number;
  topic: string | null;
  title: string;
  summary: string;
  source: string | null;
  url: string;
  publishedAt: string | null;
}

interface CardRow {
  id: string;
  digest_id: string;
  position: number;
  topic: string | null;
  title: string;
  summary: string;
  source: string | null;
  url: string;
  published_at: string | null;
}

const toCard = (r: CardRow): Card => ({
  id: r.id,
  digestId: r.digest_id,
  position: r.position,
  topic: r.topic,
  title: r.title,
  summary: r.summary,
  source: r.source,
  url: r.url,
  publishedAt: r.published_at,
});

export async function getDigest(db: Db, date: string, slot: Slot): Promise<Digest | null> {
  const row = await db.getFirstAsync<DigestRow>('SELECT * FROM digests WHERE date = ? AND slot = ?', date, slot);
  return row ? toDigest(row) : null;
}

export async function getCards(db: Db, digestId: string): Promise<Card[]> {
  const rows = await db.getAllAsync<CardRow>('SELECT * FROM cards WHERE digest_id = ? ORDER BY position', digestId);
  return rows.map(toCard);
}

/** Titles of the stories in (date, slot)'s ready digest, including one already read and cleared. */
export async function getCardTitles(db: Db, date: string, slot: Slot): Promise<string[]> {
  const digest = await getDigest(db, date, slot);
  if (!digest || digest.status !== 'ready') return [];
  const cardTitles = isCleared(digest) ? [] : (await getCards(db, digest.id)).map((c) => c.title);
  return resolveShownTitles(digest, cardTitles);
}

/**
 * Marks a finished digest as read: saves its card titles on the row, then
 * deletes its cards and articles, in one transaction. The row stays ready so
 * the slot is not generated again. No-op if already cleared or not ready.
 */
export async function clearDigest(db: Db, digestId: string): Promise<boolean> {
  let cleared = false;
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ title: string }>(
      'SELECT title FROM cards WHERE digest_id = ? ORDER BY position',
      digestId,
    );
    const res = await db.runAsync(
      "UPDATE digests SET cleared_at = ?, shown_titles = ? WHERE id = ? AND status = 'ready' AND cleared_at IS NULL",
      Date.now(),
      serializeShownTitles(rows.map((r) => r.title)),
      digestId,
    );
    if (res.changes === 0) return;
    await db.runAsync('DELETE FROM cards WHERE digest_id = ?', digestId);
    await db.runAsync('DELETE FROM articles WHERE digest_id = ?', digestId);
    cleared = true;
  });
  return cleared;
}

/**
 * Marks (date, slot) as generating, creating the row if needed. Existing cards
 * are kept so a failed regenerate can fall back to them. Returns the digest
 * id and its status before this call.
 */
export async function beginDigest(
  db: Db,
  date: string,
  slot: Slot,
  provider: ProviderConfig,
): Promise<{ id: string; previousStatus: DigestStatus | null }> {
  const existing = await getDigest(db, date, slot);
  if (existing) {
    await db.runAsync(
      "UPDATE digests SET status = 'generating', created_at = ? WHERE id = ?",
      Date.now(),
      existing.id,
    );
    return { id: existing.id, previousStatus: existing.status };
  }
  const id = newId();
  await db.runAsync(
    "INSERT INTO digests (id, date, slot, status, provider_id, model, created_at) VALUES (?, ?, ?, 'generating', ?, ?, ?)",
    id,
    date,
    slot,
    provider.id,
    provider.model,
    Date.now(),
  );
  return { id, previousStatus: null };
}

export async function setDigestStatus(db: Db, id: string, status: DigestStatus): Promise<void> {
  await db.runAsync('UPDATE digests SET status = ? WHERE id = ?', status, id);
}

export async function deleteDigest(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM digests WHERE id = ?', id);
}

/** Replaces the digest's articles and cards and marks it ready, atomically. */
export async function completeDigest(
  db: Db,
  digestId: string,
  provider: ProviderConfig,
  articles: readonly Article[],
  cards: readonly CardDraft[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cards WHERE digest_id = ?', digestId);
    await db.runAsync('DELETE FROM articles WHERE digest_id = ?', digestId);
    for (const a of articles) {
      await db.runAsync(
        `INSERT INTO articles (id, digest_id, keyword_label, title, snippet, source, url, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        digestId,
        a.keywordLabel,
        a.title,
        a.snippet,
        a.source,
        a.url,
        a.publishedAt,
      );
    }
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      await db.runAsync(
        `INSERT INTO cards (id, digest_id, position, topic, title, summary, source, url, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        digestId,
        i,
        c.topic,
        c.title,
        c.summary,
        c.source,
        c.url,
        c.publishedAt,
      );
    }
    await db.runAsync(
      "UPDATE digests SET status = 'ready', provider_id = ?, model = ?, cleared_at = NULL, shown_titles = NULL WHERE id = ?",
      provider.id,
      provider.model,
      digestId,
    );
  });
}

// ---------- streak ----------

export async function listStreakDates(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ date: string }>('SELECT date FROM streak_days ORDER BY date');
  return rows.map((r) => r.date);
}

/** Idempotent per date. Returns true if this call recorded the day. */
export async function recordStreakDay(db: Db, date: string, slot: Slot): Promise<boolean> {
  const res = await db.runAsync(
    'INSERT OR IGNORE INTO streak_days (date, slot, completed_at) VALUES (?, ?, ?)',
    date,
    slot,
    Date.now(),
  );
  return res.changes > 0;
}

export async function isDayCompleted(db: Db, date: string): Promise<boolean> {
  return (await db.getFirstAsync<{ date: string }>('SELECT date FROM streak_days WHERE date = ?', date)) != null;
}

// ---------- bookmarks ----------
// Self-contained copies of card content (see src/lib/bookmarks.ts). Never wiped.

interface BookmarkRow {
  id: string;
  url: string;
  title: string;
  summary: string;
  topic: string | null;
  source: string | null;
  published_at: string | null;
  created_at: number;
}

const toBookmarkModel = (r: BookmarkRow): Bookmark => ({
  id: r.id,
  url: r.url,
  title: r.title,
  summary: r.summary,
  topic: r.topic,
  source: r.source,
  publishedAt: r.published_at,
  createdAt: r.created_at,
});

/** Newest first. */
export async function listBookmarks(db: Db): Promise<Bookmark[]> {
  const rows = await db.getAllAsync<BookmarkRow>('SELECT * FROM bookmarks ORDER BY created_at DESC, title');
  return rows.map(toBookmarkModel);
}

export async function listBookmarkedUrls(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ url: string }>('SELECT url FROM bookmarks');
  return rows.map((r) => r.url);
}

export async function isBookmarked(db: Db, url: string): Promise<boolean> {
  return (await db.getFirstAsync<{ id: string }>('SELECT id FROM bookmarks WHERE url = ?', url)) != null;
}

/**
 * Saves a bookmark row as given (id and created_at included, so an undo restores
 * the original). Idempotent per url. Returns true if a row was inserted.
 */
export async function saveBookmark(db: Db, b: Bookmark): Promise<boolean> {
  const res = await db.runAsync(
    `INSERT OR IGNORE INTO bookmarks (id, url, title, summary, topic, source, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    b.id,
    b.url,
    b.title,
    b.summary,
    b.topic,
    b.source,
    b.publishedAt,
    b.createdAt,
  );
  return res.changes > 0;
}

/** Bookmarks a card by copying its content. Idempotent per url. */
export async function addBookmark(db: Db, card: BookmarkSource): Promise<Bookmark> {
  const b = toBookmark(card, newId(), Date.now());
  await saveBookmark(db, b);
  return b;
}

export async function removeBookmark(db: Db, url: string): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE url = ?', url);
}
