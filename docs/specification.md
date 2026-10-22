# Product specification

Owiwi is a mobile app (React Native, Expo) that builds a daily news-reading habit. Twice a day it prepares a short digest of swipeable cards from the reader's own keywords. The summaries are written by an LLM provider the reader chooses, using the reader's own API key. Finishing a digest extends a daily streak. An animated owl, Owiwi, reacts to what is happening.

The feed is the product. "Read more" exists but is secondary.

## Hard constraints

- **No backend.** Everything runs on the device. No server, proxy, accounts or analytics.
- **Bring your own key (BYOK).** The app ships with no keys. The reader adds a provider and key.
- **Free news sources only.** Public RSS feeds that need no API key. Default is Google News RSS.
- **API keys live only in the OS secure keystore** (`expo-secure-store`). Never in SQLite, logs or error messages.
- **Offline-tolerant.** If today's digest is cached, it opens with no network.

## Core flow

1. The reader opens the app (directly or from a notification).
2. The app computes `today` (device-local `YYYY-MM-DD`) and the **active slot**.
3. Stale data from earlier days is wiped.
4. If a ready digest exists for `(today, activeSlot)`, it is shown. No network calls.
5. Otherwise the app fetches RSS for each enabled keyword, removes duplicates, makes one LLM call, validates the result, stores it and shows the cards.
6. The reader swipes vertically through the cards. Each card shown is remembered as **seen** for 48 hours. Reaching the last card completes the day for the streak.
7. Cards stay for the whole day, so the reader can always swipe back to a story. Reopening a digest resumes on the page the reader was last on (a digest never opened starts at the first unseen card), so the card they were reading is not skipped. Finishing on the completion card reopens there; it also offers a quiet "Check for fresh stories" link (the usual regenerate confirm).

## Slots

- Two slots: **morning** and **evening**. The reader sets both times (defaults 07:00 and 19:00). Morning must be earlier than evening.
- **Active slot** is `evening` if the current time is at or after the evening time, otherwise `morning`.
- Only the active slot generates automatically, and only once per app session; a failure shows a retry button instead of looping.
- The other slot is shown as a muted tab. If it has no digest it shows a "Generate" button. It is never auto-generated, so a reader who opens at 20:00 is not forced to make a morning digest.
- Every digest (morning, evening, regenerate) skips stories the reader has seen in the last 48 hours: matching articles are dropped before the LLM call, and the seen titles are sent as `already_shown` so the model also skips the same story from another outlet. A real new development on a seen story may come back as one card titled "Update: ...".

## Digest content

- Cards per digest: 5 to 10 (default 10). The model may return fewer if there are not enough good stories.
- Each card has a topic, a title (max 90 characters), a 2 to 3 sentence summary, the source and publication time, and a "Read more" link that opens the original article in the in-app browser.
- Cards are built only from the fetched articles. Any card whose link is not one of the fetched articles is discarded.
- If no articles are found at all, an empty state is shown and no LLM call is made.
- If articles were found but the reader has seen all of them, the slot shows **Nothing new**: when the next digest is due, "Read your <other> digest again" (only if that slot has a digest), "Check again" (free unless something new turns up) and a link to Bookmarks. No LLM call, nothing stored.
- If some keywords fail to fetch, the digest is built from the rest and the feed lists which keywords could not be reached.
- Each card also has secondary **Save** (bookmark toggle) and **Share** actions. Share sends an image of the card in the current theme (title, summary, source, "via Owiwi"; no buttons, no caption). If the image can't be made it shares plain text instead: title, summary and "via Owiwi" (no link: Google News links are long redirects). Saved stories appear on the **Bookmarks** screen (feed menu and Settings), newest first, with Read more, Share and Remove (with Undo). Bookmarks are copies, so they outlive the daily wipe.
- **Regenerate** (feed menu or pull down on the cards) rebuilds the current slot's digest. It asks for confirmation first because it uses the reader's tokens. If regeneration fails, finds no headlines, or finds nothing new, the previous cards are kept and a banner says so (no tokens are used when nothing is new).
- Changing keywords does not invalidate today's digest. The reader can regenerate instead.

