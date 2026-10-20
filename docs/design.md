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
| | Reuters · 3h ago                     | |  source + relative time
| | ☆ Save  ⇪ Share         Read more -> | |  secondary actions
| +--------------------------------------+ |
+------------------------------------------+
```

- **Pager:** full-screen vertical `FlatList` with `pagingEnabled`, `getItemLayout`, `windowSize={3}`. Cards enter with a Reanimated `FadeInDown`. Pull down on the cards to regenerate (with confirmation).
- **Slot tabs:** the selected tab is filled indigo; the non-active, unselected slot is muted (45% opacity).
- **Menu (`...`):** Regenerate digest (when ready), Appearance, Bookmarks, Keywords, LLM provider, Schedule, All settings.
- **Read more:** a text link that opens `expo-web-browser`. Deliberately not a primary button.
- **Save / Share:** muted text actions left of Read more (`src/components/StoryActions.tsx`). Save toggles an outlined ☆ to a filled indigo ★ and shows a toast ("Saved to Bookmarks." with a View action). Share uses React Native's `Share` sheet with the message from `formatShareMessage()` (`src/lib/share.ts`).
- **Bookmarks screen (`app/bookmarks.tsx`):** saved stories as compact cards, newest first, each with Remove (toast with Undo), Share and Read more. Empty state: idle Owiwi with its brand copy and a hint to tap Save.
- **Completion card:** after the last story. Celebrating owl, "N days in a row", and "See you this evening." (morning) or "See you tomorrow." (evening). Reaching the last story card records the streak.
- **Thinking state:** owl plus the three steps "Fetching headlines", "Writing your gist", "Saving your digest", each marked done, current or pending.
- **Empty / failed / no digest:** owl, short explanation, and actions (Try again, Edit keywords, Open settings, Generate).
- All article and model text is rendered as plain `Text`.

## Themes

Settings → Appearance (also in the feed's ⋯ menu) offers four modes, stored as the `theme_mode` setting:

| Mode | Look |
|---|---|
| System (default) | Follows the phone's light or dark setting (`userInterfaceStyle: 'automatic'` plus `expo-system-ui`) |
| Light | Brand cream background, white cards, indigo accent |
| Dark | Deep navy background, lifted indigo, light text |
| Reading | Warm paper tones, serif story text, about 8% larger, with roomier line height |

Palettes and typography live in `src/lib/theme.ts` (`THEMES`). Components read them with `useTheme()` or `makeStyles()` from `src/lib/useTheme.ts`, and screens use `useUi()` for shared text styles. Never hard-code colors in components. The one exception is the brand sparkle colors in `Confetti.tsx`.

## Brand assets

All art is cut from the brand sheet (`docs/design/owiwi-brand-sheet.png.png`) by `scripts/extract-brand-art.py`. Nothing is redrawn. The script flood-fills each panel's pastel background from the edges, un-mixes anti-aliased edge pixels from that background so there's no halo, trims, and exports the files.

| Asset | Path | How it's made |
|---|---|---|
| Mascot states | `assets/owiwi/{idle,happy,thinking,celebrate,sad,sleepy}.png` plus `@2x`/`@3x` | Cut from the six state panels. 160 px base. |
| Android notification small icon | `assets/owiwi/notification-icon.png` | Head of the Idle owl (cut above the eye line plus a rounded jaw under the face disc) as a 96x96 pure-white silhouette. The cream face disc is transparent and the pupils and beak stay white, so the owl face reads at status-bar size. |
| Android notification large icon | `assets/owiwi/notification-head.png` | The same head in full colour, 256 px, transparent. Set as the expo-notifications `largeIcon`, so it shows beside every notification's text. |
| App icon | `assets/icon.png` | The sheet's app icon owl (reading) on navy `#222B4D`, 1024 px. |
| Adaptive icon | `assets/android-icon-foreground.png`, `-background.png`, `-monochrome.png` | Owl inside the 66% safe zone, solid navy background, and a white silhouette for themed icons. |
| Splash | `assets/splash-icon.png` | Owl on transparent, shown on cream `#F7F5F0` through the `expo-splash-screen` plugin. |
| Notification sound | `assets/sounds/owiwi_chime.wav` | Two-note chime (G5, then D6) synthesized by `scripts/make-chime.py`. Original audio. |

Known limits:

- **Resolution:** the sheet is 1312x1199, so each owl is about 250 to 330 px in the source. `@3x` (480 px) is upscaled and slightly soft. Swap in the designer's originals when they arrive, keeping the same file names. Nothing else needs to change.
- **Floor shadow:** a faint trace of the floor shadow can remain under some states.

To regenerate:

```sh
python3 -m venv /tmp/owiwi-art && /tmp/owiwi-art/bin/pip install pillow numpy
/tmp/owiwi-art/bin/python -I scripts/extract-brand-art.py docs/design/owiwi-brand-sheet.png.png /tmp/owiwi-art/out /tmp/owiwi-art/preview
```

Copy the results from `out/` into `assets/` and `assets/owiwi/`. Check the previews in `preview/` first.

iOS has no separate notification icon; it uses the app icon.

Native assets (icons, splash, notification icon and sound) only take effect after a new native build (`npx expo prebuild --clean`, then a dev-client or release build). On Android, a channel's sound is fixed when the channel is created, so changing the sound also needs a new channel id (`CHANNEL_ID` in `src/notifications/schedule.ts`).

To test notifications: Settings → Schedule & reminders → Test. It sends a morning, evening or nudge reminder 3 seconds later, using the real copy, icon, sound and channel.

`assets/owiwi/README.md` lists the files.
