import { runMigrations, type MigrationDb } from '../src/db/migrations';

function fakeDb(version: number): MigrationDb & { executed: string[] } {
  const executed: string[] = [];
  return {
    executed,
    async execAsync(sql: string) {
      executed.push(sql);
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) version = Number(m[1]);
    },
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
  };
}

describe('runMigrations', () => {
  it('applies pending migrations in order and bumps user_version', async () => {
    const db = fakeDb(0);
    await expect(runMigrations(db, ['A', 'B'])).resolves.toBe(2);
    expect(db.executed).toHaveLength(2);
    expect(db.executed[0]).toContain('A');
    expect(db.executed[1]).toContain('PRAGMA user_version = 2');
  });
  it('skips migrations already applied', async () => {
    const db = fakeDb(2);
    await runMigrations(db, ['A', 'B', 'C']);
    expect(db.executed).toHaveLength(1);
    expect(db.executed[0]).toContain('C');
  });
});
