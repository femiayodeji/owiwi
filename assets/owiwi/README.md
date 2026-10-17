# Owiwi mascot assets

Expected files (transparent PNG, with `@2x` / `@3x` variants):

| File | State | Brand copy |
|---|---|---|
| `idle.png` | Idle | Ready for your next read. |
| `happy.png` | Happy | Good morning! Let's catch up. |
| `thinking.png` | Thinking | Gathering and summarizing your top stories... |
| `celebrate.png` | Celebrate | You did it! Streak +1 |
| `sad.png` | Sad | No worries. Tomorrow is a new day. |
| `sleepy.png` | Sleepy | Rest well. More news tomorrow. |
| `notification-icon.png` | Android notification small icon | 96x96, white-on-transparent silhouette of the head only |

**Status: not delivered yet.** Only the brand sheet exists (`docs/design/owiwi-brand-sheet.png.png`).
`<Owiwi />` shows a clearly marked placeholder until the PNGs are added and registered in
`src/components/owiwiAssets.ts` (`OWIWI_ART`). `app.config.ts` picks up `notification-icon.png`
automatically once it exists. Do not redraw the owl or substitute emojis.
