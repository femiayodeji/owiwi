import { COPY_POOLS, pickCopy } from '../src/notifications/copy';
import { isTopUpDue, planReminders } from '../src/notifications/plan';
import { localDate } from '../src/lib/dates';

const settings = { morning_time: '07:00', evening_time: '19:00', nudge_enabled: '1' as const, nudge_time: '21:30' };

describe('pickCopy', () => {
  it('is deterministic per kind and date', () => {
    expect(pickCopy('morning', '2026-10-17')).toEqual(pickCopy('morning', '2026-10-17'));
  });
  it('rotates across consecutive days', () => {
    const titles = new Set(Array.from({ length: 7 }, (_, i) => pickCopy('evening', `2026-10-${10 + i}`).title));
    expect(titles.size).toBe(7);
  });
  it('includes the brand copy', () => {
    expect(COPY_POOLS.morning.some((c) => c.title === "Good morning! Let's catch up.")).toBe(true);
    expect(COPY_POOLS.evening.some((c) => c.title === 'Ready for your next read.')).toBe(true);
  });
});

describe('planReminders', () => {
  it('plans morning, evening and nudge for each day, only in the future', () => {
    const now = new Date(2026, 9, 17, 12, 0);
    const plan = planReminders({ now, settings, doneToday: false });
    // Today: evening + nudge (morning has passed); 9 more days x 3.
    expect(plan).toHaveLength(2 + 9 * 3);
    expect(plan[0].id).toBe('owiwi.evening.2026-10-17');
    expect(plan.every((r) => r.fireAt.getTime() > now.getTime())).toBe(true);
    expect(plan[plan.length - 1].date).toBe('2026-10-26');
    expect(plan.map((r) => r.fireAt.getTime())).toEqual([...plan.map((r) => r.fireAt.getTime())].sort((a, b) => a - b));
  });
  it('skips today\'s nudge once the day is done', () => {
    const now = new Date(2026, 9, 17, 12, 0);
    const plan = planReminders({ now, settings, doneToday: true });
    expect(plan.find((r) => r.id === 'owiwi.nudge.2026-10-17')).toBeUndefined();
    expect(plan.find((r) => r.id === 'owiwi.nudge.2026-10-18')).toBeDefined();
  });
  it('omits nudges when disabled', () => {
    const plan = planReminders({ now: new Date(2026, 9, 17, 6, 0), settings: { ...settings, nudge_enabled: '0' }, doneToday: false });
    expect(plan.some((r) => r.kind === 'nudge')).toBe(false);
    expect(plan).toHaveLength(20);
  });
  it('clamps the horizon to 7-14 days', () => {
    const now = new Date(2026, 9, 17, 6, 0);
    const days = (n: number) => new Set(planReminders({ now, settings, doneToday: false, days: n }).map((r) => r.date)).size;
    expect(days(3)).toBe(7);
    expect(days(30)).toBe(14);
  });
  it('fires at the configured local time and carries copy', () => {
    const plan = planReminders({ now: new Date(2026, 9, 17, 6, 0), settings, doneToday: false });
    const m = plan[0];
    expect(m.kind).toBe('morning');
    expect([localDate(m.fireAt), m.fireAt.getHours(), m.fireAt.getMinutes()]).toEqual(['2026-10-17', 7, 0]);
    expect(m.title).toBe(pickCopy('morning', '2026-10-17').title);
  });
});

describe('isTopUpDue', () => {
  const now = new Date(2026, 9, 17, 12, 0);
  const ago = (minutes: number) => ({ at: now.getTime() - minutes * 60_000, date: localDate(now) });

  it('is due when nothing has synced yet', () => {
    expect(isTopUpDue(null, now)).toBe(true);
  });
  it('skips a top-up shortly after a sync on the same day', () => {
    expect(isTopUpDue(ago(1), now)).toBe(false);
    expect(isTopUpDue(ago(14), now)).toBe(false);
  });
  it('is due once the interval has passed', () => {
    expect(isTopUpDue(ago(15), now)).toBe(true);
    expect(isTopUpDue(ago(5), now, 5 * 60_000)).toBe(true);
  });
  it('is due when the local date changed (midnight rollover)', () => {
    expect(isTopUpDue({ at: now.getTime() - 60_000, date: '2026-10-16' }, now)).toBe(true);
  });
  it('is due when the clock moved backwards', () => {
    expect(isTopUpDue({ at: now.getTime() + 60_000, date: localDate(now) }, now)).toBe(true);
  });
});
