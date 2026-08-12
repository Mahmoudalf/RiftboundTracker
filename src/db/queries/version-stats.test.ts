import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, saveDeckEdit } from './decks';
import { logGame } from './games';
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

    // The build edit is a version of its own now, so matches attach to it.
    const v1 = saveDeckEdit(versionId, list(a)).versionId;
    logGame({ deckId, deckVersionId: v1, result: 'win' });
    const v2 = saveDeckEdit(v1, list(b)).versionId;
    logGame({ deckId, deckVersionId: v2, result: 'loss' });

    const stats = versionStats(deckId);
    // Three versions now: the seeded v1, plus one per edit. v1 was never
    // played, and still gets a row — a version with no matches is a real
    // version with no matches.
    expect(stats).toHaveLength(3);
    // Newest first, matching the timeline.
    expect(versionStatLabel(stats[0]!)).toBe('v3');
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

    const built = saveDeckEdit(versionId, list(standard)).versionId;
    logGame({ deckId, deckVersionId: built, result: 'win' });
    logGame({ deckId, deckVersionId: built, result: 'win' });

    // Same cards, different printing — and it still forks.
    const swapped = saveDeckEdit(built, list(alt));
    expect(swapped.outcome).toBe('forked');
    logGame({ deckId, deckVersionId: swapped.versionId, result: 'loss' });

    const stats = versionStats(deckId);
    // The pooled pair, plus the seeded v1 that was never played.
    expect(stats).toHaveLength(2);
    expect(stats[0]!.pooled).toBe(true);
    expect(versionStatLabel(stats[0]!)).toBe('v2 + v3');
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

    const current = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
        { card: b, quantity: 1, zone: 'main' },
      ],
    }).versionId;
    logGame({ deckId, deckVersionId: current, result: 'win' });

    // Same cards, same counts, written in a different order.
    const forked = saveDeckEdit(current, {
      slots: [
        { card: b, quantity: 1, zone: 'main' },
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    });
    // Identical, so it is a no-op — nothing to pool because nothing forked.
    expect(forked.outcome).toBe('no-op');
    // Still just the seeded v1 and the built version — a no-op adds nothing.
    expect(versionStats(deckId)).toHaveLength(2);
  });
});
