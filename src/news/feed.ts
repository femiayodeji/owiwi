import { AppError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/http';
import { parseFeed, type RawItem } from './parse';

export const FEED_TIMEOUT_MS = 10_000;

/** Downloads and parses one RSS/Atom feed. Throws AppError on HTTP failure. */
export async function fetchFeed(url: string, signal?: AbortSignal): Promise<RawItem[]> {
  const res = await fetchWithTimeout(
    url,
    { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' } },
    FEED_TIMEOUT_MS,
    signal,
  );
  if (!res.ok) throw new AppError('network', "Couldn't load headlines right now. Try again shortly.", res.status);
  return parseFeed(await res.text());
}
