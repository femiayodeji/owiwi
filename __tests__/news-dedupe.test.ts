import { dedupeArticles, normalizeTitle, normalizeUrl } from '../src/news/dedupe';
import type { Article } from '../src/news/types';

const art = (title: string, url: string, keywordLabel = 'K'): Article => ({
  keywordLabel,
  title,
  snippet: null,
  source: null,
  url,
  publishedAt: null,
});

describe('normalizeUrl', () => {
  it('canonicalizes host, tracking params, hash and trailing slash', () => {
    expect(normalizeUrl('HTTP://WWW.Example.com/News/Story/?utm_source=x&id=2&fbclid=y&at_medium=RSS&a=1#top')).toBe(
      'https://example.com/News/Story?a=1&id=2',
    );
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });
  it('leaves google news redirect paths intact', () => {
    expect(normalizeUrl('https://news.google.com/rss/articles/CBMiAbC?oc=5#x')).toBe(
      'https://news.google.com/rss/articles/CBMiAbC?oc=5',
    );
  });
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation and publisher suffix', () => {
    expect(normalizeTitle('Tinubu signs  Bill: "Big" news! - Punch Newspapers')).toBe('tinubu signs bill big news');
  });
});

describe('dedupeArticles', () => {
  it('dedupes by normalized url, keeping the first', () => {
    const out = dedupeArticles([
      art('One', 'https://www.a.com/x?utm_medium=rss', 'first'),
      art('Totally different', 'https://a.com/x/', 'second'),
    ]);
    expect(out.map((a) => a.keywordLabel)).toEqual(['first']);
  });
  it('dedupes identical titles across publishers', () => {
    const out = dedupeArticles([
      art('Fed holds rates steady - Reuters', 'https://r.com/1'),
      art('Fed holds rates steady - CNBC', 'https://c.com/1'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://r.com/1');
  });
  it('dedupes near-identical titles but keeps distinct stories', () => {
    const base = 'Nigeria central bank raises interest rate to record high amid soaring inflation pressure';
    const out = dedupeArticles([
      art(base, 'https://a.com/1'),
      art(`${base} today`, 'https://b.com/1'), // jaccard 13/14 > 0.85
      art('Nigeria central bank holds rate', 'https://c.com/1'),
    ]);
    expect(out.map((a) => a.url)).toEqual(['https://a.com/1', 'https://c.com/1']);
  });
});
