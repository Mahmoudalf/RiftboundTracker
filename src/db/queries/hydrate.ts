import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { cards, sets, type CardRow, type SetRow } from '../schema/cards';
import {
  deckVersionCards,
  deckVersions,
  decks,
  type DeckRow,
  type DeckVersionRow,
} from '../schema/decks';
import {
  matchGames,
  matches,
  type MatchGameRow,
  type MatchRow,
} from '../schema/matches';

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
  if (column.dataType === 'json') {
    // Mirrors `coerce()` exactly. This used to be `JSON.stringify(value ?? [])`,
    // which wrote "[]" for a null — harmless for cards, whose JSON columns are
    // all NOT NULL, and silently destructive for the nullable ones on matches,
    // where null and [] are different answers. Nothing writes matches through
    // this path today; the asymmetry is removed so that staying true is not a
    // condition the next generic insert helper has to know about.
    if (value === null || value === undefined) return column.notNull ? '[]' : null;
    return JSON.stringify(value);
  }
  if (column.dataType === 'boolean') return value ? 1 : 0;
  if (value === null || value === undefined) {
    if (column.notNull && column.defaultValue !== undefined) {
      return column.defaultValue as string | number;
    }
    return null;
  }
  return value as string | number;
}

/** JSON columns in this schema hold `string[]` whenever they hold anything. */
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

function coerce(value: unknown, dataType: string, notNull: boolean): unknown {
  if (dataType === 'json') {
    /*
     * A **nullable** JSON column keeps its null.
     *
     * Cards are unaffected — every JSON column there is NOT NULL, so an absent
     * value really does mean an empty list. Matches are the opposite:
     * `opp_domains` and `tags` are nullable because "I did not record this" and
     * "I recorded that there were none" are different answers, and flattening
     * the first into `[]` would turn a missing observation into a real one.
     * That is the same mistake as storing an unknown on-the-play as `false`.
     */
    if (value === null || value === undefined) return notNull ? [] : null;
    return parseJsonArray(value);
  }
  if (value === null || value === undefined) return null;
  // SQLite has no boolean type — these round-trip as 0/1 integers.
  if (dataType === 'boolean') return Boolean(value);
  if (dataType === 'number') return typeof value === 'number' ? value : Number(value);
  return value;
}

function hydrate<T>(row: Record<string, unknown>, mapping: ColumnMapping[]): T {
  const out: Record<string, unknown> = {};
  for (const { sqlName, key, dataType, notNull } of mapping) {
    out[key] = coerce(row[sqlName], dataType, notNull);
  }
  return out as T;
}

export function hydrateCard(row: Record<string, unknown>): CardRow {
  return hydrate<CardRow>(row, CARD_MAPPING);
}

export function hydrateSet(row: Record<string, unknown>): SetRow {
  return hydrate<SetRow>(row, SET_MAPPING);
}

/**
 * The deck tables go through exactly the same derivation. They are even more
 * exposed to the snake_case gap than cards are — `current_version_id`,
 * `locked_at`, `version_number` and `deck_version_id` are all multi-word, and a
 * silently-undefined `lockedAt` would read as "this version is editable" on a
 * version that has matches attached to it.
 */
export const deckColumns: ColumnMapping[] = buildMapping(decks);
export const deckVersionColumns: ColumnMapping[] = buildMapping(deckVersions);
export const deckVersionCardColumns: ColumnMapping[] = buildMapping(deckVersionCards);

export function hydrateDeck(row: Record<string, unknown>): DeckRow {
  return hydrate<DeckRow>(row, deckColumns);
}

export function hydrateDeckVersion(row: Record<string, unknown>): DeckVersionRow {
  return hydrate<DeckVersionRow>(row, deckVersionColumns);
}

/**
 * Matches, through the same derivation, and the most exposed of the three.
 * `deck_version_id`, `opp_legend_card_id`, `played_at` and `on_play` are every
 * one of them multi-word — a silently-undefined `deckVersionId` would attach a
 * result to no list at all, which is the failure the whole version model exists
 * to prevent.
 *
 * `match_games` gains its hydrator here in M6, alongside the queries that read
 * it — it was deliberately absent while the table had no consumer. `events` is
 * still absent for the same reason; it arrives with event mode.
 */
export const matchColumns: ColumnMapping[] = buildMapping(matches);
export const matchGameColumns: ColumnMapping[] = buildMapping(matchGames);

export function hydrateMatch(row: Record<string, unknown>): MatchRow {
  return hydrate<MatchRow>(row, matchColumns);
}

export function hydrateMatchGame(row: Record<string, unknown>): MatchGameRow {
  return hydrate<MatchGameRow>(row, matchGameColumns);
}

