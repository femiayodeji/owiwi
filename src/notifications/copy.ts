import { parseLocalDate } from '../lib/dates';

export type ReminderKind = 'morning' | 'evening' | 'nudge';

export interface ReminderCopy {
  title: string;
  body: string;
}

const POOLS: Record<ReminderKind, readonly ReminderCopy[]> = {
  morning: [
    { title: 'Good morning! Let\'s catch up.', body: 'Your morning gist is ready when you are.' },
    { title: 'Hoo\'s up early?', body: 'A few swipes and you\'re caught up on your topics.' },
    { title: 'Coffee and headlines?', body: 'Owiwi picked the stories worth your morning.' },
    { title: 'Rise and read', body: 'Your topics, summed up in a couple of minutes.' },
    { title: 'Morning, friend', body: 'The news moved overnight. Here\'s the short version.' },
    { title: 'Fresh gist, just for you', body: 'Start the day knowing what matters.' },
    { title: 'Owiwi\'s been busy', body: 'Your morning cards are waiting. Swipe in.' },
  ],
  evening: [
    { title: 'Ready for your next read.', body: 'Your evening gist is here. Catch up on the day.' },
    { title: 'How was your day?', body: 'Here\'s what happened while you were busy.' },
    { title: 'Evening wrap-up', body: 'The day\'s big stories, a few swipes long.' },
    { title: 'Wind down with Owiwi', body: 'A calm recap of your topics, no doomscrolling.' },
    { title: 'The day, in a nutshell', body: 'Your evening cards are ready.' },
    { title: 'Hoo-ray, it\'s evening', body: 'Catch up on what you missed today.' },
    { title: 'One last look', body: 'Owiwi summed up the day for you.' },
  ],
  nudge: [
    { title: 'Your streak is still open', body: 'A few swipes keeps it going. Owiwi believes in you.' },
    { title: 'Still time today', body: 'Your gist takes about two minutes. Keep the streak alive?' },
    { title: 'Owiwi saved your spot', body: 'Finish today\'s cards before bed to keep your streak.' },
    { title: 'Quick one before bed?', body: 'Swipe through today\'s gist and call it a day.' },
    { title: 'Hoo-hoo, gentle reminder', body: 'Your streak would love a visit today.' },
    { title: 'Don\'t let the day slip by', body: 'Your stories are waiting. It won\'t take long.' },
  ],
};

const KIND_OFFSET: Record<ReminderKind, number> = { morning: 0, evening: 3, nudge: 5 };

/** Whole days since the epoch for a local date, independent of DST. */
function dayNumber(date: string): number {
  const d = parseLocalDate(date);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Deterministic per (kind, date), rotating day to day. */
export function pickCopy(kind: ReminderKind, date: string): ReminderCopy {
  const pool = POOLS[kind];
  const n = dayNumber(date);
  const idx = (((n + KIND_OFFSET[kind]) % pool.length) + pool.length) % pool.length;
  return pool[Number.isFinite(idx) ? idx : 0];
}

export const COPY_POOLS = POOLS;
