import { DEFAULT_MODELS, type PresetId } from './defaultModels';
import type { ProviderKind } from './types';

export interface ProviderPreset {
  id: PresetId;
  label: string;
  /** One-line picker description. Keep it generic; no unverifiable claims. */
  description: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string;
  /** Where to get a key. */
  keyHint: string;
  baseUrlEditable: boolean;
}

export const PRESETS: readonly ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models from OpenAI',
    kind: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: DEFAULT_MODELS.openai,
    keyHint: 'platform.openai.com/api-keys',
    baseUrlEditable: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models from Anthropic',
    kind: 'anthropic',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.anthropic,
    keyHint: 'console.anthropic.com/settings/keys',
    baseUrlEditable: false,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: "Google's Gemini models",
    kind: 'gemini',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.gemini,
    keyHint: 'aistudio.google.com/apikey',
    baseUrlEditable: false,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Many vendors, one key. Has free options',
    kind: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: DEFAULT_MODELS.openrouter,
    keyHint: 'openrouter.ai/keys',
    baseUrlEditable: false,
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast open models. Has free options',
    kind: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: DEFAULT_MODELS.groq,
    keyHint: 'console.groq.com/keys',
    baseUrlEditable: false,
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    description: 'Any OpenAI-compatible API (base URL)',
    kind: 'openai_compatible',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.custom,
    keyHint: "Your provider's dashboard",
    baseUrlEditable: true,
  },
];

/** Preset pre-selected for a new provider: Gemini, for its generous free tier and cheap default model. */
export const DEFAULT_PRESET_ID: PresetId = 'gemini';

export function getPreset(id: PresetId): ProviderPreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}
