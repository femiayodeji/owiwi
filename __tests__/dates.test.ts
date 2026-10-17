import { addDays, atTime, localDate, parseTime, relativeTime } from '../src/lib/dates';

describe('dates', () => {
  it('formats device-local dates', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('parses times strictly', () => {
    expect(parseTime('07:00')).toEqual({ hours: 7, minutes: 0 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7pm')).toBeNull();
  });
  it('builds a local date-time', () => {
    const d = atTime('2026-10-17', '19:30')!;
    expect([d.getHours(), d.getMinutes(), localDate(d)]).toEqual([19, 30, '2026-10-17']);
  });
  it('describes relative time', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    expect(relativeTime('2026-10-17T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2026-10-17T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('garbage', now)).toBeNull();
  });
});
