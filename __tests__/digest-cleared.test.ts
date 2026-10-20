import type { Db } from '../src/db/client';
import { clearDigest, getCardTitles } from '../src/db/queries';
import { MIGRATIONS } from '../src/db/migrations';
import {
  caughtUpOnLeave,
  isCleared,
  parseShownTitles,
  resolveShownTitles,
  serializeShownTitles,
  slotStatusFor,
  statusAfterFailure,
} from '../src/digest/cleared';

describe('shown titles JSON', () => {
  it('round-trips', () => {
    const titles = ['Rates held', 'Cup final "drama"'];
    expect(parseShownTitles(serializeShownTitles(titles))).toEqual(titles);
  });
  it('returns [] for null, empty or malformed data', () => {
    expect(parseShownTitles(null)).toEqual([]);
    expect(parseShownTitles(undefined)).toEqual([]);
    expect(parseShownTitles('')).toEqual([]);
    expect(parseShownTitles('{not json')).toEqual([]);
    expect(parseShownTitles('{"a":1}')).toEqual([]);
    expect(parseShownTitles('[1, 2]')).toEqual([]);
    expect(parseShownTitles('"x"')).toEqual([]);
  });
  it('drops blank titles', () => {
    expect(parseShownTitles('["A", "  ", "B "]')).toEqual(['A', 'B']);
  });
});

describe('slotStatusFor', () => {
  it('ready + cleared is caught-up', () => {
    expect(slotStatusFor({ status: 'ready', clearedAt: 123 }, false)).toBe('caught-up');
  });
  it('ready and not cleared shows the cards', () => {
    expect(slotStatusFor({ status: 'ready', clearedAt: null }, false)).toBe('ready');
  });
  it('no row is none, failed is failed', () => {
    expect(slotStatusFor(null, false)).toBe('none');
    expect(slotStatusFor({ status: 'failed', clearedAt: null }, false)).toBe('failed');
  });
  it('generating is only shown when a run is live here', () => {
    expect(slotStatusFor({ status: 'generating', clearedAt: 1 }, true)).toBe('generating');
    expect(slotStatusFor({ status: 'generating', clearedAt: null }, false)).toBe('none');
  });
  it('isCleared needs a ready row', () => {
    expect(isCleared({ status: 'generating', clearedAt: 1 })).toBe(false);
    expect(isCleared({ status: 'ready', clearedAt: 1 })).toBe(true);
  });
});

describe('resolveShownTitles', () => {
  it('uses live card titles while not cleared', () => {
    expect(resolveShownTitles({ status: 'ready', clearedAt: null, shownTitles: null }, ['A'])).toEqual(['A']);
  });
  it('uses the saved titles once cleared', () => {
    expect(resolveShownTitles({ status: 'ready', clearedAt: 5, shownTitles: '["A","B"]' }, [])).toEqual(['A', 'B']);
  });
  it('is empty for no digest or a non-ready one', () => {
    expect(resolveShownTitles(null, ['A'])).toEqual([]);
    expect(resolveShownTitles({ status: 'failed', clearedAt: null, shownTitles: null }, ['A'])).toEqual([]);
  });
});

describe('statusAfterFailure', () => {
  it('keeps a digest with cards or a cleared one ready', () => {
    expect(statusAfterFailure(true, false)).toBe('ready');
    expect(statusAfterFailure(false, true)).toBe('ready');
  });
  it('fails a first attempt with nothing cached', () => {
    expect(statusAfterFailure(false, false)).toBe('failed');
  });
});

describe('caughtUpOnLeave', () => {
  it('swaps only a ready slot that was cleared this session', () => {
    expect(caughtUpOnLeave({ status: 'ready', cleared: true })).toBe(true);
    expect(caughtUpOnLeave({ status: 'ready', cleared: false })).toBe(false);
    expect(caughtUpOnLeave({ status: 'generating', cleared: true })).toBe(false);
  });
});

describe('clearing migration', () => {
  it('is appended, not edited into the initial schema', () => {
    expect(MIGRATIONS[0]).not.toContain('cleared_at');
    expect(MIGRATIONS.some((m) => /ALTER TABLE digests ADD COLUMN cleared_at INTEGER/.test(m))).toBe(true);
    expect(MIGRATIONS.some((m) => /ALTER TABLE digests ADD COLUMN shown_titles TEXT/.test(m))).toBe(true);
  });
});

// Minimal in-memory stand-in for the statements the clearing path runs.
interface DigestRow {
  id: string;
  date: string;
  slot: string;
  status: string;
  cleared_at: number | null;
  shown_titles: string | null;
}

function fakeDb(digest: DigestRow, cardTitles: string[]) {
  let cards = cardTitles.map((title, position) => ({ id: `c${position}`, digest_id: digest.id, position, title }));
  let articles = cardTitles.length;
  const db = {
    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
    async getFirstAsync<T>(_sql: string, date: string, slot: string): Promise<T | null> {
      return (digest.date === date && digest.slot === slot ? { ...digest } : null) as T | null;
    },
    async getAllAsync<T>(_sql: string, digestId: string): Promise<T[]> {
      return cards.filter((c) => c.digest_id === digestId) as T[];
    },
    async runAsync(sql: string, ...params: (string | number)[]): Promise<{ changes: number }> {
      if (sql.startsWith('UPDATE digests SET cleared_at')) {
        if (digest.status !== 'ready' || digest.cleared_at !== null || params[2] !== digest.id) return { changes: 0 };
        digest.cleared_at = Number(params[0]);
        digest.shown_titles = String(params[1]);
        return { changes: 1 };
      }
      if (sql.startsWith('DELETE FROM cards')) {
        const n = cards.length;
        cards = [];
        return { changes: n };
      }
      if (sql.startsWith('DELETE FROM articles')) {
        const n = articles;
        articles = 0;
        return { changes: n };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  };
  return { db: db as unknown as Db, digest, cardCount: () => cards.length, articleCount: () => articles };
}

describe('clearDigest + getCardTitles', () => {
  const morning = (): DigestRow => ({
    id: 'd1',
    date: '2026-10-20',
    slot: 'morning',
    status: 'ready',
    cleared_at: null,
    shown_titles: null,
  });

  it('keeps the morning titles for the evening dedupe after clearing', async () => {
    const f = fakeDb(morning(), ['Rates held', 'Cup final']);
    expect(await getCardTitles(f.db, '2026-10-20', 'morning')).toEqual(['Rates held', 'Cup final']);

    expect(await clearDigest(f.db, 'd1')).toBe(true);
    expect(f.cardCount()).toBe(0);
    expect(f.articleCount()).toBe(0);
    expect(f.digest.status).toBe('ready');
    expect(f.digest.cleared_at).not.toBeNull();

    expect(await getCardTitles(f.db, '2026-10-20', 'morning')).toEqual(['Rates held', 'Cup final']);
  });

  it('is a no-op the second time and keeps the saved titles', async () => {
    const f = fakeDb(morning(), ['A']);
    await clearDigest(f.db, 'd1');
    expect(await clearDigest(f.db, 'd1')).toBe(false);
    expect(await getCardTitles(f.db, '2026-10-20', 'morning')).toEqual(['A']);
  });

  it('does not clear a digest that is not ready', async () => {
    const f = fakeDb({ ...morning(), status: 'generating' }, ['A']);
    expect(await clearDigest(f.db, 'd1')).toBe(false);
    expect(f.cardCount()).toBe(1);
  });
});
