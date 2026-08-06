import { sqlite } from '../client';
import type { CardRow, SetRow } from '../schema/cards';

import { hydrateCard, hydrateSet } from './hydrate';

/**
 * Card queries.
 *
 * Filtering happens here, against the local mirror, because the API supports
 * none of it (docs/API.md §4). Hand-written SQL rather than the Drizzle query
 * builder: combining an FTS5 match with dynamic filters is far clearer written
 * out, and this is the app's hottest read path.
 *
 * Every row goes through `hydrateCard()` — SQLite returns snake_case column
 * names and the row type is camelCase, so casting straight across silently
 * yields `undefined` for every multi-word field.
 */

export type CardSort = 'name' | 'energy' | 'collector' | 'rarity' | 'relevance';

export interface CardFilters {
  /** Free text. Matched against name, rules text, tags, and artist via FTS5. */
  search?: string;
  sets?: string[];
  types?: string[];
  /** Matches cards containing ANY of these domains. */
  domains?: string[];
  rarities?: string[];
  /** Energy cost. 7 means "7 or more". */
  energy?: number[];
  /** Exclude alternate-art printings — on by default in the gallery. */
  hideAlternateArt?: boolean;
  sort?: CardSort;
}

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'];

/**
 * Escape a user query for FTS5 and make it a prefix search, so results appear
 * while typing rather than only on a completed word.
 *
 * Double quotes delimit FTS5 string literals, so each token is quoted and given
 * a `*` suffix. Returns null when nothing searchable survives sanitising.
 */
export function toFtsQuery(input: string): string | null {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

/**
 * Build the WHERE clause shared by `queryCards` and `countCards`.
 *
 * Split out so the filter sheet's live "Show N cards" readout can run a
 * COUNT(*) instead of selecting and hydrating the whole library just to call
 * `.length` on it — measured at ~4.9 ms per render versus a fraction of that.
 */
function buildFilter(filters: CardFilters): {
  where: string[];
  params: (string | number)[];
  ftsQuery: string | null;
} {
  const where: string[] = [];
  const params: (string | number)[] = [];

  const searchTerm = filters.search?.trim() ?? '';
  const ftsQuery = searchTerm ? toFtsQuery(searchTerm) : null;

  if (ftsQuery) {
    where.push(`c.rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`);
    params.push(ftsQuery);
  }

  const inClause = (column: string, values: string[] | undefined) => {
    if (!values?.length) return;
    where.push(`c.${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  };

  inClause('set_id', filters.sets);
  inClause('type', filters.types);
  inClause('rarity', filters.rarities);

  if (filters.domains?.length) {
    // domain_key is a canonical CSV such as "Fury,Order". Anchored with commas
    // on both sides so "Order" cannot match a hypothetical "Disorder".
    const clauses = filters.domains.map(() => `(',' || c.domain_key || ',') LIKE ?`);
    where.push(`(${clauses.join(' OR ')})`);
    params.push(...filters.domains.map((d) => `%,${d},%`));
  }

  if (filters.energy?.length) {
    const exact = filters.energy.filter((e) => e < 7);
    const clauses: string[] = [];
    if (exact.length) {
      clauses.push(`c.energy IN (${exact.map(() => '?').join(',')})`);
      params.push(...exact);
    }
    // The cost filter tops out at "7+", matching how the gallery presents it.
    if (filters.energy.some((e) => e >= 7)) clauses.push(`c.energy >= 7`);
    if (clauses.length) where.push(`(${clauses.join(' OR ')})`);
  }

  if (filters.hideAlternateArt) where.push(`c.alternate_art = 0`);

  return { where, params, ftsQuery };
}

export function queryCards(filters: CardFilters = {}): CardRow[] {
  const { where, params, ftsQuery } = buildFilter(filters);
  const searchTerm = filters.search?.trim() ?? '';

  const requestedSort = filters.sort ?? 'name';
  // "Relevance" only means anything with a search term behind it.
  const sort = requestedSort === 'relevance' && !ftsQuery ? 'name' : requestedSort;

  let orderBy: string;
  if (sort === 'relevance') {
    // Rank by where the term lands in the *name* rather than by bm25 over rules
    // text: someone typing "vi" wants the card called Vi, not every card whose
    // text happens to contain the token.
    orderBy = `
      CASE
        WHEN c.clean_name LIKE ? THEN 0
        WHEN c.clean_name LIKE ? THEN 1
        ELSE 2
      END ASC, c.clean_name COLLATE NOCASE ASC`;
    params.push(`${searchTerm}%`, `%${searchTerm}%`);
  } else {
    orderBy = {
      name: `c.clean_name COLLATE NOCASE ASC`,
      energy: `c.energy IS NULL, c.energy ASC, c.clean_name COLLATE NOCASE ASC`,
      collector: `c.set_id ASC, c.collector_number ASC`,
      rarity: `CASE c.rarity ${RARITY_ORDER.map((r, i) => `WHEN '${r}' THEN ${i}`).join(' ')} ELSE 99 END ASC, c.clean_name COLLATE NOCASE ASC`,
    }[sort];
  }

  const statement = `
    SELECT c.* FROM cards c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
  `;

  return sqlite
    .getAllSync<Record<string, unknown>>(statement, params)
    .map(hydrateCard);
}

export function getCard(id: string): CardRow | null {
  const row = sqlite.getFirstSync<Record<string, unknown>>(
    'SELECT * FROM cards WHERE id = ?',
    [id]
  );
  return row ? hydrateCard(row) : null;
}

export function countCards(): number {
  return sqlite.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM cards')?.n ?? 0;
}

/** How many cards a filter set would match, without selecting or hydrating them. */
export function countMatchingCards(filters: CardFilters = {}): number {
  const { where, params } = buildFilter(filters);
  const statement = `
    SELECT COUNT(*) AS n FROM cards c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  return sqlite.getFirstSync<{ n: number }>(statement, params)?.n ?? 0;
}

export function listSets(): SetRow[] {
  return sqlite
    .getAllSync<Record<string, unknown>>('SELECT * FROM sets ORDER BY published_on DESC')
    .map(hydrateSet);
}

/** Distinct values actually present in the mirror — drives the filter sheet. */
export function facetValues(column: 'type' | 'rarity' | 'set_id'): string[] {
  return sqlite
    .getAllSync<{ v: string }>(
      `SELECT DISTINCT ${column} AS v FROM cards WHERE ${column} IS NOT NULL ORDER BY v`
    )
    .map((r) => r.v);
}
