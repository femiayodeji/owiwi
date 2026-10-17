import { computeStreak, streakLost } from '../src/streak/streak';

const today = '2026-10-17';

describe('computeStreak', () => {
  it('is zero with no history', () => {
    expect(computeStreak([], today)).toEqual({ current: 0, doneToday: false, longest: 0 });
    expect(streakLost([], today)).toBe(false);
  });
  it('counts today only', () => {
    expect(computeStreak([today], today)).toEqual({ current: 1, doneToday: true, longest: 1 });
  });
  it('still counts a streak ending yesterday', () => {
    expect(computeStreak(['2026-10-15', '2026-10-16'], today)).toEqual({ current: 2, doneToday: false, longest: 2 });
    expect(streakLost(['2026-10-16'], today)).toBe(false);
  });
  it('breaks on a gap', () => {
    expect(computeStreak(['2026-10-14', '2026-10-15'], today).current).toBe(0);
    expect(streakLost(['2026-10-15'], today)).toBe(true);
    expect(computeStreak(['2026-10-13', '2026-10-14', '2026-10-16', today], today).current).toBe(2);
  });
  it('crosses month and year boundaries', () => {
    expect(computeStreak(['2026-09-29', '2026-09-30', '2026-10-01'], '2026-10-01').current).toBe(3);
    expect(computeStreak(['2026-12-31', '2027-01-01'], '2027-01-02').current).toBe(2);
  });
  it('ignores duplicates and ordering', () => {
    expect(computeStreak([today, '2026-10-16', today, '2026-10-15', '2026-10-16'], today)).toEqual({
      current: 3,
      doneToday: true,
      longest: 3,
    });
  });
  it('clamps future dates to today after a timezone shift', () => {
    // Recorded 10-18 abroad, now back on 10-17 local time.
    expect(computeStreak(['2026-10-16', '2026-10-18'], today)).toEqual({ current: 2, doneToday: true, longest: 2 });
  });
  it('tracks the longest run separately from the current one', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-16'];
    expect(computeStreak(dates, today)).toEqual({ current: 1, doneToday: false, longest: 4 });
  });
});
