# Data model

All persistent data is on the device:

- **SQLite** (`expo-sqlite`, database file `owiwi.db`): keywords, provider config, digests, articles, cards, streak days, settings.
- **SecureStore** (`expo-secure-store`): API keys only.

## Opening the database

`getDb()` in `src/db/client.ts` opens `owiwi.db` once per process, sets `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` (required for the cascading deletes), runs migrations and caches the handle. If opening fails, the cached promise is cleared so the next call retries.

## Migrations

`src/db/migrations.ts` holds `MIGRATIONS`, an append-only array of SQL strings. Index `i` is migration version `i + 1`.

`runMigrations(db)` reads `PRAGMA user_version`, and for each pending migration runs:

```sql
BEGIN; <migration sql>; PRAGMA user_version = <n>; COMMIT;
```

so each migration and its version bump are applied atomically. The current schema version is 1. Never edit a shipped migration; add a new entry instead (see [development.md](development.md#adding-a-migration)).

## Schema (version 1)

```sql
CREATE TABLE keywords (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,          -- shown to the user
  query TEXT NOT NULL,          -- sent to the news source
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE providers (        -- non-secret config only
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- 'openai_compatible' | 'anthropic' | 'gemini'
  label TEXT NOT NULL,
  base_url TEXT,                -- openai_compatible only
  model TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE digests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,           -- local YYYY-MM-DD
  slot TEXT NOT NULL CHECK (slot IN ('morning','evening')),
  status TEXT NOT NULL CHECK (status IN ('generating','ready','failed')),
  provider_id TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,  -- also reset when a (re)generation starts
  UNIQUE (date, slot)
);

CREATE TABLE articles (         -- raw RSS input, kept for the day
  id TEXT PRIMARY KEY,
  digest_id TEXT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  keyword_label TEXT,
  title TEXT NOT NULL,
  snippet TEXT,
  source TEXT,
  url TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX articles_digest ON articles(digest_id);

CREATE TABLE cards (            -- LLM output, what the user swipes
  id TEXT PRIMARY KEY,
  digest_id TEXT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  topic TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT,
  url TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX cards_digest ON cards(digest_id, position);

CREATE TABLE streak_days (
  date TEXT PRIMARY KEY,        -- local YYYY-MM-DD
  slot TEXT NOT NULL,           -- slot that completed the day
  completed_at INTEGER NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

IDs are UUIDs from `expo-crypto` (`newId()` in `src/lib/ids.ts`). Timestamps (`created_at`, `completed_at`) are epoch milliseconds. `published_at` is an ISO 8601 string or null.

## Invariants and where they are enforced

| Rule | Enforced in |
|---|---|
| At most 8 enabled keywords | `addKeyword` (new keyword starts disabled at the cap), `setKeywordEnabled` (returns `false`) in `src/db/queries.ts`; `MAX_ENABLED_KEYWORDS` |
| Exactly one active provider (when any exist) | `saveProvider` (first provider becomes active), `setActiveProvider`, `deleteProvider` (promotes another) |
| One digest per `(date, slot)` | `UNIQUE (date, slot)`; `beginDigest` reuses the existing row |
| Articles and cards written atomically with `status = 'ready'` | `completeDigest` (single transaction) |
| Streak day recorded once per date | `recordStreakDay` uses `INSERT OR IGNORE` |
| Keyword reorder is atomic | `reorderKeywords` (transaction) |

## Retention

`wipeStale(db, today)` in `src/digest/retention.ts` runs `DELETE FROM digests WHERE date < ?`. Articles and cards go with their digest through `ON DELETE CASCADE`. `keywords`, `providers`, `settings` and `streak_days` are never touched. It is called from `useFeed.refresh()` (launch and every foreground) and at the start of `generateDigest()`.

## Settings

Stored as text rows in `settings`. Defined and validated by `SettingsSchema` (zod) in `src/db/settings.ts`. `parseSettings()` falls back to the default for any missing or invalid value; `saveSettings()` validates before writing, in one transaction.

| Key | Type / format | Default | Meaning |
|---|---|---|---|
| `morning_time` | `HH:MM` (24h) | `07:00` | Morning slot and reminder time |
| `evening_time` | `HH:MM` | `19:00` | Evening slot start and reminder time |
| `cards_per_digest` | integer 5 to 10 | `10` | Max cards per digest |
| `rss_provider` | `google` \| `bing` \| `publishers` | `google` | Active news source |
| `locale` | `<lang>-<COUNTRY>`, e.g. `en-NG` | `en-NG` | Google/Bing language and region (`parseLocale()` splits it) |
| `nudge_enabled` | `'0'` \| `'1'` | `'1'` | Streak-saver nudge on/off |
| `nudge_time` | `HH:MM` | `21:30` | Streak-saver nudge time |
| `onboarded` | `'0'` \| `'1'` | `'0'` | Not in the original spec. Set to `'1'` when onboarding finishes; the feed redirects to `/onboarding` and auto-generation is skipped until then. |

The settings screen also rejects a morning time that is not earlier than the evening time.

## SecureStore (API keys)

`src/lib/secureStore.ts` is the only code that reads or writes keys: `getApiKey`, `setApiKey` (trims the key), `deleteApiKey`, `hasApiKey`.

**Key naming: `apikey.<providerId>`**, for example `apikey.3f2b...`. The spec in `CLAUDE.md` says `apikey:<providers.id>`, but SecureStore only accepts keys matching `[A-Za-z0-9._-]`, so a colon is not usable. `apiKeyName()` is the single place this is defined.

Keys are never copied into SQLite, the zustand store, logs or error messages. Deleting a provider in Settings also deletes its key. After saving, the key field is cleared and only a masked placeholder is shown.
