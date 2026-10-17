import { describe, expect, it } from '@jest/globals';
import type { Article } from '../src/news/types';
import { buildSystemPrompt, buildUserPrompt } from '../src/llm/prompt';

const art = (keywordLabel: string, url: string): Article => ({
  keywordLabel,
  title: `t ${url}`,
  snippet: 's',
  source: 'src',
  url,
  publishedAt: '2026-10-17T07:00:00Z',
});

describe('buildSystemPrompt', () => {
  it('fills N and slot', () => {
    const s = buildSystemPrompt(7, 'evening');
    expect(s).toContain('Pick the 7 most');
    expect(s).toContain('this evening digest');
    expect(s).toContain('fewer than 7 is fine');
    expect(s).not.toMatch(/\{N\}|\{slot\}/);
  });
});

describe('buildUserPrompt', () => {
  const articles = [art('AI', 'u1'), art('Football', 'u2'), art('AI', 'u3')];

  it('groups by keyword in first-seen order', () => {
    const p = JSON.parse(buildUserPrompt({ slot: 'morning', n: 10, articles, alreadyShown: ['x'] }));
    expect(p.slot).toBe('morning');
    expect(p.max_cards).toBe(10);
    expect(p.topics.map((t: { topic: string }) => t.topic)).toEqual(['AI', 'Football']);
    expect(p.topics[0].articles.map((a: { url: string }) => a.url)).toEqual(['u1', 'u3']);
    expect(p.topics[0].articles[0]).toEqual({
      title: 't u1',
      snippet: 's',
      source: 'src',
      url: 'u1',
      published_at: '2026-10-17T07:00:00Z',
    });
    expect(p.already_shown).toEqual([]);
  });

  it('includes already_shown for evening', () => {
    const p = JSON.parse(buildUserPrompt({ slot: 'evening', n: 5, articles, alreadyShown: ['Morning story'] }));
    expect(p.already_shown).toEqual(['Morning story']);
  });
});
