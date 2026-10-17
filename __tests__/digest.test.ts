import { activeSlot, isLateNight, otherSlot } from '../src/digest/slot';
import { decideGeneration, STALE_GENERATING_MS } from '../src/digest/guard';
import { WIPE_SQL, wipeStale } from '../src/digest/retention';

const at = (h: number, m = 0) => new Date(2026, 9, 17, h, m);

describe('activeSlot', () => {
  it('is morning before the evening time', () => {
    expect(activeSlot(at(6, 0), '19:00')).toBe('morning');
    expect(activeSlot(at(18, 59), '19:00')).toBe('morning');
  });
  it('is evening at and after the evening time', () => {
    expect(activeSlot(at(19, 0), '19:00')).toBe('evening');
    expect(activeSlot(at(23, 30), '19:00')).toBe('evening');
  });
  it('respects custom times', () => {
    expect(activeSlot(at(17, 30), '17:15')).toBe('evening');
  });
  it('falls back to 19:00 on a malformed time', () => {
    expect(activeSlot(at(18, 0), 'nope')).toBe('morning');
  });
  it('flips slots and detects late night', () => {
    expect(otherSlot('morning')).toBe('evening');
    expect(isLateNight(at(23, 15))).toBe(true);
    expect(isLateNight(at(3))).toBe(true);
    expect(isLateNight(at(8))).toBe(false);
  });
});

describe('decideGeneration', () => {
  const now = 1_000_000_000;
  it('starts when there is no digest', () => {
    expect(decideGeneration(null, now, false)).toBe('start');
  });
  it('uses a ready digest unless forced', () => {
    expect(decideGeneration({ status: 'ready', createdAt: now }, now, false)).toBe('use-cached');
    expect(decideGeneration({ status: 'ready', createdAt: now }, now, true)).toBe('start');
  });
  it('blocks a fresh generating digest and resets a stale one', () => {
    expect(decideGeneration({ status: 'generating', createdAt: now - 1000 }, now, true)).toBe('busy');
    expect(decideGeneration({ status: 'generating', createdAt: now - STALE_GENERATING_MS - 1 }, now, false)).toBe(
      'start',
    );
  });
  it('retries a failed digest', () => {
    expect(decideGeneration({ status: 'failed', createdAt: now }, now, false)).toBe('start');
  });
});

describe('wipeStale', () => {
  it('deletes only digests before today', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 2 });
    await expect(wipeStale({ runAsync }, '2026-10-17')).resolves.toBe(2);
    expect(runAsync).toHaveBeenCalledWith(WIPE_SQL, '2026-10-17');
    expect(WIPE_SQL).toBe('DELETE FROM digests WHERE date < ?');
  });
});
