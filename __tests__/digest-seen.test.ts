import { describe, expect, it, jest } from '@jest/globals';
import { MIGRATIONS } from '../src/db/migrations';
import { PRUNE_SEEN_SQL, WIPE_SQL, wipeStale } from '../src/digest/retention';
import { resumeIndex, seenMatcher, SEEN_TTL_MS, type SeenStory } from '../src/digest/seen';
import { nextDigestLine } from '../src/digest/slot';
import { normalizeTitle, normalizeUrl } from '../src/news/dedupe';
import type { Article } from '../src/news/types';

const art = (url: string, title: string): Article => ({
  keywordLabel: 'AI',
  title,
  snippet: null,
  source: null,
  url,
  publishedAt: null,
});

const seenStory = (url: string, title: string): SeenStory => ({
  url: normalizeUrl(url),
  title,
  titleKey: normalizeTitle(title),
});

// Mirrors how collectArticles applies the matcher.
const dropSeen = (articles: Article[], seen: SeenStory[]): Article[] => articles.filter((a) => !seenMatcher(seen)(a));

describe('seenMatcher', () => {
  const seen = [seenStory('https://www.example.com/a?utm_source=x', 'Rates held - Reuters')];

  it('drops articles whose normalized URL was seen', () => {
    expect(dropSeen([art('https://example.com/a', 'Other words')], seen)).toEqual([]);
  });
  it('drops articles whose normalized title was seen', () => {
    expect(dropSeen([art('https://other.com/x', 'Rates Held! - BBC')], seen)).toEqual([]);
  });
  it('keeps everything else, in order', () => {
    const fresh = [art('https://example.com/b', 'Cup final'), art('https://example.com/c', 'Rates cut')];
    expect(dropSeen(fresh, seen)).toEqual(fresh);
  });
  it('keeps everything when nothing was seen, and ignores blank title keys', () => {
    const a = [art('https://example.com/b', '!!!')];
    expect(dropSeen(a, [])).toEqual(a);
    expect(dropSeen(a, [{ url: 'x', title: 'x', titleKey: '' }])).toEqual(a);
  });
});

describe('resumeIndex', () => {
  const cards = [{ url: 'https://example.com/1' }, { url: 'https://example.com/2' }];

  it('opens on the first unseen card', () => {
    expect(resumeIndex(cards, new Set())).toBe(0);
    expect(resumeIndex(cards, new Set([normalizeUrl('https://www.example.com/1')]))).toBe(1);
  });
  it('opens on the completion page when every card was seen', () => {
    expect(resumeIndex(cards, new Set(cards.map((c) => normalizeUrl(c.url))))).toBe(2);
  });
  it('reopens on the page the reader was last on, even though it was seen', () => {
    const allSeen = new Set(cards.map((c) => normalizeUrl(c.url)));
    expect(resumeIndex(cards, allSeen, 0)).toBe(0);
    expect(resumeIndex(cards, new Set([normalizeUrl(cards[0].url)]), 0)).toBe(0);
    expect(resumeIndex(cards, allSeen, 2)).toBe(2);
  });
  it('ignores a last page outside the digest', () => {
    expect(resumeIndex(cards, new Set(), 5)).toBe(0);
    expect(resumeIndex(cards, new Set(), -1)).toBe(0);
  });
});

describe('wipeStale', () => {
  it('prunes seen stories older than 48 hours, separately from the digest wipe', async () => {
    const runAsync = jest.fn(async (_sql: string, ..._params: (string | number)[]) => ({ changes: 1 }));
    await wipeStale({ runAsync }, '2026-10-20', 1_000_000_000);
    expect(runAsync).toHaveBeenCalledWith(WIPE_SQL, '2026-10-20');
    expect(runAsync).toHaveBeenCalledWith(PRUNE_SEEN_SQL, 1_000_000_000 - SEEN_TTL_MS);
    expect(WIPE_SQL).not.toMatch(/seen_stories/);
  });
});

describe('nextDigestLine', () => {
  const at = (h: number) => new Date(2026, 9, 20, h, 0);
  it('points to the evening digest during the morning slot', () => {
    expect(nextDigestLine(at(9), '07:00', '19:00')).toBe('Your evening digest is at 19:00.');
  });
  it("points to tomorrow's morning digest during the evening slot", () => {
    expect(nextDigestLine(at(20), '7:30', '19:00')).toBe('Your morning digest is tomorrow at 07:30.');
  });
});

describe('migrations', () => {
  it('are appended, not edited into the initial schema', () => {
    expect(MIGRATIONS[0]).not.toContain('cleared_at');
    expect(MIGRATIONS[0]).not.toContain('seen_stories');
    expect(MIGRATIONS[2]).toMatch(/ALTER TABLE digests ADD COLUMN cleared_at INTEGER/);
    expect(MIGRATIONS[2]).toMatch(/ALTER TABLE digests ADD COLUMN shown_titles TEXT/);
    expect(MIGRATIONS[3]).toMatch(/CREATE TABLE seen_stories/);
    expect(MIGRATIONS[3]).toMatch(/url TEXT PRIMARY KEY/);
    expect(MIGRATIONS[3]).not.toMatch(/REFERENCES/);
  });
});
