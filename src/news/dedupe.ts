import type { Article } from './types';

const TRACKING = /^(utm_.*|fbclid|gclid|ocid|mc_cid|mc_eid|cmpid|at_medium|at_campaign|traffic_source)$/i;

/** Canonical form of a URL for duplicate detection (not for opening). */
export function normalizeUrl(url: string): string {
  const raw = url.trim();
  const m = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i.exec(raw);
  if (!m) return raw.toLowerCase();
  const host = m[2].toLowerCase().replace(/^www\./, '');
  let path = m[3] || '/';
  const query = m[4] ? m[4].slice(1) : '';
  // Google News redirect paths are the article id; keep them intact apart from host/hash.
  if (host === 'news.google.com') return `https://${host}${path}${query ? `?${query}` : ''}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const kept = query
    .split('&')
    .filter((p) => p && !TRACKING.test(p.split('=')[0]))
    .sort();
  return `https://${host}${path}${kept.length ? `?${kept.join('&')}` : ''}`;
}

/** Lowercase, drop " - Publisher" suffix and punctuation, collapse spaces. */
export function normalizeTitle(title: string): string {
  let t = title.toLowerCase();
  const i = t.lastIndexOf(' - ');
  if (i > 0) t = t.slice(0, i);
  return t
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const TITLE_SIMILARITY = 0.85;

/** Removes duplicates by URL, then near-identical titles. Keeps the first occurrence. */
export function dedupeArticles(articles: readonly Article[]): Article[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const tokenSets: Set<string>[] = [];
  const out: Article[] = [];
  for (const a of articles) {
    const u = normalizeUrl(a.url);
    if (seenUrls.has(u)) continue;
    const t = normalizeTitle(a.title);
    if (t && seenTitles.has(t)) continue;
    const tokens = new Set(t.split(' ').filter(Boolean));
    if (tokens.size && tokenSets.some((s) => jaccard(s, tokens) >= TITLE_SIMILARITY)) continue;
    seenUrls.add(u);
    if (t) seenTitles.add(t);
    if (tokens.size) tokenSets.push(tokens);
    out.push(a);
  }
  return out;
}
