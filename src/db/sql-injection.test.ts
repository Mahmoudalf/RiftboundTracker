import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from './connection';
import { MIGRATIONS } from './migrations';
import { createEvent, getEvent, updateEvent } from './queries/events';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from './testing';

/**
 * User data never reaches an interpolated part of a SQL statement.
 *
 * Fifteen sites in the query layer build a statement with a template literal —
 * the audit brief said four, and a scan written to find them all found fifteen.
 * The four it named are the visible ones:
 * `events.ts` and `games.ts` interpolate a `SET` clause, and `migrations.ts` and
 * `testing.ts` interpolate a version number into `PRAGMA user_version`. Every
 * one of them looked correct on inspection — the column names come from string
 * literals in the code and every value is bound with `?`.
 *
 * **A comment saying so is what this file replaces.** Inspection is a claim
 * about today; the behavioural half below proves a payload cannot escape, and
 * the structural half fails if a *future* site interpolates something that is
 * not a code-built identifier.
 */

let db: TestDatabase;

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

/** The shapes that break a query if a value is ever concatenated rather than bound. */
const PAYLOADS = [
  "'; DROP TABLE events; --",
  "' OR '1'='1",
  "\\'; DELETE FROM games WHERE '1'='1",
  'Robert"); DROP TABLE decks;--',
  "1'; UPDATE events SET name = 'pwned' WHERE '1'='1",
  '"; PRAGMA user_version = 0; --',
  "', dirty = 0, name = 'hijacked", // aims at the SET clause specifically
];

describe('payloads are stored, never executed', () => {
  for (const payload of PAYLOADS) {
    it(`survives ${JSON.stringify(payload.slice(0, 34))} verbatim`, () => {
      const id = createEvent({ name: payload, eventType: null, startedAt: new Date().toISOString() });

      // Round-trips exactly. If any part were concatenated, the string would
      // either be truncated at the quote or change the statement's meaning.
      expect(getEvent(id)?.name).toBe(payload);

      // And again through the dynamic SET clause, which is the site under test.
      updateEvent(id, { name: payload, location: payload, notes: payload });
      const after = getEvent(id);
      expect(after?.name).toBe(payload);
      expect(after?.location).toBe(payload);
      expect(after?.notes).toBe(payload);
    });
  }

  it('leaves every table standing afterwards', () => {
    for (const payload of PAYLOADS) {
      const id = createEvent({ name: payload, eventType: null, startedAt: new Date().toISOString() });
      updateEvent(id, { name: payload, notes: payload });
    }

    // The blunt check: a `DROP TABLE` that executed would take one of these out.
    const tables = db
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((r) => r.name);

    for (const required of ['events', 'games', 'decks', 'deck_versions', 'settings']) {
      expect(tables).toContain(required);
    }
  });

  it('does not let a payload rewrite a neighbouring row', () => {
    const keep = createEvent({ name: 'Keep me', eventType: null, startedAt: new Date().toISOString() });
    const target = createEvent({ name: 'Target', eventType: null, startedAt: new Date().toISOString() });

    // `' OR '1'='1` in a concatenated WHERE would update every row.
    updateEvent(target, { name: "' OR '1'='1" });

    expect(getEvent(keep)?.name).toBe('Keep me');
  });
});

/**
 * Every template-literal SQL statement in the query layer, and what it
 * interpolates.
 *
 * This is the half that guards the future. A new site that drops a variable
 * into a statement fails here unless its name is on the list below, which forces
 * the question to be asked out loud rather than reviewed past.
 */
describe('no new interpolation slips in unreviewed', () => {
  /**
   * Expressions allowed inside a SQL template literal.
   *
   * Each is a **code-built identifier or a number**, never user data:
   * - `sets.join(', ')` — column names pushed by `put()`, all string literals
   * - `migration.version` — a number from the `MIGRATIONS` constant
   * - `includeArchived ? … : …` — two fixed SQL fragments chosen by a boolean
   * - `table` — a table name from a fixed list in the schema audit
   * - `placeholders` / `qs` — runs of `?`, which is the opposite of the problem
   */
  const ALLOWED = new Set([
    // A SET clause of column names pushed by `put()`, every one a literal.
    "sets.join(', ')",
    // A WHERE clause of literal fragments; every value goes in as `?`.
    "where.join(' AND ')",
    // `' LIMIT ?'` or `''` — the fragment is interpolated, the number is bound.
    'limit',
    // Two fixed SQL fragments chosen by a boolean.
    "includeArchived ? '' : 'AND d.archived_at IS NULL'",
    "versionId ? 'AND deck_version_id = ?' : ''",
    // A run of `?` placeholders, which is the opposite of the problem.
    "keys.map(() => '?').join(',')",
    "values.map(() => '?').join(',')",
    "ids.map(() => '?').join(',')",
    'placeholders',
    'qs',
    // Column and table names built in code. `inClause` is called only as
    // `inClause('set_id', …)` and `inClause('rarity', …)`; `keys` and `table`
    // come from the schema, never from input.
    'column',
    'keys.join(",")',
    "keys.join(',')",
    'table',
    // A number from the `MIGRATIONS` constant.
    'migration.version',
    // A `SELECT` fragment defined as a module constant.
    'RECORD_SELECT',
  ]);

  function sqlFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sqlFiles(full, out);
      else if (full.endsWith('.ts') && !full.includes('.test.')) out.push(full);
    }
    return out;
  }

  it('interpolates only code-built identifiers', () => {
    const offenders: string[] = [];

    for (const file of sqlFiles('src/db')) {
      const src = readFileSync(file, 'utf8');
      // Template literals containing a SQL keyword — the statements, not prose.
      for (const lit of src.matchAll(/`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE|PRAGMA|CREATE)\b[^`]*)`/gis)) {
        for (const expr of lit[1]!.matchAll(/\$\{([^}]*)\}/g)) {
          const inner = expr[1]!.trim();
          if (!ALLOWED.has(inner)) {
            offenders.push(`${file.replace(/\\/g, '/')}  \${${inner}}`);
          }
        }
      }
    }

    // Reported as a list so a failure names the file and the expression rather
    // than sending the next person hunting.
    expect(offenders).toEqual([]);
  });

  it('finds the interpolations it claims to check — a silent zero is not a pass', () => {
    let found = 0;
    for (const file of sqlFiles('src/db')) {
      const src = readFileSync(file, 'utf8');
      for (const lit of src.matchAll(/`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE|PRAGMA|CREATE)\b[^`]*)`/gis)) {
        found += [...lit[1]!.matchAll(/\$\{[^}]*\}/g)].length;
      }
    }
    expect(found).toBeGreaterThanOrEqual(15);
  });
});
