// Daily wipe: keep today's digests, delete everything older. Cards and articles
// go with their digest via ON DELETE CASCADE. Keywords, providers, settings,
// streak_days and bookmarks are never touched.

export interface WipeDb {
  runAsync(source: string, ...params: string[]): Promise<{ changes: number }>;
}

export const WIPE_SQL = 'DELETE FROM digests WHERE date < ?';

export async function wipeStale(db: WipeDb, today: string): Promise<number> {
  const res = await db.runAsync(WIPE_SQL, today);
  return res.changes;
}
