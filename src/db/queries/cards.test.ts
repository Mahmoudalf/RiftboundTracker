import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { queryCards, setFacets } from './cards';
import { cardColumns, toBindValue } from './hydrate';

/**
 * Card filtering, against the real 1,451-card library.
 *
 * The builder's filter row mixes a supertype in with three types, which is the
 * case most likely to be wrong: get the combination backwards and the grid
 * empties, or Champions vanish from the Unit filter.
 */

const SEED = join(process.cwd(), 'assets/seed/cards.json');
const hasSeed = existsSync(SEED);

let db: TestDatabase;

beforeEach(() => {
  if (!hasSeed) return;
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);

  const cards: CardRow[] = JSON.parse(readFileSync(SEED, 'utf8')).cards;
  const sql = `INSERT INTO cards (${cardColumns.map((c) => c.sqlName).join(',')})
               VALUES (${cardColumns.map(() => '?').join(',')})`;
  db.withTransactionSync(() => {
    for (const card of cards) {
      db.runSync(
        sql,
        cardColumns.map((c) => toBindValue((card as Record<string, unknown>)[c.key], c))
      );
    }
  });
});

afterEach(() => {
  if (!hasSeed) return;
  setTestConnection(null);
  db.close();
});

describe.skipIf(!hasSeed)('type and supertype filters', () => {
  it('filters by type', () => {
    const spells = queryCards({ types: ['Spell'] });
    expect(spells.length).toBeGreaterThan(0);
    expect(spells.every((c) => c.type === 'Spell')).toBe(true);
  });

  it('filters by supertype', () => {
    const champions = queryCards({ supertypes: ['Champion'] });
    expect(champions.length).toBeGreaterThan(0);
    expect(champions.every((c) => c.supertype === 'Champion')).toBe(true);
  });

  /**
   * The reason these are two fields rather than one list. A player selecting
   * "Spell" and "Champion" wants both sets shown — AND-ing them asks for a card
   * that is a Spell *and* a Champion, which is nothing.
   */
  it('unions types with supertypes rather than intersecting them', () => {
    const both = queryCards({ types: ['Spell'], supertypes: ['Champion'] });
    const spells = queryCards({ types: ['Spell'] });
    const champions = queryCards({ supertypes: ['Champion'] });

    expect(both.length).toBe(spells.length + champions.length);
    expect(both.some((c) => c.type === 'Spell')).toBe(true);
    expect(both.some((c) => c.supertype === 'Champion')).toBe(true);
  });

  it('keeps Champion Units inside the Unit filter', () => {
    // Champion is a supertype, so a Champion Unit is still a Unit. Folding the
    // two together would either hide it here or list every Unit as a Champion.
    const units = queryCards({ types: ['Unit'] });
    expect(units.some((c) => c.supertype === 'Champion')).toBe(true);
  });

  it('combines with an identity filter', () => {
    const identity = ['Fury', 'Order'];
    const filtered = queryCards({ types: ['Unit'], identity });

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((c) => c.domains.every((d) => d === 'Colorless' || identity.includes(d)))
    ).toBe(true);
  });

  it('returns everything when neither is given', () => {
    expect(queryCards({}).length).toBe(1451);
  });
});

describe.skipIf(!hasSeed)('setFacets', () => {
  it('returns each set once, with a readable label', () => {
    const facets = setFacets();

    expect(facets.length).toBeGreaterThan(1);
    expect(new Set(facets.map((f) => f.setId)).size).toBe(facets.length);
    // A chip reading "VEN" means nothing to someone who has not memorised the
    // set codes — which is the point of having the filter at all.
    for (const facet of facets) {
      expect(facet.label).toBeTruthy();
      expect(facet.label).not.toBe(facet.setId);
    }
  });

  it('names only sets that are actually in the library', () => {
    const present = new Set(queryCards({}).map((c) => c.setId));
    for (const facet of setFacets()) expect(present.has(facet.setId)).toBe(true);
  });

  it('filters by set', () => {
    const [first] = setFacets();
    const cards = queryCards({ sets: [first!.setId] });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.setId === first!.setId)).toBe(true);
  });
});

describe.skipIf(!hasSeed)('sorting', () => {
  it('sorts by name and by energy', () => {
    const byName = queryCards({ types: ['Spell'], sort: 'name' });
    const names = byName.map((c) => c.cleanName.toLowerCase());
    expect([...names].sort()).toEqual(names);

    const byEnergy = queryCards({ types: ['Spell'], sort: 'energy' });
    const costs = byEnergy.map((c) => c.energy).filter((e): e is number => e !== null);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });
});
