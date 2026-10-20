import { capFairly, collectArticles } from '../src/news/collect';
import type { Article, FetchOpts, KeywordInput, NewsSource } from '../src/news/types';

const locale = { lang: 'en', country: 'NG' };

function fakeSource(
  impl: (kw: KeywordInput, opts: FetchOpts) => Article[] | Promise<Article[]>,
): NewsSource & { calls: string[]; maxInFlight: number } {
  let inFlight = 0;
  const src = {
    id: 'google' as const,
    label: 'Fake',
    calls: [] as string[],
    maxInFlight: 0,
    async fetch(kw: KeywordInput, opts: FetchOpts) {
      src.calls.push(kw.query);
      inFlight++;
      src.maxInFlight = Math.max(src.maxInFlight, inFlight);
      try {
        await new Promise((r) => setTimeout(r, 5));
        return await impl(kw, opts);
      } finally {
        inFlight--;
      }
    },
  };
  return src;
}

const items = (prefix: string, n: number): Article[] =>
  Array.from({ length: n }, (_, i) => ({
    keywordLabel: 'wrong',
    title: `${prefix} unique headline number ${i} ${prefix}${i}`,
    snippet: null,
    source: null,
    url: `https://${prefix}.com/${i}`,
    publishedAt: null,
  }));

const kws = (...labels: string[]): KeywordInput[] => labels.map((l) => ({ label: l, query: l.toLowerCase() }));

describe('collectArticles', () => {
  it('tolerates failing keywords and sets keywordLabel', async () => {
    const src = fakeSource((kw) => {
      if (kw.query === 'b') throw new Error('boom');
      return items(kw.query, 2);
    });
    const res = await collectArticles(kws('A', 'B', 'C'), src, { locale });
    expect(res.failedKeywords).toEqual(['B']);
    expect(res.articles.map((a) => a.keywordLabel)).toEqual(['A', 'A', 'C', 'C']);
  });

  it('returns empty when everything fails', async () => {
    const src = fakeSource(() => Promise.reject(new Error('down')));
    const res = await collectArticles(kws('A', 'B'), src, { locale });
    expect(res).toEqual({ articles: [], failedKeywords: ['A', 'B'], excluded: 0 });
  });

  it('drops excluded items before the per-keyword cap and over-fetches to refill it', async () => {
    const limits: (number | undefined)[] = [];
    const src = fakeSource((_kw, opts) => {
      limits.push(opts.limit);
      return items('a', 30);
    });
    const seen = new Set(items('a', 10).map((a) => a.url));
    const res = await collectArticles(kws('A'), src, { locale, perKeyword: 15, exclude: (a) => seen.has(a.url) });
    expect(limits).toEqual([30]);
    expect(res.excluded).toBe(10);
    expect(res.articles).toHaveLength(15);
    expect(res.articles.some((a) => seen.has(a.url))).toBe(false);
  });

  it('caps per keyword and passes the limit', async () => {
    const limits: (number | undefined)[] = [];
    const src = fakeSource((kw, opts) => {
      limits.push(opts.limit);
      return items(kw.query, 40); // ignores the limit
    });
    const res = await collectArticles(kws('A'), src, { locale });
    expect(limits).toEqual([15]);
    expect(res.articles).toHaveLength(15);
  });

  it('limits concurrency to 3', async () => {
    const src = fakeSource((kw) => items(kw.query, 1));
    await collectArticles(kws('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), src, { locale });
    expect(src.calls).toHaveLength(8);
    expect(src.maxInFlight).toBe(3);
  });

  it('caps the total fairly across keywords', async () => {
    const counts: Record<string, number> = { a: 15, b: 15, c: 15, d: 15, e: 15, f: 2 };
    const src = fakeSource((kw) => items(kw.query, counts[kw.query]));
    const res = await collectArticles(kws('A', 'B', 'C', 'D', 'E', 'F'), src, { locale });
    expect(res.articles).toHaveLength(60);
    const per: Record<string, number> = {};
    for (const a of res.articles) per[a.keywordLabel] = (per[a.keywordLabel] ?? 0) + 1;
    expect(per.F).toBe(2);
    expect(Object.values(per).filter((n) => n !== 2).every((n) => n >= 11 && n <= 12)).toBe(true);
    // grouped by keyword order
    const order = res.articles.map((a) => a.keywordLabel).filter((l, i, arr) => arr[i - 1] !== l);
    expect(order).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('dedupes across keywords, earlier keyword wins', async () => {
    const shared: Article = { ...items('s', 1)[0], url: 'https://www.s.com/story?utm_source=x' };
    const src = fakeSource((kw) =>
      kw.query === 'a' ? [shared] : [{ ...shared, url: 'https://s.com/story' }, ...items('b', 1)],
    );
    const res = await collectArticles(kws('A', 'B'), src, { locale });
    expect(res.articles.map((a) => [a.keywordLabel, a.url])).toEqual([
      ['A', 'https://www.s.com/story?utm_source=x'],
      ['B', 'https://b.com/0'],
    ]);
  });

  it('throws AbortError when the outer signal aborts', async () => {
    const controller = new AbortController();
    const src = fakeSource((kw) => {
      controller.abort();
      return items(kw.query, 1);
    });
    await expect(collectArticles(kws('A', 'B'), src, { locale, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('capFairly', () => {
  it('round-robins and keeps group order', () => {
    expect(capFairly([[1, 2, 3, 4], [5], [6, 7]], 5)).toEqual([[1, 2], [5], [6, 7]]);
    expect(capFairly([[1, 2]], 0)).toEqual([[]]);
    expect(capFairly([], 5)).toEqual([]);
  });
});
