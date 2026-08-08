import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, saveDeckEdit } from './decks';
import { logMatch } from './matches';
import { versionStatLabel, versionStats } from './version-stats';

/**
 * Per-version stats, and the pooling that pays back an M3 decision.
 *
 * Changing a card's art on a locked version forks rather than rewrites, because
 * the played record must stay true. The price was a split sample. These tests
 * assert the price is refunded at read time.
 */

let db: TestDatabase;

function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: `rb-${overrides.id}`, tcgplayerId: null, name: 'Test Card',
    cleanName: 'Test Card', collectorNumber: 1, energy: null, might: null, power: null,
    type: 'Spell', supertype: null, rarity: 'Common', domains: ['Fury'], domainKey: 'Fury',
    textPlain: null, textRich: null, flavour: null, tags: [], setId: 'OGN', setLabel: 'Origins',
    imageUrl: 'https://cdn.example/art.png', artist: 'Someone', accessibilityText: null,
    orientation: 'portrait', alternateArt: false, signature: false, overnumbered: false,
    isNew: false, updatedOn: null, ...overrides,
  };
  db.runSync(
    `INSERT OR REPLACE INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, supertype,
        rarity, domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      card.id, card.riftboundId, card.name, card.cleanName, card.collectorNumber,
      card.type, card.supertype, card.rarity, JSON.stringify(card.domains),
      card.domainKey, JSON.stringify(card.tags), card.setId, card.setLabel,
      card.imageUrl, card.artist, card.orientation,
    ]
  );
  return card;
}

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

function makeDeck() {
  const legend = seedCard({
    id: 'legend-1', name: 'Vi - Piltover Enforcer', type: 'Legend',
    domains: ['Fury', 'Order'], domainKey: 'Fury,Order', tags: ['Vi'],
  });
  return { legend, ...createDeck({ name: 'Vi', legend, champion: null }) };
}

describe('versionStats', () => {
  it('reports each version separately when the cards differ', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });
    const list = (card: CardRow) => ({
      slots: [
        { card: legend, quantity: 1, zone: 'legend' as const },
        { card, quantity: 2, zone: 'main' as const },
      ],
    });

    saveDeckEdit(versionId, list(a));
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    const v2 = saveDeckEdit(versionId, list(b)).versionId;
    logMatch({ deckId, deckVersionId: v2, result: 'loss' });

    const stats = versionStats(deckId);
    expect(stats).toHaveLength(2);
    // Newest first, matching the timeline.
    expect(versionStatLabel(stats[0]!)).toBe('v2');
    expect(stats[0]!.rate.losses).toBe(1);
    expect(stats[1]!.rate.wins).toBe(1);
    expect(stats.every((s) => !s.pooled)).toBe(true);
  });

  /**
   * The refund. Two versions differing only in printing are one deck to every
   * rule and every statistic, so their matches belong to one sample.
   */
  it('pools versions whose card sets differ only by printing', () => {
    const { deckId, versionId, legend } = makeDeck();
    const standard = seedCard({ id: 'p1', name: 'Statikk Shock' });
    const alt = seedCard({ id: 'p2', name: 'Statikk Shock (Alternate Art)', alternateArt: true });
    const list = (card: CardRow) => ({
      slots: [
        { card: legend, quantity: 1, zone: 'legend' as const },
        { card, quantity: 2, zone: 'main' as const },
      ],
    });

    saveDeckEdit(versionId, list(standard));
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    // Locked by the matches above, so the art swap forks.
    const swapped = saveDeckEdit(versionId, list(alt));
    expect(swapped.outcome).toBe('forked');
    logMatch({ deckId, deckVersionId: swapped.versionId, result: 'loss' });

    const stats = versionStats(deckId);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.pooled).toBe(true);
    expect(versionStatLabel(stats[0]!)).toBe('v1 + v2');
    // One sample of three, not two samples of two and one.
    expect(stats[0]!.rate.total).toBe(3);
    expect(stats[0]!.rate.wins).toBe(2);
    expect(stats[0]!.rate.losses).toBe(1);
  });

  it('counts a version with no matches as an empty rate rather than omitting it', () => {
    const { deckId } = makeDeck();
    const stats = versionStats(deckId);

    expect(stats).toHaveLength(1);
    expect(stats[0]!.rate.total).toBe(0);
    expect(stats[0]!.rate.rate).toBeNull();
  });

  it('ignores quantity order and slot order when pooling', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });

    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
        { card: b, quantity: 1, zone: 'main' },
      ],
    });
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    // Same cards, same counts, written in a different order.
    const forked = saveDeckEdit(versionId, {
      slots: [
        { card: b, quantity: 1, zone: 'main' },
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    });
    // Identical, so it is a no-op — nothing to pool because nothing forked.
    expect(forked.outcome).toBe('no-op');
    expect(versionStats(deckId)).toHaveLength(1);
  });
});