## Keywords

- Free-text keywords with suggestion chips: AI, Geopolitics, Football, Tech, Business, Nigeria, Science, Startups, Climate, Health.
- Each keyword has a **label** (shown to the reader) and a **query** (sent to the news source). Both are editable.
- Keywords can be enabled, disabled, reordered and deleted.
- At most 8 enabled keywords. A keyword added beyond the cap starts disabled.

## News sources

Chosen in Settings > News source. All are free public RSS feeds.

| Source | Notes |
|---|---|
| Google News (default) | Keyword search, last 24 hours, by region/language (default `en-NG`). Links are Google redirect URLs, opened as-is. |
| Bing News | Keyword search via Bing's RSS output. Must be re-verified before release; drop it if Bing stops serving RSS. |
| Publisher feeds | BBC News, Al Jazeera, TechCrunch, The Verge, ESPN, Hacker News (hnrss.org). Items are kept when every meaningful word of the keyword query appears in the title or snippet. |

Limits: about 15 items per keyword and 60 articles in total per digest, shared fairly across keywords.

## Retention

- Today's morning and evening digests are kept. Everything dated before today is deleted, with its cards and articles.
- The wipe runs on app launch, whenever the app returns to the foreground, and before any generation. This also covers midnight passing while the app is open.
- Keywords, providers, settings, streak history and bookmarks are never wiped.

## Streaks

- A day counts when the reader reaches the last card of any ready digest that day. Recording is idempotent per date.
- Current streak = consecutive completed days ending today, or ending yesterday if today is not done yet. If the last completed day is before yesterday, the streak is 0.
- Dates are device-local. A timezone change that makes a recorded date appear to be in the future is treated as today, so the streak is not broken.
- Not in v1: streak freezes, leaderboards.

## Notifications

- Local notifications only, scheduled on the device. Permission is requested during onboarding after an explanation, and can be declined.
- A morning and an evening reminder at the reader's times, scheduled individually for the next 10 days so the text can rotate (owl-voice copy). The schedule is topped up on every app open, every return to the foreground and every settings change.
- Optional **streak-saver nudge** (default on, 21:30). It is not scheduled for today if the day is already complete, and it is cancelled as soon as the reader completes the day.
- Tapping a notification opens the feed, which shows the active slot.
- Notifications are best-effort reminders. The app never generates a digest in the background.
- Android forgets alarms on reboot, and expo-notifications drops reminders whose time passed while the phone was off. A boot receiver added by the `plugins/with-missed-reminders.js` config plugin shows the latest reminder due today that never fired (a delivered reminder or a cancelled nudge is not repeated). It needs a native build.
- Android uses a dedicated "Daily reminders" channel (`owiwi_reminders`) that plays the Owiwi chime. The small icon is a white silhouette of Owiwi's head; see [design.md](design.md#brand-assets).

## Mascot

`<Owiwi emotion="..." />` shows one of six states, each paired with fixed brand copy:

| State | When | Copy |
|---|---|---|
| idle | Default, evening slot with no digest, notifications step of onboarding | Ready for your next read. |
| happy | Morning slot with no digest yet, onboarding welcome | Good morning! Let's catch up. |
| thinking | Digest is being generated | Gathering and summarizing your top stories... |
| celebrate | Completion card after the last story | You did it! Streak +1 |
| sad | Streak lost, empty or failed digest | No worries. Tomorrow is a new day. |
| sleepy | Opened between 23:00 and 04:59 | Rest well. More news tomorrow. |

The owl must use the provided brand artwork; it is not redrawn or replaced with emojis. The artwork is not delivered yet, so a marked placeholder is shown.

## Onboarding

Five steps on first run: welcome, pick keywords (at least one enabled), set morning and evening times, add an LLM provider, allow reminders (or "Not now"). The feed is not reachable until onboarding is finished.

## Out of scope for v1

Accounts, sync, any backend, server push notifications, an in-app article reader, social features, key-based news APIs (NewsAPI, GNews, etc.), streak freezes, leaderboards.
