import { create } from 'zustand';
import { getDb } from '../db/client';
import { clearDigest, getCards, getDigest, listStreakDates, recordStreakDay, type Card } from '../db/queries';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '../db/settings';
import { caughtUpOnLeave, shouldKeepSlot, slotStatusFor } from '../digest/cleared';
import { generateDigest, isGenerating, type GenerationStep } from '../digest/generate';
import { wipeStale } from '../digest/retention';
import { activeSlot as computeActiveSlot } from '../digest/slot';
import { coalesce } from '../lib/async';
import { localDate } from '../lib/dates';
import { friendlyMessage } from '../lib/errors';
import type { Slot } from '../llm/types';
import { cancelTodayNudge } from '../notifications';
import { computeStreak, streakLost } from '../streak/streak';

export type SlotStatus = 'none' | 'loading' | 'generating' | 'ready' | 'caught-up' | 'empty' | 'failed';

export interface SlotState {
  status: SlotStatus;
  cards: Card[];
  step: GenerationStep | null;
  error: string | null;
  failedKeywords: string[];
  /**
   * The reader reached the completion card and the digest was cleared in the
   * DB, but its cards stay in memory so the pager stays put. Leaving the slot
   * (or a new day) switches it to 'caught-up'.
   */
  cleared: boolean;
}

/** State to show when the reader leaves a slot: a just-finished digest becomes caught-up. */
function leaveSlot(state: SlotState): SlotState {
  return caughtUpOnLeave(state) ? emptySlot('caught-up') : state;
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
  /** Drops a read digest from the DB. Fires when the completion card is reached. */
  clearRead(slot: Slot, digestId: string): Promise<void>;
}

const hasContent = (s: SlotState): boolean =>
  (s.status === 'ready' && s.cards.length > 0) || s.status === 'caught-up';

const emptySlot = (status: SlotStatus = 'loading'): SlotState => ({
  status,
  cards: [],
  step: null,
  error: null,
  failedKeywords: [],
  cleared: false,
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
    const status = slotStatusFor(digest, isGenerating(date, slot));
    if (status === 'ready' && digest) return { ...emptySlot('ready'), cards: await getCards(db, digest.id) };
    if (status === 'failed') return { ...emptySlot('failed'), error: 'Your last digest attempt failed.' };
    return emptySlot(status);
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

      const [morning, evening, streak] = await Promise.all([
        loadSlot(today, 'morning'),
        loadSlot(today, 'evening'),
        loadStreak(today),
      ]);
      const viewSlot = dayChanged || prev.activeSlot !== active || !prev.ready ? active : prev.viewSlot;
      // Don't clobber an in-flight generation in this process, or a finished
      // digest the reader is still on.
      const keep = (slot: Slot, next: SlotState) =>
        shouldKeepSlot(prev.slots[slot], next, {
          dayChanged,
          isViewSlot: slot === viewSlot,
          generatingHere: isGenerating(today, slot),
        })
          ? prev.slots[slot]
          : next;

      set({
        ready: true,
        today,
        settings,
        activeSlot: active,
        viewSlot,
        slots: { morning: keep('morning', morning), evening: keep('evening', evening) },
        streak,
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
      const { viewSlot, slots } = get();
      if (viewSlot !== slot) patchSlot(viewSlot, leaveSlot(slots[viewSlot]));
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
        if (res.kind === 'empty') {
          // A regenerate that found nothing keeps the old cards (or the caught-up state).
          if (hasContent(previous)) {
            patchSlot(slot, { ...previous, error: "Couldn't find fresh headlines, so your digest wasn't changed." });
          } else {
            patchSlot(slot, { ...emptySlot('empty'), failedKeywords: res.failedKeywords });
          }
          return;
        }
        patchSlot(slot, { ...(await loadSlot(date, slot)), failedKeywords: res.failedKeywords });
      } catch (e) {
        const message = friendlyMessage(e);
        if (hasContent(previous)) {
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

    async clearRead(slot, digestId) {
      if (!(await clearDigest(await getDb(), digestId))) return;
      const { viewSlot, slots } = get();
      // Only touch the slot if it still shows this digest (not regenerated meanwhile).
      if (slots[slot].status !== 'ready' || slots[slot].cards[0]?.digestId !== digestId) return;
      // The cards stay in memory so the completion card keeps celebrating; if the
      // reader already switched away, go straight to caught-up.
      patchSlot(slot, viewSlot === slot ? { cleared: true } : emptySlot('caught-up'));
    },
  };
});

// Boot, AppState 'active' (a cold start from a notification fires several) and
// settings screens can all call refresh() at once. Run one pass at a time, plus
// one trailing pass so every caller sees state at least as fresh as its call.
useFeed.setState({ refresh: coalesce(useFeed.getState().refresh) });
