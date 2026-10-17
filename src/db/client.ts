import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

export type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

async function open(): Promise<Db> {
  const db = await SQLite.openDatabaseAsync('owiwi.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

/** Shared, lazily-opened, migrated database. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = open().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
