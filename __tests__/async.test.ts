import { coalesce, TimeoutError, withTimeout } from '../src/lib/async';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

describe('withTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'x')).resolves.toBe(42);
  });

  it('passes through rejections', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'x')).rejects.toThrow('boom');
  });

  it('rejects with TimeoutError when the promise never settles', async () => {
    jest.useFakeTimers();
    const p = withTimeout(new Promise<never>(() => undefined), 500, 'open database');
    jest.advanceTimersByTime(500);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    await expect(p).rejects.toThrow('open database timed out after 500ms');
  });

  it('clears its timer once settled', async () => {
    jest.useFakeTimers();
    await withTimeout(Promise.resolve(1), 500, 'x');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('coalesce', () => {
  it('never runs two passes at once and shares the in-flight promise', async () => {
    let running = 0;
    let maxRunning = 0;
    let calls = 0;
    const gates: ReturnType<typeof deferred>[] = [];
    const run = coalesce(async () => {
      calls++;
      running++;
      maxRunning = Math.max(maxRunning, running);
      const g = deferred();
      gates.push(g);
      await g.promise;
      running--;
    });

    const a = run();
    const b = run();
    const c = run();
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(calls).toBe(1);

    gates[0].resolve();
    await flush();
    // Calls made during the first pass collapse into exactly one trailing pass.
    expect(calls).toBe(2);
    gates[1].resolve();
    await a;
    expect(calls).toBe(2);
    expect(maxRunning).toBe(1);
  });

  it('runs once when nothing overlaps, and starts fresh afterwards', async () => {
    const fn = jest.fn(() => Promise.resolve());
    const run = coalesce(fn);
    await run();
    expect(fn).toHaveBeenCalledTimes(1);
    await run();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiter on failure and recovers on the next call', async () => {
    const g = deferred();
    let fail = true;
    const run = coalesce(async () => {
      if (fail) {
        await g.promise;
        throw new Error('nope');
      }
    });
    const a = run();
    const b = run();
    g.resolve();
    await expect(a).rejects.toThrow('nope');
    await expect(b).rejects.toThrow('nope');
    fail = false;
    await expect(run()).resolves.toBeUndefined();
  });
});
