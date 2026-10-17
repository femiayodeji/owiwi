// The ONLY place model IDs live. Suggested cheap/free defaults; the user can edit them.
// Verified against each provider's docs/APIs on 2026-10-17.
// Re-verify before shipping: model IDs get renamed and retired often.

export type PresetId = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'groq' | 'custom';

export const DEFAULT_MODELS: Record<PresetId, string> = {
  openai: 'gpt-6-luna', // cheapest text model, developers.openai.com/api/docs/models
  anthropic: 'claude-haiku-5-5',
  gemini: 'gemini-3.5-flash-lite', // stable Flash-Lite, ai.google.dev/gemini-api/docs/models
  openrouter: 'google/gemma-4-31b-it:free', // listed with :free in openrouter.ai/api/v1/models
  groq: 'llama-3.3-70b-versatile', // Groq production model
  custom: '', // user enters
};

export interface SuggestedModel {
  id: string;
  label: string;
  note?: string;
}

/**
 * Model picker options per preset, default (DEFAULT_MODELS[preset]) first.
 * Verified 2026-10-17 from provider docs/APIs. Re-verify before shipping; do not add IDs from memory.
 */
export const SUGGESTED_MODELS: Record<PresetId, readonly SuggestedModel[]> = {
  openai: [
    { id: 'gpt-6-luna', label: 'Luna', note: 'Cheapest' },
    { id: 'gpt-6.1-sol', label: 'Sol', note: 'Balanced' },
    { id: 'gpt-6-astra', label: 'Astra', note: 'Most capable, pricey' },
  ],
  anthropic: [
    { id: 'claude-haiku-5-5', label: 'Haiku 5.5', note: 'Fast and cheap' },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'Balanced' },
    { id: 'claude-opus-5-5', label: 'Opus 5.5', note: 'Most capable' },
  ],
  gemini: [
    { id: 'gemini-3.5-flash-lite', label: 'Flash-Lite 3.5' },
    { id: 'gemini-3.1-flash-lite', label: 'Flash-Lite 3.1' },
    { id: 'gemini-3.6-flash', label: 'Flash 3.6' },
    { id: 'gemini-3.8-flash', label: 'Flash 3.8' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: 'Most capable' },
  ],
  openrouter: [
    { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', note: 'Free' },
    { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B', note: 'Free' },
    { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna' },
    { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
    { id: 'google/gemini-3.5-flash-lite', label: 'Gemini Flash-Lite 3.5' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', note: 'Fastest' },
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  ],
  custom: [], // free text only
};
