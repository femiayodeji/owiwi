import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { CompleteArgs, LLMProvider, ProviderConfig } from '../types';
import { postJson } from './http';

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
});

export function createGemini(config: ProviderConfig, apiKey: string): LLMProvider {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  const headers = { 'x-goog-api-key': apiKey };
  return {
    async complete({ system, user, signal, maxTokens }: CompleteArgs): Promise<string> {
      const json = await postJson(
        url,
        headers,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
          },
        },
        signal,
      );
      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) throw new AppError('invalid_output');
      // No candidates means the prompt was blocked or nothing was generated.
      const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? '').join('');
      if (!text.trim()) throw new AppError('invalid_output');
      return text;
    },
  };
}
