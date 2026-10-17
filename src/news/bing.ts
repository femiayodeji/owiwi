import type { Article, FetchOpts, KeywordInput, Locale, NewsSource } from './types';
import { fetchFeed } from './feed';
import { truncate, type RawItem } from './parse';
import { SNIPPET_MAX } from './google';

export function bingNewsUrl(query: string, locale: Locale): string {
  const q = encodeURIComponent(query);
  return `https://www.bing.com/news/search?q=${q}&format=rss&setlang=${locale.lang}&cc=${locale.country}`;
}

/** Bing wraps links in apiclick.aspx?...&url=<encoded>; returns the real article URL when present. */
export function unwrapBingLink(link: string): string {
  const m = /[?&]url=([^&]+)/i.exec(link);
  if (!m) return link;
  try {
    const url = decodeURIComponent(m[1].replace(/\+/g, ' '));
    return /^https?:\/\//i.test(url) ? url : link;
  } catch {
    return link;
  }
}

export function bingItemToArticle(item: RawItem, keywordLabel: string): Article {
  return {
    keywordLabel,
    title: item.title,
    snippet: item.description ? truncate(item.description, SNIPPET_MAX) : null,
    source: item.source,
    url: unwrapBingLink(item.link),
    publishedAt: item.publishedAt,
  };
}

export const bingSource: NewsSource = {
  id: 'bing',
  label: 'Bing News',
  async fetch(keyword: KeywordInput, opts: FetchOpts): Promise<Article[]> {
    const items = await fetchFeed(bingNewsUrl(keyword.query, opts.locale), opts.signal);
    return items.slice(0, opts.limit ?? 15).map((it) => bingItemToArticle(it, keyword.label));
  },
};
