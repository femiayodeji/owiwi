import { DEFAULT_MODELS, type PresetId } from './defaultModels';
import type { ProviderKind } from './types';

export interface ProviderPreset {
  id: PresetId;
  label: string;
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
    kind: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: DEFAULT_MODELS.openai,
    keyHint: 'platform.openai.com/api-keys',
    baseUrlEditable: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.anthropic,
    keyHint: 'console.anthropic.com/settings/keys',
    baseUrlEditable: false,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    kind: 'gemini',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.gemini,
    keyHint: 'aistudio.google.com/apikey',
    baseUrlEditable: false,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: DEFAULT_MODELS.openrouter,
    keyHint: 'openrouter.ai/keys',
    baseUrlEditable: false,
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: DEFAULT_MODELS.groq,
    keyHint: 'console.groq.com/keys',
    baseUrlEditable: false,
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    kind: 'openai_compatible',
    baseUrl: '',
    defaultModel: DEFAULT_MODELS.custom,
    keyHint: "Your provider's dashboard",
    baseUrlEditable: true,
  },
];

export function getPreset(id: PresetId): ProviderPreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}
