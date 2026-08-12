import { domainKey } from '@/api/riftcodex/mapper';
import { baseName, championMatchesLegend, isPickablePrinting, variantLabel } from '@/lib/card-identity';

import { conn } from '../connection';
import type { CardRow } from '../schema/cards';

import { hydrateCard } from './hydrate';

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
  /**
   * Card supertypes — `Champion`, `Signature`, `Basic`, `Token`.
   *
   * Separate from `types` because the builder's filter row mixes them: a player
   * picking "Unit, Spell, Gear, Champion" is naming three types and one
   * supertype, and Champion Units are Units. Folding them together would either
   * hide Champions from the Unit filter or list every Unit under Champion.
   */
  supertypes?: string[];
  /** Matches cards containing ANY of these domains. */
  domains?: string[];
  /**
   * A Legend's domains. Matches only cards legal in that identity — every one
   * of a card's domains must be inside it, so a dual-domain card needs both.
   *
   * Distinct from `domains`, which is the gallery's "show me anything red"
   * filter. Getting these two confused would offer the builder cards it cannot
   * legally hold.
   */
  identity?: string[];
  rarities?: string[];
  /** Energy cost. 7 means "7 or more". */
  energy?: number[];
  /** Exclude alternate-art printings — on by default in the gallery. */
  hideAlternateArt?: boolean;
  sort?: CardSort;
}

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'];

/**
 * Every `domain_key` a card may have and still sit inside `identity`.
 *
 * Built with the same `domainKey()` the mirror was written with, so the
 * canonical ordering cannot drift between the two — a hand-sorted key here that
 * disagreed by one position would silently return nothing.
 */
function identityKeys(identity: readonly string[]): string[] {
  const keys = new Set<string>(['Colorless']);
  for (const domain of identity) keys.add(domainKey([domain]));
  for (let i = 0; i < identity.length; i++) {
    for (let j = i + 1; j < identity.length; j++) {
      keys.add(domainKey([identity[i]!, identity[j]!]));
    }
  }
  return [...keys];
}

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
  inClause('rarity', filters.rarities);

  /*
   * Types and supertypes are OR'd with each other, not AND'd.
   *
   * The builder's row reads "Unit, Spell, Gear, Champion" as one list of things
   * to show. AND-ing them would ask for cards that are simultaneously a Spell
   * and a Champion, which is nothing — selecting both would empty the grid.
   */
  const kindClauses: string[] = [];
  if (filters.types?.length) {
    kindClauses.push(`c.type IN (${filters.types.map(() => '?').join(',')})`);
    params.push(...filters.types);
  }
  if (filters.supertypes?.length) {
    kindClauses.push(`c.supertype IN (${filters.supertypes.map(() => '?').join(',')})`);
    params.push(...filters.supertypes);
  }
  if (kindClauses.length) where.push(`(${kindClauses.join(' OR ')})`);

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

  if (filters.identity?.length) {
    // `domain_key` is a canonically ordered CSV, so "every domain of this card
    // is inside the identity" is just membership in the set of keys the
    // identity can produce. A 2-domain identity yields four: each domain alone,
    // both together, and Colorless — which is what makes every Battlefield
    // legal everywhere. Enumerating beats a LIKE per domain and stays exact.
    const keys = identityKeys(filters.identity);
    where.push(`c.domain_key IN (${keys.map(() => '?').join(',')})`);
    params.push(...keys);
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

  return conn().getAllSync<Record<string, unknown>>(statement, params)
    .map(hydrateCard);
}

export function getCard(id: string): CardRow | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM cards WHERE id = ?',
    [id]
  );
  return row ? hydrateCard(row) : null;
}

/**
 * Names for a set of card ids, in one query.
 *
 * Two columns and no hydration, for the same reason `binderQuantities()` exists:
 * the analytics layer works in ids and only needs a label at the very end, and
 * hydrating ~29 columns per card to read one of them measured as 88 % of a tap
 * when the collection did it.
 *
 * Ids the mirror cannot resolve are **absent from the map** rather than mapped
 * to a placeholder, so a caller can tell "gone from the library" apart from a
 * card genuinely called something odd.
 */
export function cardNamesByIds(ids: readonly string[]): Map<string, string> {
  if (ids.length === 0) return new Map();
  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => '?').join(',');

  const rows = conn().getAllSync<{ id: string; name: string }>(
    `SELECT id, name FROM cards WHERE id IN (${placeholders})`,
    [...unique]
  );

  return new Map(rows.map((row) => [row.id, row.name]));
}

