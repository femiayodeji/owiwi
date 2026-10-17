import type { Article, FetchOpts, KeywordInput, NewsSource } from './types';
import { fetchFeed } from './feed';
import { truncate, type RawItem } from './parse';
import { SNIPPET_MAX } from './google';

export type PublisherCategory = 'world' | 'tech' | 'sports';

export interface PublisherPreset {
  id: string;
  label: string;
  category: PublisherCategory;
  url: string;
}

export const PUBLISHER_PRESETS: readonly PublisherPreset[] = [
  { id: 'bbc', label: 'BBC News', category: 'world', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { id: 'aljazeera', label: 'Al Jazeera', category: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'techcrunch', label: 'TechCrunch', category: 'tech', url: 'https://techcrunch.com/feed/' },
  { id: 'theverge', label: 'The Verge', category: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'espn', label: 'ESPN', category: 'sports', url: 'https://www.espn.com/espn/rss/news' },
  { id: 'hackernews', label: 'Hacker News', category: 'tech', url: 'https://hnrss.org/frontpage' },
];

const SPLIT = /[\s.,;:!?"'“”‘’()[\]{}<>/\\|+=*&^%$#@~`_—–-]+/;
const STOP = new Set(['and', 'or', 'the', 'of', 'a', 'an', 'in', 'on', 'for', 'to']);

function tokens(s: string): string[] {
  return s.toLowerCase().split(SPLIT).filter(Boolean);
}

function sameWord(term: string, token: string): boolean {
  return token === term || token === `${term}s` || term === `${token}s`;
}

/** True when every meaningful word of the query appears as a word in text (case-insensitive, plural-tolerant). */
export function matchesKeyword(query: string, text: string): boolean {
  const all = tokens(query);
  const terms = all.filter((t) => !STOP.has(t));
  const want = terms.length ? terms : all;
  if (!want.length) return false;
  const have = tokens(text);
  return want.every((term) => have.some((tok) => sameWord(term, tok)));
}

// hnrss descriptions are just "Article URL: ... Comments URL: ... Points: N".
function publisherSnippet(description: string | null): string | null {
  if (!description || /^Article URL:/i.test(description)) return null;
  return truncate(description, SNIPPET_MAX);
}

interface FeedItem {
  preset: PublisherPreset;
  item: RawItem;
}

/**
 * Keyword search over publisher feeds. Feeds are downloaded once per source
 * instance (so N keywords cost one download each); failed feeds are skipped.
 */
export function createPublisherSource(presetIds?: readonly string[]): NewsSource {
  const presets = presetIds
    ? PUBLISHER_PRESETS.filter((p) => presetIds.includes(p.id))
    : PUBLISHER_PRESETS;
  let loading: Promise<FeedItem[]> | null = null;

  const load = (signal?: AbortSignal): Promise<FeedItem[]> => {
    loading ??= Promise.all(
      presets.map((preset) =>
        fetchFeed(preset.url, signal).then(
          (items) => ({ ok: true, items: items.map((item) => ({ preset, item })) }),
          () => ({ ok: false, items: [] as FeedItem[] }),
        ),
      ),
    ).then((results) => {
      if (presets.length && results.every((r) => !r.ok)) {
        loading = null; // let a later call retry
        throw new Error('All publisher feeds failed');
      }
      return results.flatMap((r) => r.items);
    });
    return loading;
  };

  return {
    id: 'publishers',
    label: 'Publisher feeds',
    async fetch(keyword: KeywordInput, opts: FetchOpts): Promise<Article[]> {
      const all = await load(opts.signal);
      return all
        .filter(({ item }) => matchesKeyword(keyword.query, `${item.title} ${item.description ?? ''}`))
        .sort((a, b) => (b.item.publishedAt ?? '').localeCompare(a.item.publishedAt ?? ''))
        .slice(0, opts.limit ?? 15)
        .map(({ preset, item }) => ({
          keywordLabel: keyword.label,
          title: item.title,
          snippet: publisherSnippet(item.description),
          source: preset.label,
          url: item.link,
          publishedAt: item.publishedAt,
        }));
    },
  };
}
