# Setup

## Prerequisites

- Node.js (LTS) and npm.
- For Android: Android Studio with an SDK and an emulator, or a physical device with USB debugging.
- For iOS: macOS with Xcode and a simulator, or a physical device (needs an Apple developer account for device builds).
- Optional: an Expo account, for cloud builds with EAS.
- An API key from at least one LLM provider (OpenAI, Anthropic, Gemini, OpenRouter, Groq, or any OpenAI-compatible service). See [llm.md](llm.md).

Stack versions (from `package.json`): Expo SDK 58, React Native 0.88, React 19.3, expo-router 58, TypeScript 6.

## Install

```sh
npm install
```

## Build a development client

Owiwi uses a **dev client build**. **Expo Go is not supported** (the app depends on native config: SecureStore, notification channel and icon, config plugins in `app.config.ts`).

Either build locally:

```sh
npx expo run:android      # same as: npm run android
npx expo run:ios          # same as: npm run ios
```

These run `expo prebuild` to generate `android/` and `ios/` (both gitignored), compile, and install the app on the emulator, simulator or connected device.

Or build in the cloud with EAS, using the `development` profile from `eas.json` (`developmentClient: true`, internal distribution):

```sh
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
```

Install the resulting build on the device. Rebuild the dev client whenever native dependencies or `app.config.ts` change (for example after adding `assets/owiwi/notification-icon.png`).

## Run

Start Metro for the dev client:

```sh
npm start                 # expo start --dev-client
```

Open the installed Owiwi dev client and connect to the dev server.

## First run (onboarding)

The app opens on a five-step onboarding the first time:

1. **Welcome.**
2. **Keywords.** Add your own or tap suggestions. At least one must be enabled to continue (max 8 enabled).
3. **Times.** Morning and evening digest times (defaults 07:00 and 19:00).
4. **Provider.** Pick a preset, check the model, paste the API key, optionally **Test connection**, then **Save provider**. Required to continue.
5. **Reminders.** "Allow reminders" requests notification permission (on Android 13+ the channel is created first so the system prompt appears); "Not now" skips it.

Finishing sets `onboarded = '1'`, schedules reminders if permitted, and opens the feed, which starts generating the active slot's digest.

## Adding or changing a provider later

Settings > LLM providers:

- **Add provider:** choose a preset (OpenAI, Anthropic, Gemini, OpenRouter, Groq, Custom OpenAI-compatible). For Custom, enter the API root as base URL (before `/chat/completions`, must be `https://`).
- **Model:** pre-filled with a suggested default; replace it with any model ID your account can use.
- **API key:** stored only in the device keystore. After saving it is never shown again; editing shows a masked placeholder, and typing a new key replaces it.
- **Test connection:** sends a tiny request and reports key, rate limit, network or model problems in plain language.
- Tap a provider in the list to make it active. Deleting a provider also deletes its key.

## Other settings

- **Keywords:** add, rename, edit the query, enable/disable, reorder, delete. Changes apply to the next digest; use Regenerate in the feed menu to rebuild today's.
- **News source:** Google News (default), Bing News, or Publisher feeds, and the locale (`en-NG` by default; presets for several regions or type your own `xx-YY`).
- **Schedule & reminders:** slot times, cards per digest (5 to 10), streak-saver nudge on/off and time.
