import { describe, expect, it } from '@jest/globals';
import { extractJson, parseCards } from '../src/llm/validate';

const allowed = new Set(['https://a.com/1', 'https://b.com/2/', 'https://c.com/3']);
const card = (url: string, extra: Record<string, unknown> = {}) => ({
  title: 'T',
  summary: 'S',
  topic: 'AI',
  source: 'Src',
  url,
  published_at: null,
  ...extra,
});
const reply = (cards: unknown[]) => JSON.stringify({ cards });

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('ignores prose around the object', () => {
    expect(extractJson('Sure! Here it is: {"a":{"b":2}} Hope this helps.')).toEqual({ a: { b: 2 } });
  });
  it('throws on invalid JSON', () => {
    expect(() => extractJson('{"a":')).toThrow();
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parseCards', () => {
  it('maps fields and fills nulls', () => {
    const r = parseCards(reply([{ title: ' Hi ', summary: 'S', url: 'https://a.com/1' }]), allowed, 10);
    expect(r).toEqual({
      ok: true,
      dropped: 0,
      cards: [{ title: 'Hi', summary: 'S', topic: null, source: null, url: 'https://a.com/1', publishedAt: null }],
    });
  });

  it('drops hallucinated urls', () => {
    const r = parseCards(reply([card('https://a.com/1'), card('https://evil.com/x')]), allowed, 10);
    expect(r.ok && r.cards.map((c) => c.url)).toEqual(['https://a.com/1']);
    expect(r.ok && r.dropped).toBe(1);
  });

  it('matches urls ignoring a trailing slash and returns the input url', () => {
    const r = parseCards(reply([card('https://a.com/1/'), card('https://b.com/2')]), allowed, 10);
    expect(r.ok && r.cards.map((c) => c.url)).toEqual(['https://a.com/1', 'https://b.com/2/']);
  });

  it('returns ok with no cards when all are dropped', () => {
    expect(parseCards(reply([card('https://x.com')]), allowed, 10)).toEqual({ ok: true, cards: [], dropped: 1 });
  });

  it('dedupes by url and caps at max', () => {
    const r = parseCards(
      reply([card('https://a.com/1'), card('https://a.com/1/'), card('https://b.com/2/'), card('https://c.com/3')]),
      allowed,
      2,
    );
    expect(r.ok && r.cards.map((c) => c.url)).toEqual(['https://a.com/1', 'https://b.com/2/']);
  });

  it('truncates long titles to 90 chars', () => {
    const r = parseCards(reply([card('https://a.com/1', { title: 'x'.repeat(200) })]), allowed, 10);
    expect(r.ok && r.cards[0].title.length).toBe(90);
  });

  it('fails on invalid JSON or schema', () => {
    expect(parseCards('not json', allowed, 10).ok).toBe(false);
    expect(parseCards('{"items":[]}', allowed, 10).ok).toBe(false);
    expect(parseCards(reply([card('https://a.com/1', { summary: '  ' })]), allowed, 10).ok).toBe(false);
  });
});
