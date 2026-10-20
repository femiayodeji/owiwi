// Versioned migrations driven by PRAGMA user_version. Append only: never edit a
// shipped migration, add a new one.

export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export const MIGRATIONS: readonly string[] = [
  // 1: initial schema
  `
  CREATE TABLE keywords (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    query TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    base_url TEXT,
    model TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE digests (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('morning','evening')),
    status TEXT NOT NULL CHECK (status IN ('generating','ready','failed')),
    provider_id TEXT,
    model TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE (date, slot)
  );

  CREATE TABLE articles (
    id TEXT PRIMARY KEY,
    digest_id TEXT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
    keyword_label TEXT,
    title TEXT NOT NULL,
    snippet TEXT,
    source TEXT,
    url TEXT NOT NULL,
    published_at TEXT
  );
  CREATE INDEX articles_digest ON articles(digest_id);

  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    digest_id TEXT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    topic TEXT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    source TEXT,
    url TEXT NOT NULL,
    published_at TEXT
  );
  CREATE INDEX cards_digest ON cards(digest_id, position);

  CREATE TABLE streak_days (
    date TEXT PRIMARY KEY,
    slot TEXT NOT NULL,
    completed_at INTEGER NOT NULL
  );

  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  // bookmarks: saved stories. Copies card content and has no foreign key, so it
  // survives the daily wipe and any removal of read cards. One row per url.
  `
  CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    topic TEXT,
    source TEXT,
    published_at TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX bookmarks_created ON bookmarks(created_at);
  `,
  // read-news clearing: a finished digest keeps its row (cleared_at set) but
  // loses its cards; shown_titles keeps their titles (JSON array) for the
  // evening "already_shown" dedupe.
  `
  ALTER TABLE digests ADD COLUMN cleared_at INTEGER;
  ALTER TABLE digests ADD COLUMN shown_titles TEXT;
  `,
];

export async function runMigrations(db: MigrationDb, migrations: readonly string[] = MIGRATIONS): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < migrations.length) {
    const sql = migrations[version];
    version += 1;
    // PRAGMA cannot be parameterized; version is an integer we control.
    await db.execAsync(`BEGIN; ${sql}; PRAGMA user_version = ${version}; COMMIT;`);
  }
  return version;
}
