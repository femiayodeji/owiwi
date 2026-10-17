import type { Article, FetchOpts, KeywordInput, Locale, NewsSource } from './types';
import { fetchFeed } from './feed';
import { truncate, type RawItem } from './parse';

export const SNIPPET_MAX = 300;

export function googleNewsUrl(query: string, locale: Locale): string {
  const { lang, country } = locale;
  const q = encodeURIComponent(`${query} when:1d`);
  return `https://news.google.com/rss/search?q=${q}&hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Google titles end with " - Publisher"; drop it when it matches the source. */
export function stripPublisherSuffix(title: string, source: string | null): string {
  if (!source) return title;
  const i = title.lastIndexOf(' - ');
  if (i <= 0) return title;
  return sameText(title.slice(i + 3), source) ? title.slice(0, i).trim() : title;
}

/** Google descriptions are usually just "<title> <source>"; treat those as no snippet. */
export function googleSnippet(description: string | null, title: string, source: string | null): string | null {
  if (!description) return null;
  let d = description.trim();
  if (source && d.toLowerCase().endsWith(source.toLowerCase())) d = d.slice(0, d.length - source.length).trim();
  if (!d || sameText(d, title) || (source && sameText(d, `${title} - ${source}`))) return null;
  return truncate(description, SNIPPET_MAX);
}

export function googleItemToArticle(item: RawItem, keywordLabel: string): Article {
  const title = stripPublisherSuffix(item.title, item.source);
  return {
    keywordLabel,
    title,
    snippet: googleSnippet(item.description, title, item.source),
    source: item.source,
    url: item.link, // Google redirect URL, opened as-is
    publishedAt: item.publishedAt,
  };
}

export const googleSource: NewsSource = {
  id: 'google',
  label: 'Google News',
  async fetch(keyword: KeywordInput, opts: FetchOpts): Promise<Article[]> {
    const items = await fetchFeed(googleNewsUrl(keyword.query, opts.locale), opts.signal);
    return items.slice(0, opts.limit ?? 15).map((it) => googleItemToArticle(it, keyword.label));
  },
};
