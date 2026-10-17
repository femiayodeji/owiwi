import type { Settings } from '../db/settings';
import { addDays, atTime, localDate } from '../lib/dates';
import { pickCopy, type ReminderKind } from './copy';

export const REMINDER_PREFIX = 'owiwi.';

export interface PlannedReminder {
  id: string; // e.g. 'owiwi.morning.2026-10-17'
  kind: ReminderKind;
  date: string;
  fireAt: Date;
  title: string;
  body: string;
}

export interface PlanInput {
  now: Date;
  settings: Pick<Settings, 'morning_time' | 'evening_time' | 'nudge_enabled' | 'nudge_time'>;
  doneToday: boolean;
  days?: number;
}

export function reminderId(kind: ReminderKind, date: string): string {
  return `${REMINDER_PREFIX}${kind}.${date}`;
}

/** Pure: the reminders to schedule from now over the next `days` days (7-14, default 10). */
export function planReminders({ now, settings, doneToday, days = 10 }: PlanInput): PlannedReminder[] {
  const span = Math.min(14, Math.max(7, Math.floor(days)));
  const today = localDate(now);
  const out: PlannedReminder[] = [];

  for (let i = 0; i < span; i++) {
    const date = addDays(today, i);
    const slots: [ReminderKind, string][] = [
      ['morning', settings.morning_time],
      ['evening', settings.evening_time],
    ];
    if (settings.nudge_enabled === '1' && !(i === 0 && doneToday)) {
      slots.push(['nudge', settings.nudge_time]);
    }
    for (const [kind, time] of slots) {
      const fireAt = atTime(date, time);
      if (!fireAt || fireAt.getTime() <= now.getTime()) continue;
      out.push({ id: reminderId(kind, date), kind, date, fireAt, ...pickCopy(kind, date) });
    }
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
