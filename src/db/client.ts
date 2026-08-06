import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { migrate } from './migrations';
import * as schema from './schema/cards';

/**
 * The device database — source of truth for everything the UI renders.
 *
 * Opened synchronously at module load so the first screen can query without
 * waiting on a promise. The card mirror is ~1.8 MB, which SQLite handles
 * without ceremony.
 */

export const DATABASE_NAME = 'riftbound.db';

export const sqlite = SQLite.openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true, // required for Drizzle's useLiveQuery
});

migrate(sqlite);

export const db = drizzle(sqlite, { schema });

export { schema };
export type Database = typeof db;
