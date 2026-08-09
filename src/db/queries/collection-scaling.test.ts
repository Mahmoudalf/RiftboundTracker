import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  adjustCardQuantity,
  binderQuantities,
  createBinder,
  listBinders,
  ownedCounts,
} from './collection';

/**
 * What the Collection tab costs as a collection grows.
 *
 * Every tap on a card runs the screen's whole reload: `listBinders`,
 * `ownedCounts`, and — while a binder is selected — `binderQuantities` for it. So
 * the number that matters is not "can it store 10,000 cards" but "does the
 * grid still respond on the ten-thousandth tap".
 *
 * Node's in-memory SQLite, so treat these as a lower bound and a shape.
 */

const CHECKPOINTS = [500, 2_000, 8_000];

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

function seedCard(id: string): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      id,
      id,
      1,
      'Unit',
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
  return { id, riftboundId: `ogn-${id}-1`, name: id, cleanName: id } as CardRow;
}

describe('collection scaling', () => {
  it('measures a tap as the collection grows', () => {
    // Four binders, so `ownedCounts` has real grouping work to do rather than
    // one row per card.
    const binderIds = ['Trade', 'Deck box', 'Bulk', 'Sets'].map((name) =>
      createBinder({ name })
    );
    const rows: string[] = [];
    let seeded = 0;

    for (const target of CHECKPOINTS) {
      while (seeded < target) {
        const card = seedCard(`c${seeded}`);
        adjustCardQuantity(binderIds[seeded % binderIds.length]!, card, (seeded % 4) + 1);
        seeded += 1;
      }

      const first = binderIds[0]!;
      const start = performance.now();
      listBinders();
      const listMs = performance.now() - start;

      const countsStart = performance.now();
      const counts = ownedCounts();
      const countsMs = performance.now() - countsStart;

      const cardsStart = performance.now();
      binderQuantities(first);
      const cardsMs = performance.now() - cardsStart;
      const tapMs = performance.now() - start;

      const bytes =
        db.getFirstSync<{ n: number }>(
          'SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()'
        )?.n ?? 0;

      expect(counts.size).toBe(target);
      rows.push(
        `${String(target).padStart(6)} cards | tap ${tapMs.toFixed(1).padStart(6)} ms ` +
          `(binders ${listMs.toFixed(1)} + owned ${countsMs.toFixed(1)} + contents ${cardsMs.toFixed(1)}) | ` +
          `${(bytes / 1024 / 1024).toFixed(2)} MB`
      );
    }

    console.log(`\nCollection scaling (4 binders)\n${rows.join('\n')}\n`);
  }, 120_000);
});
