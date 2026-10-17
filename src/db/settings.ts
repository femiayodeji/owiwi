import { z } from 'zod';
import type { Db } from './client';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const SettingsSchema = z.object({
  morning_time: time.default('07:00'),
  evening_time: time.default('19:00'),
  cards_per_digest: z.coerce.number().int().min(5).max(10).default(10),
  rss_provider: z.enum(['google', 'bing', 'publishers']).default('google'),
  locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('en-NG'), // <lang>-<COUNTRY>
  nudge_enabled: z.enum(['0', '1']).default('1'),
  nudge_time: time.default('21:30'),
  onboarded: z.enum(['0', '1']).default('0'),
  theme_mode: z.enum(['system', 'light', 'dark', 'reading']).default('system'),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Parses raw key/value rows. Invalid values fall back to their defaults. */
export function parseSettings(rows: readonly { key: string; value: string }[]): Settings {
  const raw: Record<string, string> = {};
  for (const r of rows) raw[r.key] = r.value;
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(SettingsSchema.shape) as SettingKey[]) {
    if (raw[key] === undefined) continue;
    const parsed = SettingsSchema.shape[key].safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as Settings;
}

export function parseLocale(locale: string): { lang: string; country: string } {
  const [lang, country] = locale.split('-');
  return { lang: lang || 'en', country: country || 'NG' };
}

export async function loadSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return parseSettings(rows);
}

export async function saveSettings(db: Db, patch: Partial<Settings>): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      const parsed = SettingsSchema.shape[key as SettingKey].parse(value);
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        String(parsed),
      );
    }
  });
}
