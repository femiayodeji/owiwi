import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../src/lib/errors';
import { createProvider } from '../src/llm';
import type { ProviderConfig } from '../src/llm/types';

const KEY = 'sk-SECRET-123';
const fetchMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => ({ ok: false, status, json: async () => ({ error: `bad key ${KEY}` }) });

const cfg = (kind: ProviderConfig['kind'], extra: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  kind,
  label: 'P',
  baseUrl: null,
  model: 'm-1',
  isActive: true,
  ...extra,
});

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
const call = (i: number): Call => {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe('openai_compatible', () => {
  const p = () => createProvider(cfg('openai_compatible', { baseUrl: 'https://api.example.com/v1/' }), KEY);

  it('sends the right request and reads content', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '{"cards":[]}' } }] }));
    await expect(p().complete({ system: 'sys', user: 'usr' })).resolves.toBe('{"cards":[]}');
    const c = call(0);
    expect(c.url).toBe('https://api.example.com/v1/chat/completions');
    expect(c.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(c.body).toEqual({
      model: 'm-1',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ],
      response_format: { type: 'json_object' },
    });
  });

  it('reads array content parts', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }] }));
    await expect(p().complete({ system: 's', user: 'u' })).resolves.toBe('ab');
  });

  it('retries once without response_format on 400', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(400))
      .mockResolvedValueOnce(ok({ choices: [{ message: { content: 'hi' } }] }));
    await expect(p().complete({ system: 's', user: 'u' })).resolves.toBe('hi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(0).body.response_format).toBeDefined();
    expect(call(1).body.response_format).toBeUndefined();
  });

  it('does not retry a second 400', async () => {
    fetchMock.mockResolvedValue(fail(400));
    await expect(p().complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'bad_request' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps 401 to auth', async () => {
    fetchMock.mockResolvedValueOnce(fail(401));
    await expect(p().complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'auth', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a bad shape to invalid_output', async () => {
    fetchMock.mockResolvedValueOnce(ok({ nope: true }));
    await expect(p().complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'invalid_output' });
  });

  it('maps a network TypeError to network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(p().complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('anthropic', () => {
  const p = () => createProvider(cfg('anthropic'), KEY);

  it('sends the right request and joins text blocks', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }),
    );
    await expect(p().complete({ system: 'sys', user: 'usr' })).resolves.toBe('ab');
    const c = call(0);
    expect(c.url).toBe('https://api.anthropic.com/v1/messages');
    expect(c.headers['x-api-key']).toBe(KEY);
    expect(c.headers['anthropic-version']).toBe('2023-06-01');
    expect(c.headers['content-type']).toBe('application/json');
    expect(c.body).toEqual({
      model: 'm-1',
      max_tokens: 4096,
      system: 'sys',
      messages: [{ role: 'user', content: 'usr' }],
    });
  });

  it('passes maxTokens', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'a' }] }));
    await p().complete({ system: 's', user: 'u', maxTokens: 20 });
    expect(call(0).body.max_tokens).toBe(20);
  });
});

describe('gemini', () => {
  const p = () => createProvider(cfg('gemini', { model: 'gem/x' }), KEY);

  it('sends the right request and joins parts', async () => {
    fetchMock.mockResolvedValueOnce(ok({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }));
    await expect(p().complete({ system: 'sys', user: 'usr', maxTokens: 50 })).resolves.toBe('ab');
    const c = call(0);
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gem%2Fx:generateContent');
    expect(c.headers['x-goog-api-key']).toBe(KEY);
    expect(c.body).toEqual({
      systemInstruction: { parts: [{ text: 'sys' }] },
      contents: [{ role: 'user', parts: [{ text: 'usr' }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 50 },
    });
  });

  it('omits maxOutputTokens when not given', async () => {
    fetchMock.mockResolvedValueOnce(ok({ candidates: [{ content: { parts: [{ text: 'a' }] } }] }));
    await p().complete({ system: 's', user: 'u' });
    expect(call(0).body.generationConfig).toEqual({ responseMimeType: 'application/json' });
  });

  it('treats a blocked prompt as invalid_output', async () => {
    fetchMock.mockResolvedValueOnce(ok({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(p().complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'invalid_output' });
  });
});

describe('errors never leak the key', () => {
  const kinds: ProviderConfig['kind'][] = ['openai_compatible', 'anthropic', 'gemini'];
  it.each(kinds)('%s', async (kind: ProviderConfig['kind']) => {
    const provider = createProvider(cfg(kind, { baseUrl: 'https://api.example.com/v1' }), KEY);
    for (const status of [400, 401, 403, 429, 500]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(fail(status));
      const err: unknown = await provider.complete({ system: 's', user: 'u' }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).not.toContain(KEY);
      expect(String(err)).not.toContain(KEY);
    }
  });
});
