# Owiwi

**Real news. Better days.**

Owiwi is a mobile app (React Native, Expo) for a daily news habit. Each morning and evening it builds a short digest of swipeable cards from the topics you choose, summarized by your own LLM provider with your own API key. Finish a digest to keep your streak going, with Owiwi the owl cheering you on. Everything runs on your phone.

## Features

- Morning and evening digests at times you set; only the current slot builds automatically.
- Free-text keywords (up to 8 enabled) with suggestions; label shown to you, query sent to the news source.
- News from free RSS: Google News (default), Bing News, or publisher feeds (BBC, Al Jazeera, TechCrunch, The Verge, ESPN, Hacker News).
- One LLM call per digest via OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, custom), Anthropic or Gemini, with a "Test connection" check.
- Anti-hallucination: any card that does not link to a fetched article is dropped.
- Full-screen vertical card feed with "Read more" in the in-app browser, regenerate on demand.
- Daily streaks, local reminders with rotating copy, and an optional streak-saver nudge.
- Works offline once today's digest is cached. Stale digests are wiped daily.

## Hard constraints

- **No backend.** No server, proxy, accounts or analytics.
- **BYOK.** The app ships with no keys; you add your own provider and key.
- **Free RSS only.** No key-based news APIs.
- **API keys only in SecureStore** (the OS keystore). Never in SQLite, logs or error messages.

## Quick start

```sh
npm install
npx expo run:android        # or: npx expo run:ios
# or a cloud dev build: npx eas-cli@latest build --profile development
npm start                   # Metro for the dev client
```

Expo Go is not supported; you need a development build. On first launch, onboarding asks for keywords, digest times, an LLM provider and key, and notification permission. Details in [docs/setup.md](docs/setup.md).

Checks:

```sh
npm test
npm run typecheck
```

## Documentation

See [docs/](docs/README.md): specification, architecture, data model, LLM providers, design, setup and development.

## Status

Implemented: everything in the v1 build order up to and including notifications, onboarding, empty/error states and regenerate, plus the Bing and publisher sources. Built on Expo SDK 58. Unit tests (13 suites, 97 tests) and the TypeScript check pass.

Known gaps:

- **Art is cut from the brand sheet**, not the designer's originals. The mascot states, app icon, splash and notification icon are extracted by `scripts/extract-brand-art.py`. They look right but `@3x` is upscaled. Replace them with the originals when delivered. See [docs/design.md](docs/design.md#brand-assets).
- **Rive animation is not implemented.** The owl uses Reanimated bounce and crossfade.
- **No lint configuration.** `npm run lint` exists but ESLint is not set up.
- **Bing News RSS** must be re-verified before release, and the suggested model IDs in `src/llm/defaultModels.ts` re-checked against provider docs.
- **Device testing so far:** the Android release build installs and launches on a Galaxy S22. The full flows (generation, notifications, streaks) are still being tested on the device, and iOS hasn't been tested.
