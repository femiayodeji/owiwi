// User-facing errors. Messages must be friendly and actionable, and must never
// contain API keys, request bodies or raw provider responses.

export type AppErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'bad_request'
  | 'server'
  | 'invalid_output'
  | 'no_provider'
  | 'no_key'
  | 'no_keywords'
  | 'busy'
  | 'unknown';

const MESSAGES: Record<AppErrorKind, string> = {
  auth: 'Your API key was rejected. Check it in Settings.',
  rate_limit: 'Your provider is rate limiting requests. Wait a minute and try again.',
  network: "Couldn't reach the network. Check your connection and try again.",
  timeout: 'The request took too long. Try again.',
  bad_request: 'Your provider rejected the request. Check the model name in Settings.',
  server: 'Your provider is having trouble right now. Try again shortly.',
  invalid_output: "The model's answer couldn't be read. Try again, or pick another model.",
  no_provider: 'Add an LLM provider in Settings to build your digest.',
  no_key: 'Your provider has no API key. Add one in Settings.',
  no_keywords: 'Turn on at least one keyword in Settings.',
  busy: 'Your digest is already being prepared.',
  unknown: 'Something went wrong. Try again.',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;

  constructor(kind: AppErrorKind, message?: string, status?: number) {
    super(message ?? MESSAGES[kind]);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
  }
}

export function errorFromStatus(status: number): AppError {
  if (status === 401 || status === 403) return new AppError('auth', undefined, status);
  if (status === 429) return new AppError('rate_limit', undefined, status);
  if (status >= 500) return new AppError('server', undefined, status);
  return new AppError('bad_request', undefined, status);
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

/** Turns anything thrown into a safe, friendly message. */
export function friendlyMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  if (isAbortError(e)) return MESSAGES.timeout;
  if (e instanceof TypeError) return MESSAGES.network; // fetch network failures
  return MESSAGES.unknown;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (isAbortError(e)) return new AppError('timeout');
  if (e instanceof TypeError) return new AppError('network');
  return new AppError('unknown');
}
