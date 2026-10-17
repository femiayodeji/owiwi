import { create } from 'zustand';
import { getDb } from '../db/client';
import { getCards, getDigest, listStreakDates, recordStreakDay, type Card } from '../db/queries';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '../db/settings';
import { generateDigest, isGenerating, type GenerationStep } from '../digest/generate';
import { wipeStale } from '../digest/retention';
import { activeSlot as computeActiveSlot } from '../digest/slot';
import { localDate } from '../lib/dates';
import { friendlyMessage } from '../lib/errors';
import type { Slot } from '../llm/types';
import { cancelTodayNudge } from '../notifications';
import { computeStreak, streakLost } from '../streak/streak';

export type SlotStatus = 'none' | 'loading' | 'generating' | 'ready' | 'empty' | 'failed';

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
  /** True right after this session completed the day (drives the celebrate owl). */
  justCompleted: boolean;

  /** Re-reads everything from the DB (after a wipe) and auto-generates the active slot if needed. */
  refresh(): Promise<void>;
  /** Re-reads settings only (no wipe, no generation). For appearance-style changes. */
  reloadSettings(): Promise<void>;
  setViewSlot(slot: Slot): void;
  generate(slot: Slot, force?: boolean): Promise<void>;
  completeDay(slot: Slot): Promise<void>;
}

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
      // Don't clobber an in-flight generation in this process.
      const keep = (slot: Slot, next: SlotState) =>
        !dayChanged && prev.slots[slot].status === 'generating' && prev.slots[slot].step ? prev.slots[slot] : next;

      set({
        ready: true,
        today,
        settings,
        activeSlot: active,
        viewSlot: dayChanged || prev.activeSlot !== active || !prev.ready ? active : prev.viewSlot,
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
          // A regenerate that found nothing keeps the old cards.
          if (previous.status === 'ready' && previous.cards.length > 0) {
            patchSlot(slot, { ...previous, error: "Couldn't find fresh headlines, so your digest wasn't changed." });
          } else {
            patchSlot(slot, { ...emptySlot('empty'), failedKeywords: res.failedKeywords });
          }
          return;
        }
        patchSlot(slot, {
          status: 'ready',
          cards: await getCards(db, res.digestId),
          step: null,
          error: null,
          failedKeywords: res.failedKeywords,
        });
      } catch (e) {
        const message = friendlyMessage(e);
        if (previous.status === 'ready' && previous.cards.length > 0) {
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
      if (!recorded) return;
      set({ streak: await loadStreak(today), justCompleted: true });
      await cancelTodayNudge();
    },
  };
});
