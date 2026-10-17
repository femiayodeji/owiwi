import { AppError } from './errors';

/**
 * fetch with a hard timeout. Aborts with AppError('timeout') when the timeout
 * fires, and also honours an outer AbortSignal.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
  outer?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener('abort', onOuterAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (timedOut) throw new AppError('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}
