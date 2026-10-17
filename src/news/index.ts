import { bingSource } from './bing';
import { googleSource } from './google';
import { createPublisherSource } from './publishers';
import type { NewsSource, NewsSourceId } from './types';

export * from './types';
export { parseFeed, stripHtml, truncate, toIsoDate, type RawItem } from './parse';
export { normalizeUrl, normalizeTitle, dedupeArticles } from './dedupe';
export { collectArticles, capFairly, type CollectOpts, type CollectResult } from './collect';
export { googleSource, googleNewsUrl } from './google';
export { bingSource, bingNewsUrl, unwrapBingLink } from './bing';
export { createPublisherSource, matchesKeyword, PUBLISHER_PRESETS, type PublisherPreset } from './publishers';

export const DEFAULT_NEWS_SOURCE: NewsSourceId = 'google';

export const NEWS_SOURCES: readonly { id: NewsSourceId; label: string; description: string }[] = [
  { id: 'google', label: 'Google News', description: 'Search across thousands of outlets (default).' },
  { id: 'bing', label: 'Bing News', description: 'Microsoft Bing news search.' },
  { id: 'publishers', label: 'Publisher feeds', description: 'BBC, Al Jazeera, TechCrunch, The Verge, ESPN, Hacker News.' },
];

/** Returns a fresh source. Create one per digest run so publisher feeds are cached for that run only. */
export function getNewsSource(id: NewsSourceId, publisherPresetIds?: readonly string[]): NewsSource {
  switch (id) {
    case 'bing':
      return bingSource;
    case 'publishers':
      return createPublisherSource(publisherPresetIds);
    case 'google':
    default:
      return googleSource;
  }
}
