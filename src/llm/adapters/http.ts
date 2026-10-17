import { AppError, errorFromStatus } from '../../lib/errors';
import { fetchWithTimeout } from '../../lib/http';

export const LLM_TIMEOUT_MS = 90_000;

/**
 * POSTs JSON and returns the parsed response body. Throws AppError on non-2xx
 * (via errorFromStatus), network failure or a non-JSON body. Never includes the
 * key, request body or provider response in the error.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      },
      LLM_TIMEOUT_MS,
      signal,
    );
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof TypeError) throw new AppError('network');
    throw e; // AbortError from the caller's signal
  }
  if (!res.ok) throw errorFromStatus(res.status);
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new AppError('invalid_output');
  }
}
