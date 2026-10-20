import type { Slot } from '../llm/types';
import { formatTime, minutesOfDay, timeToMinutes } from '../lib/dates';

/** Active slot = evening if now >= eveningTime, else morning. */
export function activeSlot(now: Date, eveningTime: string): Slot {
  const evening = timeToMinutes(eveningTime) ?? 19 * 60;
  return minutesOfDay(now) >= evening ? 'evening' : 'morning';
}

export function otherSlot(slot: Slot): Slot {
  return slot === 'morning' ? 'evening' : 'morning';
}

/** Late-night opens get the sleepy owl: 23:00 to 04:59. */
export function isLateNight(now: Date): boolean {
  const h = now.getHours();
  return h >= 23 || h < 5;
}

/** "Your evening digest is at 19:00" / "Your morning digest is tomorrow at 07:00". */
export function nextDigestLine(now: Date, morningTime: string, eveningTime: string): string {
  return activeSlot(now, eveningTime) === 'morning'
    ? `Your evening digest is at ${formatTime(eveningTime)}.`
    : `Your morning digest is tomorrow at ${formatTime(morningTime)}.`;
}

export const SLOT_LABEL: Record<Slot, string> = { morning: 'Morning', evening: 'Evening' };
