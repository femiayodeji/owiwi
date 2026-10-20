import { isAbortError } from '../lib/errors';
import { mapWithConcurrency } from '../lib/pool';
import { dedupeArticles } from './dedupe';
import type { Article, KeywordInput, Locale, NewsSource } from './types';

export interface CollectOpts {
  locale: Locale;
  signal?: AbortSignal;
  perKeyword?: number;
  total?: number;
  concurrency?: number;
  /** Drops items before the per-keyword and total caps (e.g. stories already seen). */
  exclude?: (a: Article) => boolean;
}

export interface CollectResult {
  articles: Article[]; // grouped by keyword, in keyword order
  failedKeywords: string[]; // labels
  excluded: number; // items dropped by opts.exclude
}

/** Picks up to `total` items round-robin across groups so no group eats the budget. Keeps group order. */
export function capFairly<T>(groups: readonly T[][], total: number): T[][] {
  const taken = groups.map(() => 0);
  let left = Math.max(0, total);
  for (let round = 0; left > 0; round++) {
    let progressed = false;
    for (let g = 0; g < groups.length && left > 0; g++) {
      if (round < groups[g].length) {
        taken[g]++;
        left--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return groups.map((items, g) => items.slice(0, taken[g]));
}

/**
 * Fetches every keyword (bounded concurrency), tolerates per-keyword failures,
 * dedupes across keywords and caps the total fairly.
 */
export async function collectArticles(
  keywords: readonly KeywordInput[],
  source: NewsSource,
  opts: CollectOpts,
): Promise<CollectResult> {
  const perKeyword = opts.perKeyword ?? 15;
  const total = opts.total ?? 60;
  const failedKeywords: string[] = [];
  const exclude = opts.exclude;
  let excluded = 0;

  const fetched = await mapWithConcurrency(keywords, opts.concurrency ?? 3, async (kw) => {
    if (opts.signal?.aborted) return [];
    try {
      // Over-fetch when excluding so seen stories don't eat the per-keyword budget.
      const limit = exclude ? perKeyword * 2 : perKeyword;
      const items = await source.fetch(kw, { locale: opts.locale, signal: opts.signal, limit });
      const kept = exclude ? items.filter((a) => !exclude(a)) : items;
      excluded += items.length - kept.length;
      return kept.slice(0, perKeyword).map((a) => ({ ...a, keywordLabel: kw.label }));
    } catch (e) {
      if (!(opts.signal?.aborted && isAbortError(e))) failedKeywords.push(kw.label);
      return [];
    }
  });
  if (opts.signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }

  // Dedupe across keywords (earlier keywords win), remembering each item's group.
  const groupOf = new Map<Article, number>();
  fetched.forEach((items, g) => items.forEach((a) => groupOf.set(a, g)));
  const unique = dedupeArticles(fetched.flat());
  const groups: Article[][] = keywords.map(() => []);
  for (const a of unique) groups[groupOf.get(a) ?? 0].push(a);

  // Report failures in keyword order regardless of completion order.
  const failed = new Set(failedKeywords);
  return {
    articles: capFairly(groups, total).flat(),
    failedKeywords: keywords.map((k) => k.label).filter((l) => failed.has(l)),
    excluded,
  };
}
