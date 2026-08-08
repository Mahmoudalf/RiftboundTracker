import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  compareVersions,
  createDeck,
  listVersions,
  loadDeckList,
  lockVersion,
  saveDeckEdit,
  versionDiff,
  versionMatchCounts,
} from './decks';
import { versionStats } from './version-stats';

/**
 * How many versions a deck can accumulate before the app stops coping.
 *
 * Not a correctness test — a measurement, kept in the suite so the number is
 * re-derived when the queries change rather than quoted from a document.
 *
 * The thing under test is what *deck detail* does on every focus, because that
 * is where the cost lands: `versionDiff` per node loads two decklists, and
 * `versionStats` loads one more, so a screen showing N versions runs ~3N
 * `loadDeckList` calls before it can draw anything.
 */

const REALISTIC_MAIN = 40;

/**
 * Kept short so the suite stays fast. The full sweep run while writing this
 * went to 800 versions and stayed linear throughout — 133 ms per focus, 353 ms
 * to open the Versions tab, 11.1 MB. Raise these if you want to see it again.
 */
const CHECKPOINTS = [10, 50, 200];

/** legend + champion + 40 main + 4 runes + 3 battlefields. */
const SLOTS_PER_VERSION = 49;

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

function seedCard(id: string, name: string, type = 'Unit'): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      name,
      name,
      1,
      type,
      'Common',
      '["Fury"]',
      'Fury',
      '[]',
      'OGN',
      'Origins',
      'https://cdn.example/a-744x1039.png',
      'A',
      'portrait',
    ]
  );
  return {
    id,
    riftboundId: `ogn-${id}-1`,
    tcgplayerId: null,
    name,
    cleanName: name,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    type,
    supertype: null,
    rarity: 'Common',
    domains: ['Fury'],
    domainKey: 'Fury',
    textPlain: null,
    textRich: null,
    flavour: null,
    tags: [],
    setId: 'OGN',
    setLabel: 'Origins',
    imageUrl: 'https://cdn.example/a-744x1039.png',
    artist: 'A',
    accessibilityText: null,
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    updatedOn: null,
  };
}

/** A full legal-sized list, so every fork copies the ~57 rows a real one does. */
function buildRealisticDeck() {
  const legend = seedCard('legend', 'Vi - Piltover Enforcer', 'Legend');
  const champion = seedCard('champion', 'Vi - Enforcer');
  const main = Array.from({ length: REALISTIC_MAIN }, (_, i) => seedCard(`m${i}`, `Main ${i}`));
  const runes = Array.from({ length: 4 }, (_, i) => seedCard(`r${i}`, `Rune ${i}`, 'Rune'));
  const fields = Array.from({ length: 3 }, (_, i) =>
    seedCard(`b${i}`, `Battlefield ${i}`, 'Battlefield')
  );
  // The pool the edits draw from, so a swap points at a card that exists.
  const spares = Array.from({ length: 250 }, (_, i) => seedCard(`s${i}`, `Spare ${i}`));

  const { deckId, versionId } = createDeck({ name: 'Scaling', legend, champion });

  saveDeckEdit(versionId, {
    slots: [
      { card: legend, quantity: 1, zone: 'legend' },
      { card: champion, quantity: 1, zone: 'champion' },
      ...main.map((card) => ({ card, quantity: 1, zone: 'main' as const })),
      ...runes.map((card) => ({ card, quantity: 3, zone: 'rune' as const })),
      ...fields.map((card) => ({ card, quantity: 1, zone: 'battlefield' as const })),
    ],
  });

  return { deckId, versionId, spares };
}

/** What deck detail reads on every focus, regardless of tab. */
function loadOverview(deckId: string) {
  listVersions(deckId);
  versionMatchCounts(deckId);
  return versionStats(deckId);
}

/** What the Versions tab adds on top — one diff per node, two list loads each. */
function loadTimelineNodes(deckId: string) {
  return listVersions(deckId).map((v) => versionDiff(v.id));
}

describe('version scaling', () => {
  it('measures the cost of a long version history', () => {
    const { deckId, versionId, spares } = buildRealisticDeck();

    let current = versionId;
    let swapped = 0;
    const rows: string[] = [];

    for (const target of CHECKPOINTS) {
      while (listVersions(deckId).length < target) {
        /*
         * A real edit: lock the played list, then swap one card for another.
         * The deck stays 40 cards — an earlier version of this loop only ever
         * added, which made rows grow quadratically and told us nothing about
         * the app.
         */
        lockVersion(current);
        const slots = loadDeckList(current).slots;
        const main = slots.filter((s) => s.zone === 'main');
        current = saveDeckEdit(current, {
          slots: [
            ...slots.filter((s) => s.zone !== 'main'),
            ...main.slice(1),
            { card: spares[swapped % spares.length]!, quantity: 1, zone: 'main' },
          ],
        }).versionId;
        swapped += 1;
      }

      // What every focus of deck detail costs, whichever tab you are on.
      const overviewStart = performance.now();
      loadOverview(deckId);
      const overviewMs = performance.now() - overviewStart;

      // What opening the Versions tab adds on top: one diff per node.
      const diffStart = performance.now();
      const nodes = loadTimelineNodes(deckId);
      const diffMs = performance.now() - diffStart;

      const compareStart = performance.now();
      compareVersions(versionId, current);
      const compareMs = performance.now() - compareStart;

      const cardRows = db.getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM deck_version_cards'
      )!.n;
      const bytes =
        db.getFirstSync<{ n: number }>('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()')?.n ??
        0;

      expect(nodes).toHaveLength(target);
      // Snapshots, not diffs — storage is linear in versions by design, and a
      // regression to anything else is the thing this test exists to catch.
      expect(cardRows).toBe(target * SLOTS_PER_VERSION);
      // Comparing reads exactly two lists however long the history is.
      expect(compareMs).toBeLessThan(25);
      rows.push(
        `${String(target).padStart(4)} versions | every focus ${overviewMs.toFixed(0).padStart(4)} ms | ` +
          `+Versions tab ${diffMs.toFixed(0).padStart(4)} ms | ` +
          `compare ${compareMs.toFixed(1).padStart(4)} ms | ` +
          `${String(cardRows).padStart(6)} rows | ${(bytes / 1024 / 1024).toFixed(2)} MB`
      );
    }

    console.log(`\nVersion history scaling (${REALISTIC_MAIN}-card main deck)\n${rows.join('\n')}\n`);
  }, 120_000);
});
