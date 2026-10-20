import { create } from 'zustand';
import { getDb } from '../db/client';
import {
  getCards,
  getDigest,
  listSeenStories,
  listStreakDates,
  markStorySeen,
  recordStreakDay,
  type Card,
} from '../db/queries';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '../db/settings';
import { generateDigest, isGenerating, type GenerationStep } from '../digest/generate';
import { wipeStale } from '../digest/retention';
import { activeSlot as computeActiveSlot } from '../digest/slot';
import { coalesce } from '../lib/async';
import { localDate } from '../lib/dates';
import { friendlyMessage } from '../lib/errors';
import type { Slot } from '../llm/types';
import { normalizeUrl } from '../news/dedupe';
import { cancelTodayNudge } from '../notifications';
import { computeStreak, streakLost } from '../streak/streak';

export type SlotStatus = 'none' | 'loading' | 'generating' | 'ready' | 'empty' | 'nothing-new' | 'failed';

export interface SlotState {
  status: SlotStatus;
  cards: Card[];
  step: GenerationStep | null;
  error: string | null;
  failedKeywords: string[];
}

export interface StreakState {
  current: number;
  doneToday: boolean;
  lost: boolean;
}

interface FeedStore {
  ready: boolean;
  today: string;
  activeSlot: Slot;
  viewSlot: Slot;
  settings: Settings;
  slots: Record<Slot, SlotState>;
  streak: StreakState;
  /** Normalized URLs of stories seen in the last 48 hours (see src/digest/seen.ts). */
  seen: ReadonlySet<string>;
  /** True right after this session completed the day (drives the celebrate owl). */
  justCompleted: boolean;

  /** Re-reads everything from the DB (after a wipe) and auto-generates the active slot if needed. */
  refresh(): Promise<void>;
  /** Re-reads settings only (no wipe, no generation). For appearance-style changes. */
  reloadSettings(): Promise<void>;
  setViewSlot(slot: Slot): void;
  generate(slot: Slot, force?: boolean): Promise<void>;
  /** Counts the day for the streak. Fires when the last story card is reached. */
  completeDay(slot: Slot): Promise<void>;
  /** Remembers a card the reader was shown. Fire-and-forget. */
  markSeen(card: Card): void;
}

const hasCards = (s: SlotState): boolean => s.status === 'ready' && s.cards.length > 0;

const emptySlot = (status: SlotStatus = 'loading'): SlotState => ({
  status,
  cards: [],
  step: null,
  error: null,
  failedKeywords: [],
});

// Auto-generation is attempted once per (date, slot) per process, so a failure
// shows retry UI instead of looping.
const autoAttempted = new Set<string>();

