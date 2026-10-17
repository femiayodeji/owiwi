import { addDays } from '../lib/dates';

export interface StreakInfo {
  current: number;
  doneToday: boolean;
  longest: number;
}

/**
 * Pure streak math over device-local YYYY-MM-DD dates.
 * Dates after `today` (timezone moved west) are clamped to today so the streak survives.
 */
export function computeStreak(completedDates: readonly string[], today: string): StreakInfo {
  const days = new Set<string>();
  for (const d of completedDates) days.add(d > today ? today : d);
  if (days.size === 0) return { current: 0, doneToday: false, longest: 0 };

  const doneToday = days.has(today);
  let current = 0;
  let cursor = doneToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, doneToday, longest };
}

/** True when the user has history but the current streak is broken (sad owl). */
export function streakLost(completedDates: readonly string[], today: string): boolean {
  return completedDates.length > 0 && computeStreak(completedDates, today).current === 0;
}
