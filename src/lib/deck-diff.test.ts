import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';

import {
  describeDiff,
  diffLists,
  diffSize,
  suggestLabelFromDiff,
  type DeckDiff,
} from './deck-diff';
import type { DeckList, DeckSlot, DeckZone } from './legality';

/**
 * The diff engine, which decides whether a save is a change at all.
 *
 * The no-op case is the important one: if it ever returns a non-empty diff, a
 * deck's history fills with versions nobody made, every per-version sample is
 * split, and the feature reads as broken.
 */

function card(name: string, overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: overrides.id ?? name.toLowerCase().replace(/\W+/g, '-'),
    riftboundId: 'ogn-001-100',
    tcgplayerId: null,
    name,
    cleanName: name,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    type: 'Spell',
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
    imageUrl: 'https://cdn.example/art.png',
    artist: 'Someone',
    accessibilityText: null,
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    updatedOn: null,
    ...overrides,
  };
}

function list(...slots: [CardRow, number, DeckZone?][]): DeckList {
  return {
    slots: slots.map<DeckSlot>(([c, quantity, zone]) => ({
      card: c,
      quantity,
      zone: zone ?? 'main',
    })),
  };
}

const SPIRIT = card('Bewitching Spirit');
const STATIKK = card('Statikk Shock');
const BLADE = card('Blade of the Ruined King');

describe('diffLists', () => {
  it('reports an empty diff for two identical lists', () => {
    const a = list([SPIRIT, 3], [STATIKK, 2]);
    const b = list([SPIRIT, 3], [STATIKK, 2]);

    const diff = diffLists(a, b);
    expect(diff.isEmpty).toBe(true);
    expect(diff.cardSetIdentical).toBe(true);
    expect(diffSize(diff)).toBe(0);
    expect(diff.unchanged).toBe(5);
    expect(diff.netCardsMoved).toBe(0);
  });

  it('is order-independent — the editor reorders slots on every removal', () => {
    const a = list([SPIRIT, 3], [STATIKK, 2]);
    const b = list([STATIKK, 2], [SPIRIT, 3]);
    expect(diffLists(a, b).isEmpty).toBe(true);
  });

  it('ignores zero-quantity slots, which the editor leaves behind', () => {
    const a = list([SPIRIT, 3]);
    const b = list([SPIRIT, 3], [STATIKK, 0]);
    expect(diffLists(a, b).isEmpty).toBe(true);
  });

  it('reports additions and removals', () => {
    const diff = diffLists(list([SPIRIT, 2]), list([STATIKK, 3]));

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.card.name).toBe('Bewitching Spirit');
    expect(diff.removed[0]!.quantity).toBe(2);
    expect(diff.added[0]!.quantity).toBe(3);
    expect(diff.netCardsMoved).toBe(5);
    expect(diff.isEmpty).toBe(false);
  });

  it('reports a quantity change as one entry, not an add plus a remove', () => {
    const diff = diffLists(list([SPIRIT, 3]), list([SPIRIT, 1]));

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ from: 3, to: 1 });
    expect(diff.netCardsMoved).toBe(2);
  });

  it('treats the same card in a different zone as a move', () => {
    const diff = diffLists(list([SPIRIT, 1, 'main']), list([SPIRIT, 1, 'sideboard']));

    expect(diff.removed).toHaveLength(1);
    expect(diff.added).toHaveLength(1);
    expect(diff.zonesTouched).toEqual(['main', 'sideboard']);
  });

  describe('printings', () => {
    const standard = card('Poppy - Paragon', { id: 'p-std' });
    const alt = card('Poppy - Paragon (Alternate Art)', { id: 'p-alt', alternateArt: true });

    it('does not treat an art swap as a card change', () => {
      const diff = diffLists(list([standard, 2]), list([alt, 2]));

      // The rules see one card at two copies either way, so this must never
      // fork a version — the two would be indistinguishable in every
      // comparison the app can offer.
      expect(diff.cardSetIdentical).toBe(true);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.changed).toEqual([]);

      // Still real to the player who made it, so it is reported, not dropped.
      expect(diff.isEmpty).toBe(false);
      expect(diff.reprinted).toHaveLength(1);
      expect(diff.reprinted[0]).toMatchObject({ quantity: 2 });
      expect(diff.reprinted[0]!.to.id).toBe('p-alt');
    });

    it('counts printings of one card together', () => {
      const diff = diffLists(
        list([standard, 3]),
        list([standard, 1], [alt, 2])
      );
      expect(diff.cardSetIdentical).toBe(true);
      expect(diff.reprinted[0]).toMatchObject({ quantity: 2 });
    });

    it('reports a real count change even when the printing also moved', () => {
      const diff = diffLists(list([standard, 3]), list([alt, 1]));

      expect(diff.changed).toHaveLength(1);
      expect(diff.changed[0]).toMatchObject({ from: 3, to: 1 });
      expect(diff.cardSetIdentical).toBe(false);
    });
  });
});

describe('suggestLabelFromDiff', () => {
  const label = (a: DeckList, b: DeckList) => suggestLabelFromDiff(diffLists(a, b));

  it('is null when nothing changed', () => {
    expect(label(list([SPIRIT, 2]), list([SPIRIT, 2]))).toBeNull();
  });

  it('names the single change', () => {
    expect(label(list([SPIRIT, 2]), list())).toBe('−2 Bewitching Spirit');
    expect(label(list(), list([STATIKK, 3]))).toBe('+3 Statikk Shock');
  });

  it('leads with the largest change and counts the rest', () => {
    const before = list([SPIRIT, 2], [BLADE, 1]);
    const after = list([STATIKK, 3]);
    expect(label(before, after)).toBe('+3 Statikk Shock and 2 more');
  });

  it('prefers the cut when a swap is evenly matched', () => {
    expect(label(list([SPIRIT, 2]), list([STATIKK, 2]))).toBe(
      '−2 Bewitching Spirit and 1 more'
    );
  });

  it('describes an art-only change rather than returning nothing', () => {
    const std = card('Vi', { id: 'v1' });
    const alt = card('Vi (Signature)', { id: 'v2' });
    expect(label(list([std, 1]), list([alt, 1]))).toBe('New art for Vi');
  });

  it('strips the printing treatment from the name it suggests', () => {
    const alt = card('Statikk Shock (Alternate Art)', { id: 's-alt' });
    expect(label(list(), list([alt, 2]))).toBe('+2 Statikk Shock');
  });
});

describe('describeDiff', () => {
  it('puts cuts before additions, the way a swap is described', () => {
    const diff: DeckDiff = diffLists(list([SPIRIT, 2]), list([STATIKK, 2]));
    expect(describeDiff(diff).map((c) => c.text)).toEqual([
      '−2 Bewitching Spirit',
      '+2 Statikk Shock',
    ]);
  });

  it('gives every chip a stable, unique key', () => {
    const diff = diffLists(
      list([SPIRIT, 2], [BLADE, 1]),
      list([STATIKK, 2], [BLADE, 3])
    );
    const keys = describeDiff(diff).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
