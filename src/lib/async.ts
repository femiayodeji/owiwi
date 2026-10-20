// Small promise helpers for the boot path and other calls that must never pile up or hang.

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/** Rejects with TimeoutError if `promise` hasn't settled within `ms`. The underlying work is not cancelled. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Wraps `fn` so at most one run is in flight. A call made during a run doesn't
 * start a second, parallel run: it marks the work dirty and shares the current
 * promise, which runs `fn` once more before settling (so the caller still sees
 * fresh state). Any number of overlapping calls collapse into one trailing run.
 * A failing pass rejects every waiter and drops the pending rerun.
 */
export function coalesce(fn: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let dirty = false;
  return () => {
    if (inFlight) {
      dirty = true;
      return inFlight;
    }
    inFlight = (async () => {
      try {
        do {
          dirty = false;
          await fn();
        } while (dirty);
      } finally {
        inFlight = null;
        dirty = false;
      }
    })();
    return inFlight;
  };
}
