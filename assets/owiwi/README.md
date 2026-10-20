# Owiwi mascot assets

| File | Use |
|---|---|
| `idle.png`, `happy.png`, `thinking.png`, `celebrate.png`, `sad.png`, `sleepy.png` (+ `@2x`, `@3x`) | Mascot states, rendered by `<Owiwi />` through `OWIWI_ART` in `src/components/owiwiAssets.ts` |
| `notification-icon.png` | Android notification small icon: 96x96, pure white on transparent, silhouette of the Idle owl's head (face disc cut out, pupils and beak white). Android uses only the alpha channel. |
| `notification-head.png` | Android notification large icon: the same head in full colour, 256x256, transparent. Wired as `largeIcon` of the `expo-notifications` plugin in `app.config.ts`. |

All of these are cut from `docs/design/owiwi-brand-sheet.png.png` by `scripts/extract-brand-art.py`. Nothing is redrawn. To regenerate: `python scripts/extract-brand-art.py docs/design/owiwi-brand-sheet.png.png <out_dir> <preview_dir>` (needs Pillow and numpy), then copy the files you want into place; `<preview_dir>/notification.png` shows both notification icons for review. Notification icons are native resources: they only change on the device after `npx expo prebuild --clean` and a new dev-client (or release) build.

When the designer delivers the originals, replace these files and keep the names. Do not redraw the owl or substitute emojis.
