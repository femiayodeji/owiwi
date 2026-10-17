import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { CompleteArgs, LLMProvider, ProviderConfig } from '../types';
import { postJson } from './http';

const ResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(z.object({ text: z.string().optional() })),
            z.null(),
          ]),
        }),
      }),
    )
    .min(1),
});

export function createOpenAICompatible(config: ProviderConfig, apiKey: string): LLMProvider {
  const base = (config.baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) throw new AppError('bad_request', 'This provider needs a base URL. Add one in Settings.');
  const url = `${base}/chat/completions`;
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Remembers that this endpoint rejected response_format, so we don't retry every call.
  let jsonModeSupported = true;

  return {
    async complete({ system, user, signal }: CompleteArgs): Promise<string> {
      // No temperature / max_tokens: newer OpenAI models reject them.
      const body = {
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
      let json: unknown;
      if (jsonModeSupported) {
        try {
          json = await postJson(url, headers, { ...body, response_format: { type: 'json_object' } }, signal);
        } catch (e) {
          if (!(e instanceof AppError) || e.status !== 400) throw e;
          jsonModeSupported = false;
          json = await postJson(url, headers, body, signal);
        }
      } else {
        json = await postJson(url, headers, body, signal);
      }

      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) throw new AppError('invalid_output');
      const content = parsed.data.choices[0].message.content;
      const text =
        typeof content === 'string'
          ? content
          : (content ?? []).map((p) => p.text ?? '').join('');
      if (!text.trim()) throw new AppError('invalid_output');
      return text;
    },
  };
}
