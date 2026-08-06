import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { cards, sets, type CardRow, type SetRow } from '../schema/cards';

/**
 * Turn a raw `SELECT *` row into a typed row object.
 *
 * The queries in this folder are hand-written SQL (dynamic filters plus an FTS5
 * match are far clearer written out than composed), which means SQLite hands
 * back **snake_case column names** — `image_url`, `clean_name`, `set_id` — while
 * the row types are camelCase. Casting across that gap silently produces
 * `undefined` for every multi-word field.
 *
 * So the mapping is derived from the Drizzle schema at module load rather than
 * hand-maintained: `getTableColumns()` knows each column's SQL name, its TS key,
 * and its data type. Add a column to the schema and the hydrator picks it up
 * with no second list to keep in sync.
 *
 * This module deliberately imports no native modules, so it is unit-testable in
 * plain Node.
 */

export interface ColumnMapping {
  sqlName: string;
  key: string;
  dataType: string;
  notNull: boolean;
  /** Column default, used when a write supplies no value for a NOT NULL column. */
  defaultValue: unknown;
}

function buildMapping(table: SQLiteTable): ColumnMapping[] {
  return Object.entries(getTableColumns(table)).map(([key, column]) => {
    const c = column as unknown as {
      name: string;
      dataType: string;
      notNull: boolean;
      default: unknown;
    };
    return {
      key,
      sqlName: c.name,
      dataType: c.dataType,
      notNull: c.notNull,
      defaultValue: c.default,
    };
  });
}

/**
 * Column metadata for the cards table, derived from the schema.
 *
 * Shared by the read path (`hydrateCard`) and the write path (the upsert in
 * `api/riftcodex/sync.ts`) so neither can drift from the schema. Both used to
 * carry their own hand-written column lists; the read one was wrong.
 */
export const cardColumns: ColumnMapping[] = buildMapping(cards);
export const setColumns: ColumnMapping[] = buildMapping(sets);

const CARD_MAPPING = cardColumns;
const SET_MAPPING = setColumns;

/**
 * Convert a typed row field into a SQLite-bindable primitive.
 *
 * JSON columns are stringified, booleans become 0/1, and a missing value on a
 * NOT NULL column falls back to that column's declared default rather than
 * inserting null and tripping the constraint.
 */
export function toBindValue(value: unknown, column: ColumnMapping): string | number | null {
  if (column.dataType === 'json') return JSON.stringify(value ?? []);
  if (column.dataType === 'boolean') return value ? 1 : 0;
  if (value === null || value === undefined) {
    if (column.notNull && column.defaultValue !== undefined) {
      return column.defaultValue as string | number;
    }
    return null;
  }
  return value as string | number;
}

/** JSON columns in this schema are always `string[]` and always non-null. */
function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function coerce(value: unknown, dataType: string): unknown {
  if (dataType === 'json') return parseJsonArray(value);
  if (value === null || value === undefined) return null;
  // SQLite has no boolean type — these round-trip as 0/1 integers.
  if (dataType === 'boolean') return Boolean(value);
  if (dataType === 'number') return typeof value === 'number' ? value : Number(value);
  return value;
}

function hydrate<T>(row: Record<string, unknown>, mapping: ColumnMapping[]): T {
  const out: Record<string, unknown> = {};
  for (const { sqlName, key, dataType } of mapping) {
    out[key] = coerce(row[sqlName], dataType);
  }
  return out as T;
}

export function hydrateCard(row: Record<string, unknown>): CardRow {
  return hydrate<CardRow>(row, CARD_MAPPING);
}

export function hydrateSet(row: Record<string, unknown>): SetRow {
  return hydrate<SetRow>(row, SET_MAPPING);
}

