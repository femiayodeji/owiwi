export type NewsSourceId = 'google' | 'bing' | 'publishers';

/** One RSS item, normalized. All text is untrusted plain text. */
export interface Article {
  keywordLabel: string;
  title: string;
  snippet: string | null; // HTML stripped, <= ~300 chars
  source: string | null; // publisher name
  url: string;
  publishedAt: string | null; // ISO 8601
}

export interface KeywordInput {
  label: string;
  query: string;
}

export interface Locale {
  lang: string; // e.g. "en"
  country: string; // e.g. "NG"
}

export interface FetchOpts {
  locale: Locale;
  signal?: AbortSignal;
  /** Max items to return for this keyword. */
  limit?: number;
}

export interface NewsSource {
  id: NewsSourceId;
  label: string;
  fetch(keyword: KeywordInput, opts: FetchOpts): Promise<Article[]>;
}