export const useFeed = create<FeedStore>((set, get) => {
  const patchSlot = (slot: Slot, patch: Partial<SlotState>) =>
    set((s) => ({ slots: { ...s.slots, [slot]: { ...s.slots[slot], ...patch } } }));

  async function loadSlot(date: string, slot: Slot): Promise<SlotState> {
    const db = await getDb();
    const digest = await getDigest(db, date, slot);
    if (!digest) return emptySlot('none');
    if (digest.status === 'ready') return { ...emptySlot('ready'), cards: await getCards(db, digest.id) };
    if (digest.status === 'failed') return { ...emptySlot('failed'), error: 'Your last digest attempt failed.' };
    // 'generating' without a live run here is an orphan from a killed app: treat as not built yet.
    return emptySlot(isGenerating(date, slot) ? 'generating' : 'none');
  }

  async function loadStreak(today: string): Promise<StreakState> {
    const db = await getDb();
    const dates = await listStreakDates(db);
    const s = computeStreak(dates, today);
    return { current: s.current, doneToday: s.doneToday, lost: streakLost(dates, today) };
  }

  return {
    ready: false,
    today: localDate(),
    activeSlot: 'morning',
    viewSlot: 'morning',
    settings: DEFAULT_SETTINGS,
    slots: { morning: emptySlot(), evening: emptySlot() },
    streak: { current: 0, doneToday: false, lost: false },
    seen: new Set(),
    justCompleted: false,

    async refresh() {
      const db = await getDb();
      const now = new Date();
      const today = localDate(now);
      await wipeStale(db, today);
      const settings = await loadSettings(db);
      const active = computeActiveSlot(now, settings.evening_time);
      const prev = get();
      const dayChanged = prev.today !== today;

      const [morning, evening, streak, seen] = await Promise.all([
        loadSlot(today, 'morning'),
        loadSlot(today, 'evening'),
        loadStreak(today),
        listSeenStories(db),
      ]);
      // Don't clobber an in-flight generation in this process, or a "nothing
      // new" result (it leaves the digest row as it was, so the DB can't tell).
      const keep = (slot: Slot, next: SlotState) => {
        const p = prev.slots[slot];
        if (dayChanged) return next;
        if (p.status === 'generating' && isGenerating(today, slot)) return p;
        if (p.status === 'nothing-new' && next.status !== 'ready') return p;
        return next;
      };

      set({
        ready: true,
        today,
        settings,
        activeSlot: active,
        viewSlot: dayChanged || prev.activeSlot !== active || !prev.ready ? active : prev.viewSlot,
        slots: { morning: keep('morning', morning), evening: keep('evening', evening) },
        streak,
        seen: new Set(seen.map((s) => s.url)),
        justCompleted: dayChanged ? false : prev.justCompleted,
      });

      if (settings.onboarded !== '1') return;
      const activeState = get().slots[active];
      const key = `${today}:${active}`;
      if ((activeState.status === 'none' || activeState.status === 'failed') && !autoAttempted.has(key)) {
        autoAttempted.add(key);
        void get().generate(active);
      }
    },

    async reloadSettings() {
      set({ settings: await loadSettings(await getDb()) });
    },

    setViewSlot(slot) {
      set({ viewSlot: slot });
    },

    async generate(slot, force = false) {
      const db = await getDb();
      const date = localDate();
      const previous = get().slots[slot];
      patchSlot(slot, { status: 'generating', step: null, error: null });
      try {
        const res = await generateDigest(db, {
          date,
          slot,
          force,
          onStep: (step) => patchSlot(slot, { step }),
        });
        if (res.kind === 'busy') {
          patchSlot(slot, { status: 'generating', step: null });
          return;
        }
        if (res.kind === 'empty' || res.kind === 'nothing-new') {
          // A regenerate that found nothing (new) keeps the old cards.
          if (hasCards(previous)) {
            const error =
              res.kind === 'empty'
                ? "Couldn't find fresh headlines, so your digest wasn't changed."
                : "Nothing new since your last read, so your digest wasn't changed.";
            patchSlot(slot, { ...previous, error });
          } else {
            patchSlot(slot, { ...emptySlot(res.kind), failedKeywords: res.failedKeywords });
          }
          return;
        }
        patchSlot(slot, { ...(await loadSlot(date, slot)), failedKeywords: res.failedKeywords });
      } catch (e) {
        const message = friendlyMessage(e);
        if (hasCards(previous)) {
          patchSlot(slot, { ...previous, error: message });
        } else {
          patchSlot(slot, { ...emptySlot('failed'), error: message });
        }
      }
    },

    async completeDay(slot) {
      const db = await getDb();
      const today = localDate();
      const recorded = await recordStreakDay(db, today, slot);
      if (recorded) {
        set({ streak: await loadStreak(today), justCompleted: true });
        await cancelTodayNudge();
      }
    },

    markSeen(card) {
      const url = normalizeUrl(card.url);
      const { seen } = get();
      if (seen.has(url)) return;
      set({ seen: new Set(seen).add(url) });
      void getDb()
        .then((db) => markStorySeen(db, card))
        .catch(() => undefined);
    },
  };
});

// Boot, AppState 'active' (a cold start from a notification fires several) and
// settings screens can all call refresh() at once. Run one pass at a time, plus
// one trailing pass so every caller sees state at least as fresh as its call.
useFeed.setState({ refresh: coalesce(useFeed.getState().refresh) });
