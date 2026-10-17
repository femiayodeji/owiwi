# Development

## Scripts

| Command | What it does |
|---|---|
| `npm start` | `expo start --dev-client` (Metro for the dev client) |
| `npm run android` / `npm run ios` | `expo run:android` / `expo run:ios` (local native build and install) |
| `npm test` | jest (preset `jest-expo`, tests matching `**/__tests__/**/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint`. No ESLint config or ESLint dependency is set up yet; the first run will offer to install and configure one. |

Before committing, run `npm test` and `npm run typecheck`. Both pass at the time of writing (13 suites, 97 tests).

## Project structure

```
app/                  expo-router screens (feed, onboarding, settings/*)
src/
  db/                 sqlite client, migrations, queries, settings
  news/               NewsSource interface, parse, dedupe, collect, google/bing/publisher sources
  llm/                LLMProvider interface, adapters/, prompt, schema, validate, presets, defaultModels
  digest/             generateDigest(), guard, retention wipe, slot logic
  notifications/      copy rotation, reminder plan, scheduling, deep link
  streak/             streak calculation
  components/         Owiwi, Pager, StoryCard, CompletionCard, KeywordEditor, ProviderForm, ui
  store/              zustand feed store
  lib/                dates, errors, http, ids, pool, secure storage, theme
__tests__/            jest unit tests for pure logic
assets/               app icons (template), assets/owiwi/ for mascot art
docs/                 these docs and the brand sheet
```

See [architecture.md](architecture.md) for what each module does.

## Conventions

- TypeScript `strict`, no `any`.
- Pure logic lives in plain functions with unit tests. Keep the following free of Expo and React Native imports so jest can run them directly: `src/news/*`, `src/llm/*`, `src/streak/*`, `src/notifications/copy.ts`, `src/notifications/plan.ts`, `src/digest/slot.ts`, `src/digest/guard.ts`, `src/digest/retention.ts`, `src/db/migrations.ts`, and the parsing in `src/db/settings.ts`. Code that needs a database takes a small interface (`MigrationDb`, `WipeDb`) or the `Db` type so tests can pass a fake.
- Screens stay thin; logic goes in `src/`.
- User-facing errors are `AppError` with a friendly, actionable message. Never include the API key, request bodies or raw provider responses in errors or logs.
- API keys are only read and written through `src/lib/secureStore.ts`.
- RSS and LLM text is untrusted. Render it as plain `Text`, never as HTML.
- Use device-local `YYYY-MM-DD` dates from `src/lib/dates.ts` (`localDate`, `addDays`), never UTC dates.
- Wrap multi-row writes in `db.withTransactionAsync`.
- Model IDs live only in `src/llm/defaultModels.ts`. Do not hardcode them from memory; verify against the provider's docs.
- No key-based news APIs. RSS only.

## Tests

| File | Covers |
|---|---|
| `__tests__/dates.test.ts` | `localDate`, `addDays` across month/year, `parseTime`, `atTime`, `relativeTime` |
| `__tests__/digest.test.ts` | `activeSlot`, `otherSlot`, `isLateNight`, `decideGeneration` (cached, busy, stale, failed), `wipeStale` |
| `__tests__/migrations.test.ts` | `runMigrations` applies pending migrations in order, bumps `user_version`, skips applied ones |
| `__tests__/settings.test.ts` | Settings defaults, parsing with fallback on invalid values, `parseLocale` |
| `__tests__/news-parse.test.ts` | `parseFeed` (Google RSS, Bing, CDATA, entities, Atom, junk), `stripHtml`, `truncate`, `toIsoDate`, Google URL and title/snippet shaping, `unwrapBingLink`, `matchesKeyword` |
| `__tests__/news-dedupe.test.ts` | `normalizeUrl`, `normalizeTitle`, `dedupeArticles` |
| `__tests__/news-collect.test.ts` | `collectArticles` (per-keyword failure, caps, concurrency 3, fair total cap, cross-keyword dedupe, abort), `capFairly` |
| `__tests__/llm-adapters.test.ts` | Request shape for all three adapters, JSON-mode 400 fallback, status mapping, blocked Gemini prompts, keys never leak into errors |
| `__tests__/llm-prompt.test.ts` | `buildSystemPrompt`, `buildUserPrompt` grouping and `already_shown` |
| `__tests__/llm-validate.test.ts` | `extractJson`, `parseCards` (URL allow-list, trailing slash, dedupe, cap, title truncation, schema failures) |
| `__tests__/llm-generate.test.ts` | `generateCards` retry-once behaviour, `testConnection` messages |
| `__tests__/streak.test.ts` | `computeStreak` (today, yesterday, gaps, boundaries, duplicates, timezone clamp, longest) |
| `__tests__/notifications-plan.test.ts` | `pickCopy` rotation, `planReminders` (future only, nudge skipped when done or disabled, 7 to 14 day clamp) |

Screens, the zustand store, SQLite queries and notification scheduling are not unit tested; check them on a device.

## Adding a migration

1. Append a new SQL string to `MIGRATIONS` in `src/db/migrations.ts`. Do not edit existing entries; they may already have run on devices.
2. The runner applies it on next launch inside `BEGIN ... COMMIT` and sets `PRAGMA user_version` to the new array length.
3. Update the row types and mappers in `src/db/queries.ts`, and [data-model.md](data-model.md).
4. If you add a table that holds per-day data, make it cascade from `digests` so the daily wipe covers it.

New settings usually need no migration: add the key with a default to `SettingsSchema` in `src/db/settings.ts`.

## Adding a news source

1. Create `src/news/<name>.ts` exporting a `NewsSource` (`id`, `label`, `fetch(keyword, opts)`). Use `fetchFeed()` from `src/news/feed.ts` (10 s timeout, parses RSS/Atom) and return `Article[]` with snippets passed through `truncate(…, SNIPPET_MAX)`. Respect `opts.limit` and `opts.signal`. Throw on failure; `collectArticles` turns it into a failed keyword.
2. Add the id to `NewsSourceId` in `src/news/types.ts`.
3. Register it in `getNewsSource()` and `NEWS_SOURCES` in `src/news/index.ts`.
4. Add the id to the `rss_provider` enum in `SettingsSchema` (`src/db/settings.ts`).
5. Add parsing tests with a saved feed sample in `__tests__/`.

The source must be free and require no API key. Verify the feed URL works before shipping.

To add a publisher feed instead, append to `PUBLISHER_PRESETS` in `src/news/publishers.ts`. All presets are currently used when "Publisher feeds" is selected; there is no per-publisher toggle in the UI yet (`getNewsSource` accepts `publisherPresetIds`, but `generateDigest` does not pass any).

## Adding an LLM adapter

Only needed for APIs that are not OpenAI-compatible (for those, add a preset; see [llm.md](llm.md#adding-a-new-openai-compatible-provider)).

1. Add the kind to `ProviderKind` in `src/llm/types.ts`.
2. Create `src/llm/adapters/<name>.ts` exporting `create<Name>(config, apiKey): LLMProvider`. Use `postJson()` from `src/llm/adapters/http.ts` so timeouts and status mapping are consistent, validate the response with zod, and throw `AppError('invalid_output')` on an unexpected shape or empty text. Do not put the key in URLs if the API offers a header.
3. Add a case to `createProvider()` in `src/llm/index.ts` (the `switch` is exhaustive, so `tsc` will flag a missing case).
4. Add a preset in `src/llm/presets.ts` and a verified default model in `src/llm/defaultModels.ts`.
5. Add request-shape and error-mapping tests to `__tests__/llm-adapters.test.ts`, including the key-leak check.

## Expo SDK 58 notes

- Install or upgrade native packages with `npx expo install <pkg>` so versions match SDK 58. Avoid plain `npm install` for Expo or React Native packages.
- Expo APIs change between SDKs. Use the versioned docs for SDK 58 (docs.expo.dev, version selector) rather than older examples, especially for `expo-notifications` triggers, `expo-sqlite` and `expo-router`.
- Changes to `app.config.ts`, config plugins or native dependencies require a new dev client build.
