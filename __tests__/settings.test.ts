import { DEFAULT_SETTINGS, parseLocale, parseSettings } from '../src/db/settings';

describe('settings', () => {
  it('has the documented defaults', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      morning_time: '07:00',
      evening_time: '19:00',
      cards_per_digest: 10,
      rss_provider: 'google',
      locale: 'en-NG',
      nudge_time: '21:30',
    });
  });
  it('parses stored values and falls back on invalid ones', () => {
    const s = parseSettings([
      { key: 'evening_time', value: '20:15' },
      { key: 'cards_per_digest', value: '7' },
      { key: 'morning_time', value: '25:99' },
      { key: 'rss_provider', value: 'newsapi' },
    ]);
    expect(s.evening_time).toBe('20:15');
    expect(s.cards_per_digest).toBe(7);
    expect(s.morning_time).toBe('07:00');
    expect(s.rss_provider).toBe('google');
  });
  it('splits locales', () => {
    expect(parseLocale('fr-SN')).toEqual({ lang: 'fr', country: 'SN' });
  });
});

describe('theme', () => {
  it('defaults to system and resolves modes', () => {
    const { resolveTheme } = require('../src/lib/theme') as typeof import('../src/lib/theme');
    expect(DEFAULT_SETTINGS.theme_mode).toBe('system');
    expect(resolveTheme('system', 'dark').name).toBe('dark');
    expect(resolveTheme('system', null).name).toBe('light');
    expect(resolveTheme('reading', 'dark').name).toBe('reading');
    expect(parseSettings([{ key: 'theme_mode', value: 'neon' }]).theme_mode).toBe('system');
  });
});
