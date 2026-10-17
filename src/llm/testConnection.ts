import { toAppError } from '../lib/errors';
import type { LLMProvider } from './types';

export type TestConnectionResult = { ok: true } | { ok: false; message: string };

const TEST_MESSAGES: Partial<Record<string, string>> = {
  auth: 'Your API key was rejected. Check that you pasted the whole key and that it is active.',
  rate_limit: 'Your provider is rate limiting this key (or it is out of credit). Wait a minute, or check your plan.',
  network: "Couldn't reach the provider. Check your connection and the base URL.",
  timeout: 'The provider took too long to answer. Try again.',
  bad_request: 'The provider rejected the request. Check the model name and base URL.',
};

/** Tiny completion to check the key, model and endpoint. Never throws. */
export async function testConnection(
  provider: LLMProvider,
  signal?: AbortSignal,
): Promise<TestConnectionResult> {
  try {
    const reply = await provider.complete({
      system: 'Reply with the JSON object {"ok":true} and nothing else.',
      user: 'ping',
      // Generous cap: thinking models (e.g. Gemini) can spend a tiny budget before answering.
      maxTokens: 1024,
      signal,
    });
    if (reply.trim()) return { ok: true };
    return { ok: false, message: 'The provider answered with an empty reply. Try another model.' };
  } catch (e) {
    const err = toAppError(e);
    return { ok: false, message: TEST_MESSAGES[err.kind] ?? err.message };
  }
}
