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
