import { createAnthropic } from './adapters/anthropic';
import { createGemini } from './adapters/gemini';
import { createOpenAICompatible } from './adapters/openaiCompatible';
import type { LLMProvider, ProviderConfig } from './types';

export function createProvider(config: ProviderConfig, apiKey: string): LLMProvider {
  switch (config.kind) {
    case 'openai_compatible':
      return createOpenAICompatible(config, apiKey);
    case 'anthropic':
      return createAnthropic(config, apiKey);
    case 'gemini':
      return createGemini(config, apiKey);
  }
}

export * from './types';
export * from './defaultModels';
export * from './presets';
export * from './prompt';
export * from './schema';
export * from './validate';
export * from './testConnection';
export { createAnthropic, createGemini, createOpenAICompatible };
