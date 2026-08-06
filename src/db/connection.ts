/**
 * The database handle, behind a seam.
 *
 * `client.ts` opens the real device database at module load, which means
 * importing anything that touches it pulls in `expo-sqlite` and its native
 * module — fine on a device, fatal in a unit test.
 *
 * User-data queries are the part of this app most worth testing: the version
 * lock rule decides whether a player's match history stays attached to the list
 * that played it, and that is not something to find out about on a device. So
 * those queries resolve their handle through `conn()`, which a test can point
 * at the `node:sqlite` harness in `testing.ts`.
 *
 * The real handle is resolved with a lazy `require` rather than a top-level
 * import so that a test which installs an override never loads `expo-sqlite`
 * at all.
 */

/** The slice of expo-sqlite's `SQLiteDatabase` the query layer uses. */
export interface SqliteLike {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string, params?: unknown[]): T | null;
  getAllSync<T>(sql: string, params?: unknown[]): T[];
  runSync(sql: string, params?: unknown[]): unknown;
  withTransactionSync(fn: () => void): void;
}

let override: SqliteLike | null = null;

/** Test-only. Pass null to restore the device database. */
export function setTestConnection(db: SqliteLike | null): void {
  override = db;
}

export function conn(): SqliteLike {
  if (override) return override;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./client') as { sqlite: SqliteLike }).sqlite;
}
