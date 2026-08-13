import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import { MIGRATIONS } from '@/db/migrations';
import { cards, syncMeta } from '@/db/schema/cards';
import { binders, binderCards } from '@/db/schema/collection';
import { deckVersionCards, deckVersions, decks } from '@/db/schema/decks';
import { events, games, matches } from '@/db/schema/games';
import { applyMigrationsUpTo, createTestDatabase } from '@/db/testing';

/**
 * The Drizzle schema and the migrations are two descriptions of one database.
 *
 * Nothing has ever forced them to agree. `hydrate.ts` derives its column map
 * from the *schema*, while the device's actual columns come from the
 * *migrations* — so a column declared in one and not the other hydrates as
 * `undefined` with no error anywhere. That is exactly the M1 bug that blanked
 * every card in the gallery (12 of 29 fields undefined, `imageUrl` among them).
 */

// `sets` was the twelfth. Migration 22 dropped the table; the schema no longer
// declares it, so there is nothing left for the two sides to disagree about.
const TABLES: [string, SQLiteTable][] = [
  ['cards', cards],
  ['sync_meta', syncMeta],
  ['decks', decks],
  ['deck_versions', deckVersions],
  ['deck_version_cards', deckVersionCards],
  ['binders', binders],
  ['binder_cards', binderCards],
  ['events', events],
  ['games', games],
  ['matches', matches],
];

function liveColumns(table: string): Map<string, { notnull: number; dflt: unknown }> {
  const db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  const rows = db.getAllSync<{ name: string; notnull: number; dflt_value: unknown }>(
    `PRAGMA table_info(${table})`
  );
  db.close();
  return new Map(rows.map((r) => [r.name, { notnull: r.notnull, dflt: r.dflt_value }]));
}

describe('schema vs migrations', () => {
  for (const [name, table] of TABLES) {
    it(`${name}: every declared column exists in the migrated database`, () => {
      const live = liveColumns(name);
      const declared = Object.values(getTableColumns(table)).map(
        (c) => (c as unknown as { name: string }).name
      );

      const missing = declared.filter((c) => !live.has(c));
      expect({ table: name, missingFromDatabase: missing }).toEqual({
        table: name,
        missingFromDatabase: [],
      });
    });

    it(`${name}: every database column is declared in the schema`, () => {
      const live = liveColumns(name);
      const declared = new Set(
        Object.values(getTableColumns(table)).map((c) => (c as unknown as { name: string }).name)
      );

      const undeclared = [...live.keys()].filter((c) => !declared.has(c));
      expect({ table: name, missingFromSchema: undeclared }).toEqual({
        table: name,
        missingFromSchema: [],
      });
    });

    it(`${name}: NOT NULL agrees`, () => {
      const live = liveColumns(name);
      const mismatches: string[] = [];
      for (const [, column] of Object.entries(getTableColumns(table))) {
        const c = column as unknown as { name: string; notNull: boolean; primary?: boolean };
        const actual = live.get(c.name);
        if (!actual) continue;
        // SQLite reports an INTEGER PRIMARY KEY as nullable; Drizzle does not.
        const livePk = actual.notnull === 1;
        if (c.notNull !== livePk && !c.primary) mismatches.push(`${c.name}: schema=${c.notNull} db=${livePk}`);
      }
      expect({ table: name, notNullMismatches: mismatches }).toEqual({
        table: name,
        notNullMismatches: [],
      });
    });
  }
});
