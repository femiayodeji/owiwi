import { MIGRATIONS } from '../src/db/migrations';
import { sortBookmarks, toBookmark, withUrl, type Bookmark } from '../src/lib/bookmarks';
import { formatShareMessage, SHARE_TAG, shareTitleSize } from '../src/lib/share';
import { WIPE_SQL } from '../src/digest/retention';

describe('shareTitleSize', () => {
  it('steps the share-image title down as it gets longer', () => {
    expect(shareTitleSize('Rates held')).toBe(24);
    expect(shareTitleSize('x'.repeat(60))).toBe(21);
    expect(shareTitleSize('x'.repeat(90))).toBe(19);
  });
});

describe('formatShareMessage', () => {
  it('joins title, summary and the Owiwi tag as plain text, without the link', () => {
    const out = formatShareMessage({
      title: 'Rates held',
      summary: 'The central bank kept rates unchanged.',
    });
    expect(out.title).toBe('Rates held');
    expect(out.message).toBe(`Rates held\n\nThe central bank kept rates unchanged.\n\n${SHARE_TAG}`);
  });

  it('collapses whitespace and skips empty parts', () => {
    const out = formatShareMessage({ title: '  Big\n  news ', summary: '   ' });
    expect(out.title).toBe('Big news');
    expect(out.message).toBe(`Big news\n\n${SHARE_TAG}`);
  });
});

const card = {
  url: 'https://example.com/a',
  title: 'T',
  summary: 'S',
  topic: 'AI',
  source: 'BBC',
  publishedAt: '2026-10-20T08:00:00Z',
};

describe('bookmarks', () => {
  it('copies card content into a self-contained bookmark', () => {
    const b = toBookmark({ ...card, ...{ id: 'card-1', digestId: 'd1', position: 0 } }, 'bm-1', 123);
    expect(b).toEqual({ id: 'bm-1', createdAt: 123, ...card });
    expect(b).not.toHaveProperty('digestId');
  });

  it('sorts newest first, stable by title', () => {
    const mk = (title: string, createdAt: number): Bookmark => toBookmark({ ...card, url: title, title }, title, createdAt);
    expect(sortBookmarks([mk('b', 1), mk('c', 3), mk('a', 1)]).map((b) => b.title)).toEqual(['c', 'a', 'b']);
  });

  it('withUrl returns a new set without mutating the input', () => {
    const a = new Set(['x']);
    const added = withUrl(a, 'y', true);
    const removed = withUrl(added, 'x', false);
    expect([...a]).toEqual(['x']);
    expect([...added].sort()).toEqual(['x', 'y']);
    expect([...removed]).toEqual(['y']);
    expect(withUrl(a, 'x', true)).not.toBe(a);
  });

  it('is stored in its own table, unique per url, independent of cards and digests', () => {
    const sql = MIGRATIONS.find((m) => /CREATE TABLE bookmarks/.test(m));
    expect(sql).toBeDefined();
    expect(sql).toMatch(/url TEXT NOT NULL UNIQUE/);
    expect(sql).not.toMatch(/REFERENCES/);
    // The daily wipe only touches digests.
    expect(WIPE_SQL).not.toMatch(/bookmarks/);
  });
});
