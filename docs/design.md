# Design

## Brand

The source of truth is the brand sheet: [`docs/design/owiwi-brand-sheet.png.png`](design/owiwi-brand-sheet.png.png) (note the doubled extension in the file name). It shows the app icon, the wordmark, the tagline **"Real news. Better days."**, the line "Your daily news habit, powered by your LLM", and the six mascot states with their copy on pastel panels.

### Colors

Defined in `src/lib/theme.ts`. Values were sampled by eye from the brand sheet; replace them if the designer supplies exact tokens.

| Token | Value | Use |
|---|---|---|
| `indigo` | `#5B5BD6` | Owiwi body, primary accent, active slot tab, buttons, notification accent color |
| `indigoDark` | `#3F3FB0` | Topic chip text |
| `navy` / `text` | `#1E2342` | Wordmark, primary text, Android adaptive icon background |
| `textMuted` | `#6B6F86` | Secondary text |
| `textFaint` | `#9A9DB0` | Pending progress steps, hints, placeholders, card position |
| `bg` | `#F7F5F0` | Screen background |
| `surface` | `#FFFFFF` | Cards, rows |
| `border` | `#E6E3DC` | Card and row borders |
| `danger` | `#D6455B` | Errors, delete |
| `success` | `#2E9E5B` | Completed steps, "Connected" |
| `beak` | `#F5A524` | Owl beak and feet accent (defined, not used yet) |

Panel colors behind each mascot state (`emotionBg`): idle `#E8F1FE`, happy `#FEF6DC`, thinking `#EEEAFD`, celebrate `#E6F7E9`, sad `#FDEBE4`, sleepy `#DCE3FB`.

Spacing (`space`): 4, 8, 16, 24, 32. Radii (`radius`): 8, 14, 22, pill. The app uses a light theme only (`userInterfaceStyle: 'light'` in `app.config.ts`).

## Mascot: Owiwi

`<Owiwi emotion size? showCopy? caption? />` in `src/components/Owiwi.tsx`. States and copy are defined in `src/components/owiwiAssets.ts` (`OwiwiEmotion`, `OWIWI_COPY`):

| Emotion | Brand copy | Shown when |
|---|---|---|
| `idle` | Ready for your next read. | Evening slot with no digest; onboarding notifications step |
| `happy` | Good morning! Let's catch up. | Morning slot with no digest; onboarding welcome |
| `thinking` | Gathering and summarizing your top stories... | Digest generating (with progress steps) |
| `celebrate` | You did it! Streak +1 | Completion card after the last story |
| `sad` | No worries. Tomorrow is a new day. | Streak lost; empty or failed digest |
| `sleepy` | Rest well. More news tomorrow. | Opened 23:00 to 04:59 with no digest showing (`isLateNight`) |

Animation (Reanimated): `thinking` and `sleepy` float gently in a loop; `happy` and `celebrate` do one bounce; switching state crossfades. The component API is meant to stay stable so a later Rive version only replaces `Owiwi.tsx`. Rive is not implemented and needs layered vector parts from the designer plus a native build.

Rules: use the brand artwork only. Do not redraw the owl, substitute emojis, or invent new poses.

## Feed UI anatomy

`app/index.tsx`, `src/components/Pager.tsx`, `StoryCard.tsx`, `CompletionCard.tsx`.

```
+------------------------------------------+
| [streak 5]   (Morning) ( Evening )   ... |  top bar: streak pill, slot tabs, menu
|                 3 / 10                   |  progress
|  Couldn't reach news for: Football       |  optional banner
| +--------------------------------------+ |
| | [ AI ]                               | |  topic chip
| | Title of the story, max 90 chars     | |  title
| |                                      | |
| | Two or three sentences: what         | |  summary
| | happened and why it matters.         | |
| |                                      | |
| | Reuters · 3h ago        Read more -> | |  source + relative time, secondary link
| +--------------------------------------+ |
+------------------------------------------+
```

- **Pager:** full-screen vertical `FlatList` with `pagingEnabled`, `getItemLayout`, `windowSize={3}`. Cards enter with a Reanimated `FadeInDown`. Pull down on the cards to regenerate (with confirmation).
- **Slot tabs:** the selected tab is filled indigo; the non-active, unselected slot is muted (45% opacity).
- **Menu (`...`):** Regenerate digest (when ready), Settings.
- **Read more:** a text link that opens `expo-web-browser`. Deliberately not a primary button.
- **Completion card:** after the last story. Celebrating owl, "N days in a row", and "See you this evening." (morning) or "See you tomorrow." (evening). Reaching the last story card records the streak.
- **Thinking state:** owl plus the three steps "Fetching headlines", "Writing your gist", "Saving your digest", each marked done, current or pending.
- **Empty / failed / no digest:** owl, short explanation, and actions (Try again, Edit keywords, Open settings, Generate).
- All article and model text is rendered as plain `Text`.

## Missing assets

The following art has **not been delivered**. The app runs without it, but none of it should ship as is.

| Asset | Path | Spec | Current fallback |
|---|---|---|---|
| Mascot states | `assets/owiwi/idle.png`, `happy.png`, `thinking.png`, `celebrate.png`, `sad.png`, `sleepy.png` | Transparent PNG, with `@2x` and `@3x` variants, cut from the brand design | `<Owiwi />` shows a dashed placeholder on the state's pastel panel labelled "Owiwi / <state> / PLACEHOLDER art missing", and logs one dev warning |
| Android notification icon | `assets/owiwi/notification-icon.png` | 96x96, white-on-transparent silhouette of the Owiwi **head only**, no color or gradients (Android renders it as a mask) | `app.config.ts` omits the `icon` option of the `expo-notifications` plugin, so Android falls back to a default shape. The accent `color` is already set to `#5B5BD6`. |
| App icon and splash | `assets/icon.png`, `assets/android-icon-*.png`, `assets/splash-icon.png`, `assets/favicon.png` | Owiwi app icon from the brand sheet (owl reading on navy) | These are still the Expo template images. `splash-icon.png` is not referenced in `app.config.ts`. |

iOS has no separate notification icon; it uses the app icon.

### Registering the mascot art

1. Add the PNGs to `assets/owiwi/` (`idle.png`, `idle@2x.png`, `idle@3x.png`, and so on). Metro picks the density variant automatically.
2. Register each one in `OWIWI_ART` in `src/components/owiwiAssets.ts`:

   ```ts
   export const OWIWI_ART: Partial<Record<OwiwiEmotion, ImageSourcePropType>> = {
     idle: require('../../assets/owiwi/idle.png'),
     happy: require('../../assets/owiwi/happy.png'),
     // thinking, celebrate, sad, sleepy
   };
   ```

3. States without an entry keep showing the placeholder, so they can be added one at a time.

### Adding the notification icon

Save the file as `assets/owiwi/notification-icon.png`. `app.config.ts` checks for it with `fs.existsSync` and passes it to the `expo-notifications` plugin automatically. Rebuild the native app (`npx expo prebuild --clean` or a new dev client build), since config plugin changes do not apply to an existing build.

`assets/owiwi/README.md` lists the same expected files.
