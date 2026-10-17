import { describe, expect, it } from '@jest/globals';
import { AppError } from '../src/lib/errors';
import { RETRY_NUDGE } from '../src/llm/prompt';
import { testConnection } from '../src/llm/testConnection';
import type { CompleteArgs, LLMProvider } from '../src/llm/types';
import { generateCards } from '../src/llm/validate';

const GOOD = JSON.stringify({ cards: [{ title: 'T', summary: 'S', url: 'https://a.com/1' }] });
const args = { system: 'sys', user: 'usr', allowedUrls: new Set(['https://a.com/1']), max: 10 };

function fake(...replies: (string | Error)[]): LLMProvider & { calls: CompleteArgs[] } {
  const calls: CompleteArgs[] = [];
  return {
    calls,
    async complete(a: CompleteArgs) {
      calls.push(a);
      const r = replies.shift();
      if (r === undefined) throw new Error('unexpected call');
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

describe('generateCards', () => {
  it('returns cards on the first try', async () => {
    const p = fake(GOOD);
    await expect(generateCards(p, args)).resolves.toEqual({
      cards: [expect.objectContaining({ url: 'https://a.com/1' })],
      dropped: 0,
    });
    expect(p.calls).toHaveLength(1);
  });

  it('retries once with the nudge, then succeeds', async () => {
    const p = fake('sorry, here you go: {broken', GOOD);
    const r = await generateCards(p, args);
    expect(r.cards).toHaveLength(1);
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].user).toBe(`usr\n\n${RETRY_NUDGE}`);
  });

  it('throws invalid_output when the retry also fails', async () => {
    const p = fake('nope', '{"cards":"x"}');
    await expect(generateCards(p, args)).rejects.toMatchObject({ kind: 'invalid_output' });
    expect(p.calls).toHaveLength(2);
  });

  it('does not retry provider errors', async () => {
    const p = fake(new AppError('rate_limit', undefined, 429), GOOD);
    await expect(generateCards(p, args)).rejects.toMatchObject({ kind: 'rate_limit' });
    expect(p.calls).toHaveLength(1);
  });
});

describe('testConnection', () => {
  it('is ok on any non-empty reply', async () => {
    const p = fake('{"ok":true}');
    await expect(testConnection(p)).resolves.toEqual({ ok: true });
    expect(p.calls[0]).toMatchObject({ user: 'ping', maxTokens: 1024 });
  });

  it('gives clear messages for auth, rate limit and network', async () => {
    const auth = await testConnection(fake(new AppError('auth', undefined, 401)));
    const rate = await testConnection(fake(new AppError('rate_limit', undefined, 429)));
    const net = await testConnection(fake(new TypeError('Network request failed')));
    expect(auth).toEqual({ ok: false, message: expect.stringMatching(/key was rejected/) });
    expect(rate).toEqual({ ok: false, message: expect.stringMatching(/rate limiting/) });
    expect(net).toEqual({ ok: false, message: expect.stringMatching(/Couldn't reach/) });
  });
});
