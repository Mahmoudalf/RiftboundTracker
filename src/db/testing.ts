import { DatabaseSync } from 'node:sqlite';

import type { Migration } from './migrations';

/**
 * Test-only SQLite harness.
 *
 * Node 24 ships a SQLite build with FTS5, so migrations and queries can be
 * exercised against a real database in unit tests rather than mocked. This
 * shims `node:sqlite` to the slice of the expo-sqlite API the database layer
 * uses, so tests run the *real* migration SQL — not a reimplementation of it.
 *
 * Imported only from `*.test.ts`, so `node:sqlite` never reaches the app bundle.
 */

/** The subset of expo-sqlite's SQLiteDatabase that `migrate()` depends on. */
export interface SqliteLike {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string, params?: unknown[]): T | null;
  getAllSync<T>(sql: string, params?: unknown[]): T[];
  runSync(sql: string, params?: unknown[]): unknown;
  withTransactionSync(fn: () => void): void;
}

export interface TestDatabase extends SqliteLike {
  /** Escape hatch for assertions that need the driver directly. */
  raw: DatabaseSync;
  userVersion(): number;
  close(): void;
}

export function createTestDatabase(): TestDatabase {
  const raw = new DatabaseSync(':memory:');

  return {
    raw,
    execSync: (sql) => raw.exec(sql),
    getFirstSync: <T>(sql: string, params: unknown[] = []) =>
      (raw.prepare(sql).get(...(params as never[])) as T) ?? null,
    getAllSync: <T>(sql: string, params: unknown[] = []) =>
      raw.prepare(sql).all(...(params as never[])) as T[],
    runSync: (sql, params = []) => raw.prepare(sql).run(...(params as never[])),
    withTransactionSync: (fn) => {
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
    userVersion: () =>
      (raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    close: () => raw.close(),
  };
}

/**
 * Bring a database up to `version` only — the state a device would be in before
 * installing an update that adds later migrations.
 */
export function applyMigrationsUpTo(
  db: TestDatabase,
  migrations: readonly Migration[],
  version: number
): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  /*
   * Match `migrate()` exactly.
   *
   * This was missing, so every test ran with foreign keys **off** while the
   * device runs with them **on** — the dangerous direction. An insert with a
   * dangling reference, or a delete that should cascade, would pass here and
   * fail on a phone. A harness more permissive than the driver is worse than no
   * harness for precisely the bugs it exists to catch.
   */
  db.execSync('PRAGMA foreign_keys = ON;');

  /*
   * Skip what is already applied, exactly as `migrate()` does.
   *
   * Without this the helper always replayed from migration 1, so calling it a
   * second time re-ran every migration and died on the first `ALTER TABLE`.
   * That made the scenario most worth testing impossible to write: an existing
   * device, holding existing rows, moving forward one version.
   */
  const current =
    db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    if (migration.version > version) break;
    db.withTransactionSync(() => {
      db.execSync(migration.up);
      db.execSync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}

export function listTables(db: TestDatabase): string[] {
  return db
    .getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
    )
    .map((r) => r.name);
}

/** Insert a card with only the columns present at schema v1. */
export function insertCard(db: TestDatabase, overrides: Record<string, unknown> = {}): string {
  const row = {
    id: `card-${Math.random().toString(36).slice(2, 10)}`,
    riftbound_id: 'ogn-001-001',
    name: 'Test Card',
    clean_name: 'Test Card',
    type: 'Unit',
    rarity: 'Common',
    domains: '["Fury"]',
    domain_key: 'Fury',
    text_plain: 'Deal 2 damage.',
    tags: '["Test"]',
    set_id: 'OGN',
    set_label: 'Origins',
    artist: 'Test Artist',
    orientation: 'portrait',
    ...overrides,
  };
  const keys = Object.keys(row);
  db.runSync(
    `INSERT INTO cards (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    Object.values(row)
  );
  return row.id as string;
}
