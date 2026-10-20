// Daily wipe: keep today's digests, delete everything older. Cards and articles
// go with their digest via ON DELETE CASCADE. Seen stories are pruned on their
// own 48-hour clock. Keywords, providers, settings, streak_days and bookmarks
// are never touched.
import { SEEN_TTL_MS } from './seen';

export interface WipeDb {
  runAsync(source: string, ...params: (string | number)[]): Promise<{ changes: number }>;
}

export const WIPE_SQL = 'DELETE FROM digests WHERE date < ?';
export const PRUNE_SEEN_SQL = 'DELETE FROM seen_stories WHERE seen_at < ?';

/** Returns the number of digests deleted. */
export async function wipeStale(db: WipeDb, today: string, now: number = Date.now()): Promise<number> {
  const res = await db.runAsync(WIPE_SQL, today);
  await db.runAsync(PRUNE_SEEN_SQL, now - SEEN_TTL_MS);
  return res.changes;
}
