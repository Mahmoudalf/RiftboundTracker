import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Preferences, as key/value pairs.
 *
 * The columns say nothing about what is stored — that is the cost of key/value,
 * and it is paid deliberately (see migration 23). What the keys are, and what
 * shape each value takes, lives in `queries/settings.ts`, which is the only
 * module allowed to name one.
 *
 * Nothing in here is required for the app to run. A fresh install has an empty
 * table and every reader falls back to a sensible default, which is what keeps
 * this off the first-paint path.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type SettingRow = typeof settings.$inferSelect;
