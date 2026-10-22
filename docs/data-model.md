# Data model

All persistent data is on the device:

- **SQLite** (`expo-sqlite`, database file `owiwi.db`): keywords, provider config, digests, articles, cards, streak days, bookmarks, settings.
- **SecureStore** (`expo-secure-store`): API keys only.

## Opening the database

`getDb()` in `src/db/client.ts` opens `owiwi.db` once per process, sets `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` (required for the cascading deletes), runs migrations and caches the handle. If opening fails, the cached promise is cleared so the next call retries.

## Migrations

`src/db/migrations.ts` holds `MIGRATIONS`, an append-only array of SQL strings. Index `i` is migration version `i + 1`.

`runMigrations(db)` reads `PRAGMA user_version`, and for each pending migration runs:

```sql
BEGIN; <migration sql>; PRAGMA user_version = <n>; COMMIT;
```

so each migration and its version bump are applied atomically. The current schema version is 5 (2 adds `bookmarks`, 3 adds `digests.cleared_at` and `digests.shown_titles`, now unused, 4 adds `seen_stories`, 5 adds `digests.last_index`). Never edit a shipped migration; add a new entry instead (see [development.md](development.md#adding-a-migration)).

## Schema (version 4)

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
  cleared_at INTEGER,           -- migration 3: unused legacy column (read-news clearing was removed)
  shown_titles TEXT,            -- migration 3: unused legacy column
  last_index INTEGER,           -- migration 5: pager page the reader was last on; NULL until opened, reset on regenerate
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

-- migration 2
CREATE TABLE bookmarks (         -- saved stories, a self-contained copy of the card
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,      -- one bookmark per story
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  topic TEXT,
  source TEXT,
  published_at TEXT,
  created_at INTEGER NOT NULL    -- when it was saved; list is newest first
);
CREATE INDEX bookmarks_created ON bookmarks(created_at);
```

```sql
CREATE TABLE seen_stories (     -- migration 4: cards the reader was shown, kept 48 hours
  url TEXT PRIMARY KEY,         -- normalizeUrl(card.url)
  title TEXT NOT NULL,          -- card title, sent to the LLM as already_shown
  title_key TEXT NOT NULL,      -- normalizeTitle(source article title), matched against new RSS titles
  seen_at INTEGER NOT NULL
);
CREATE INDEX seen_stories_seen_at ON seen_stories(seen_at);
```

A card is seen when its page becomes visible in the feed (`useFeed.markSeen`, fire-and-forget). `seen_stories` has no foreign key, so it outlives the daily wipe. Queries: `listSeenStories` (most recent first), `markStorySeen` in `src/db/queries.ts`. Pure helpers in `src/digest/seen.ts`: `dropSeen` (hard filter before the LLM) and `resumeIndex` (where the pager opens: `digests.last_index`, saved by `useFeed.setLastIndex` on every page change, else the first unseen card).

`bookmarks` deliberately has no foreign key to `cards` or `digests`: it copies the card's content so a saved story survives the daily wipe (which cascades cards) and any removal of read cards. Queries: `listBookmarks`, `listBookmarkedUrls`, `isBookmarked`, `addBookmark`, `saveBookmark` (used by undo, keeps the original id and `created_at`), `removeBookmark` in `src/db/queries.ts`. The `useBookmarks` zustand store (`src/store/bookmarks.ts`) keeps the set of bookmarked urls in memory for the cards.

IDs are UUIDs from `expo-crypto` (`newId()` in `src/lib/ids.ts`). Timestamps (`created_at`, `completed_at`) are epoch milliseconds. `published_at` is an ISO 8601 string or null.

## Invariants and where they are enforced

| Rule | Enforced in |
|---|---|
| At most 8 enabled keywords | `addKeyword` (new keyword starts disabled at the cap), `setKeywordEnabled` (returns `false`) in `src/db/queries.ts`; `MAX_ENABLED_KEYWORDS` |
| Exactly one active provider (when any exist) | `saveProvider` (first provider becomes active), `setActiveProvider`, `deleteProvider` (promotes another) |
| One digest per `(date, slot)` | `UNIQUE (date, slot)`; `beginDigest` reuses the existing row |
| Articles and cards written atomically with `status = 'ready'` | `completeDigest` (single transaction) |
| A story is marked seen once, first sighting kept | `markStorySeen` uses `INSERT OR IGNORE` on the normalized url |
| Streak day recorded once per date | `recordStreakDay` uses `INSERT OR IGNORE` |
| One bookmark per story | `url UNIQUE`; `saveBookmark` uses `INSERT OR IGNORE` |
| Keyword reorder is atomic | `reorderKeywords` (transaction) |

## Retention

`wipeStale(db, today)` in `src/digest/retention.ts` runs `DELETE FROM digests WHERE date < ?`. Articles and cards go with their digest through `ON DELETE CASCADE`. In the same pass it prunes `seen_stories` older than 48 hours (`SEEN_TTL_MS`); the daily wipe never deletes them otherwise. `keywords`, `providers`, `settings`, `streak_days` and `bookmarks` are never touched. It is called from `useFeed.refresh()` (launch and every foreground) and at the start of `generateDigest()`.

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
