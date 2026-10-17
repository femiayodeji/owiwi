export type ProviderKind = 'openai_compatible' | 'anthropic' | 'gemini';

/** Non-secret provider config, as stored in SQLite. The key lives in SecureStore. */
export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string | null;
  model: string;
  isActive: boolean;
}

export interface CompleteArgs {
  system: string;
  user: string;
  signal?: AbortSignal;
  /** Upper bound on output tokens (used where the API requires it). */
  maxTokens?: number;
}

export interface LLMProvider {
  /** Returns the raw text of the model's reply. Throws AppError on HTTP/network failure. */
  complete(args: CompleteArgs): Promise<string>;
}

export type Slot = 'morning' | 'evening';

/** A validated card produced by the LLM (before being persisted). */
export interface CardDraft {
  title: string;
  summary: string;
  topic: string | null;
  source: string | null;
  url: string;
  publishedAt: string | null;
}
