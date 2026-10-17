import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { CompleteArgs, LLMProvider, ProviderConfig } from '../types';
import { postJson } from './http';

const URL = 'https://api.anthropic.com/v1/messages';

const ResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export function createAnthropic(config: ProviderConfig, apiKey: string): LLMProvider {
  const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  return {
    async complete({ system, user, signal, maxTokens }: CompleteArgs): Promise<string> {
      const json = await postJson(
        URL,
        headers,
        {
          model: config.model,
          max_tokens: maxTokens ?? 4096,
          system,
          messages: [{ role: 'user', content: user }],
        },
        signal,
      );
      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) throw new AppError('invalid_output');
      const text = parsed.data.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (!text.trim()) throw new AppError('invalid_output');
      return text;
    },
  };
}