/** How many cards a filter set would match, without selecting or hydrating them. */
export function countMatchingCards(filters: CardFilters = {}): number {
  const { where, params } = buildFilter(filters);
  const statement = `
    SELECT COUNT(*) AS n FROM cards c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  return conn().getFirstSync<{ n: number }>(statement, params)?.n ?? 0;
}


/**
 * Every Legend printing, variants included.
 *
 * Printings rather than distinct cards, because choosing a Legend is also
 * choosing its art — the standard, alternate-art, overnumbered and signature
 * treatments are the same card to the rules and a different object to the
 * player. Variants of one Legend sort adjacent so the choice reads as "which
 * Vi" rather than as four unrelated entries.
 */
export function listLegends(): CardRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT c.* FROM cards c
        WHERE c.type = 'Legend'
        ORDER BY c.clean_name COLLATE NOCASE ASC,
                 c.alternate_art ASC, c.overnumbered ASC, c.collector_number ASC`
    )
    .map(hydrateCard)
    // Metal, Signature, Starter and the one-offs are the same Legend in other
    // packaging; the picker offers the three treatments a decklist distinguishes.
    .filter(isPickablePrinting)
    .sort(byCardThenVariant);
}

/**
 * Champion Unit printings that may legally partner a Legend.
 *
 * Matching is on tags, which SQLite cannot index into, so the type filter runs
 * in SQL and the tag intersection in JS — 376 Champion Units narrowed to a
 * handful, once, when the picker opens.
 */
export function listChampionsForLegend(legend: CardRow): CardRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT c.* FROM cards c
        WHERE c.type = 'Unit' AND c.supertype = 'Champion'
        ORDER BY c.clean_name COLLATE NOCASE ASC, c.alternate_art ASC`
    )
    .map(hydrateCard)
    .filter(isPickablePrinting)
    .filter((c) => {
      const { nameMatches, inIdentity } = championMatchesLegend(c, legend);
      return nameMatches && inIdentity;
    })
    .sort(byCardThenVariant);
}

/**
 * Rune printings legal in an identity.
 *
 * There is exactly one rune card per domain, in five art treatments, so a
 * two-domain deck picks between 10 printings of 2 cards. Grouped by card so the
 * art choice sits next to what it is art for.
 */
export function listRunesForIdentity(identity: readonly string[]): CardRow[] {
  if (identity.length === 0) return [];
  const keys = identityKeys(identity).filter((k) => k !== 'Colorless');
  if (keys.length === 0) return [];

  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT c.* FROM cards c
        WHERE c.type = 'Rune' AND c.domain_key IN (${keys.map(() => '?').join(',')})
        ORDER BY c.clean_name COLLATE NOCASE ASC, c.collector_number ASC`,
      keys
    )
    .map(hydrateCard)
    .sort(byCardThenVariant);
}

/** Every Battlefield printing. All are Colorless, so all are legal everywhere. */
export function listBattlefields(): CardRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT c.* FROM cards c
        WHERE c.type = 'Battlefield'
        ORDER BY c.clean_name COLLATE NOCASE ASC, c.collector_number ASC`
    )
    .map(hydrateCard)
    .sort(byCardThenVariant);
}

/** Group printings of one card together, standard treatment first. */
function byCardThenVariant(a: CardRow, b: CardRow): number {
  const nameOrder = baseName(a.name).localeCompare(baseName(b.name));
  if (nameOrder !== 0) return nameOrder;
  const rank = (c: CardRow) => (variantLabel(c.name) === null ? 0 : 1);
  return rank(a) - rank(b) || a.name.localeCompare(b.name);
}

export interface SetFacet {
  setId: string;
  label: string;
}

/**
 * Sets present in the mirror, newest first.
 *
 * Codes and labels together, because a filter chip saying `VEN` means nothing
 * to someone who has not memorised the set codes — the point of the filter is
 * that they do not have to.
 */
export function setFacets(): SetFacet[] {
  return conn()
    .getAllSync<{ set_id: string; set_label: string }>(
      `SELECT set_id, set_label, MAX(collector_number) AS n
         FROM cards
        GROUP BY set_id, set_label
        ORDER BY n DESC`
    )
    .map((row) => ({ setId: row.set_id, label: row.set_label }));
}

/** Distinct values actually present in the mirror — drives the filter sheet. */
export function facetValues(column: 'type' | 'rarity' | 'set_id'): string[] {
  return conn().getAllSync<{ v: string }>(
      `SELECT DISTINCT ${column} AS v FROM cards WHERE ${column} IS NOT NULL ORDER BY v`
    )
    .map((r) => r.v);
}
