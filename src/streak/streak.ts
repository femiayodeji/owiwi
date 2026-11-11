import { addDays } from '../lib/dates';

export interface StreakInfo {
  current: number;
  doneToday: boolean;
  longest: number;
}

/** One missed day is forgiven (grace) at most once per this many days; two misses in a row always break. */
export const GRACE_EVERY_DAYS = 7;

/**
 * Pure streak math over device-local YYYY-MM-DD dates.
 * Dates after `today` (timezone moved west) are clamped to today so the streak survives.
 * A single missed day between completed days is bridged by a grace (it does not count
 * toward the streak), at most once every GRACE_EVERY_DAYS days. Yesterday counts as
 * bridged while today can still be completed.
 */
export function computeStreak(completedDates: readonly string[], today: string): StreakInfo {
  const days = new Set<string>();
  for (const d of completedDates) days.add(d > today ? today : d);
  if (days.size === 0) return { current: 0, doneToday: false, longest: 0 };

  const doneToday = days.has(today);
  let run = 0;
  let longest = 0;
  let lastGrace: string | null = null;
  for (let d = [...days].sort()[0]; d <= today; d = addDays(d, 1)) {
    if (days.has(d)) {
      run++;
      if (run > longest) longest = run;
    } else if (d === today) {
      // Today is not over yet: not a miss.
    } else {
      const next = addDays(d, 1);
      const graceAvailable = lastGrace === null || addDays(lastGrace, GRACE_EVERY_DAYS) <= d;
      if (run > 0 && graceAvailable && (days.has(next) || next === today)) {
        lastGrace = d;
      } else {
        run = 0;
        lastGrace = null;
      }
    }
  }

  return { current: run, doneToday, longest };
}

/** True when the user has history but the current streak is broken (sad owl). */
export function streakLost(completedDates: readonly string[], today: string): boolean {
  return completedDates.length > 0 && computeStreak(completedDates, today).current === 0;
}
