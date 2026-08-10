import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '@/db/connection';
import { MIGRATIONS } from '@/db/migrations';
import {
  createDeck,
  listVersions,
  loadDeckList,
  lockVersion,
  missingCards,
  saveDeckEdit,
} from '@/db/queries/decks';
import type { CardRow } from '@/db/schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '@/db/testing';

import { reconcileWithStored, useDeckEditor } from './useDeckEditor';

/**
 * The editor's mid-session sync window.
 *
 * The draft is a snapshot of what the mirror could resolve when the editor
 * opened. A card sync finishing while it is open makes the *stored* version
 * grow a card the draft never had, and a save would then read as the user
 * deleting it — forking a version nobody asked for and dropping the card from
 * it. Reachable on first launch, where the sync is running while the app is
 * already usable.
 */

let db: TestDatabase;

function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: `rb-${overrides.id}`,
    tcgplayerId: null,
    name: 'Test Card',
    cleanName: 'Test Card',
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
  db.runSync(
    `INSERT OR REPLACE INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, supertype,
        rarity, domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      card.id,
      card.riftboundId,
      card.name,
      card.cleanName,
      card.collectorNumber,
      card.type,
      card.supertype,
      card.rarity,
      JSON.stringify(card.domains),
      card.domainKey,
      JSON.stringify(card.tags),
      card.setId,
      card.setLabel,
      card.imageUrl,
      card.artist,
      card.orientation,
    ]
  );
  return card;
}

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
  useDeckEditor.getState().reset();
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

const LEGEND = {
  id: 'legend-1',
  name: 'Vi - Piltover Enforcer',
  type: 'Legend',
  domains: ['Fury', 'Order'],
  domainKey: 'Fury,Order',
  tags: ['Vi'],
};

describe('reconcileWithStored', () => {
  const slot = (id: string, zone: 'main' | 'legend' = 'main') => ({
    card: { id } as CardRow,
    quantity: 1,
    zone,
  });

  it('re-adds a card the editor never saw', () => {
    const draft = { slots: [slot('a')] };
    const stored = { slots: [slot('a'), slot('b')] };

    const merged = reconcileWithStored(draft, stored, ['main:a']);
    expect(merged.slots.map((s) => s.card.id).sort()).toEqual(['a', 'b']);
  });

  it('does not resurrect a card the user removed', () => {
    const draft = { slots: [slot('a')] };
    const stored = { slots: [slot('a'), slot('b')] };

    // `b` was in the editor at load, so its absence is a deliberate removal.
    const merged = reconcileWithStored(draft, stored, ['main:a', 'main:b']);
    expect(merged.slots.map((s) => s.card.id)).toEqual(['a']);
  });

  it('is zone-aware — the same card in another zone is a different slot', () => {
    const draft = { slots: [slot('a')] };
    const stored = { slots: [slot('a'), slot('a', 'legend')] };

    const merged = reconcileWithStored(draft, stored, ['main:a']);
    expect(merged.slots).toHaveLength(2);
  });

  it('returns the draft unchanged when nothing appeared', () => {
    const draft = { slots: [slot('a')] };
    expect(reconcileWithStored(draft, draft, ['main:a'])).toBe(draft);
  });
});

describe('a card sync completing while the editor is open', () => {
  it('does not fork a version, and does not drop the card', () => {
    const legend = seedCard({ ...LEGEND });
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const a = seedCard({ id: 'a', name: 'Card A' });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });

    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
        { card: a, quantity: 1, zone: 'main' },
      ],
    }).versionId;

    // The mirror is mid-resync when the editor opens.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);
    lockVersion(built);

    const store = useDeckEditor.getState();
    store.load({ deckId, versionId: built, name: 'Vi', list: loadDeckList(built) });
    expect(useDeckEditor.getState().slots.filter((s) => s.zone === 'main')).toHaveLength(1);

    // The sync finishes. The user has changed nothing and presses Save.
    seedCard({ id: 'ghost', name: 'Vanishing Act' });

    const state = useDeckEditor.getState();
    const toSave = reconcileWithStored(
      { slots: state.slots },
      loadDeckList(built),
      state.loadedKeys
    );
    const result = saveDeckEdit(built, toSave);

    // Still a no-op: the guard that keeps a resync from spending a version is
    // the diff, and that has not changed.
    expect(result.outcome).toBe('no-op');
    expect(listVersions(deckId)).toHaveLength(2);
    expect(
      loadDeckList(built)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
        .sort()
    ).toEqual(['a', 'ghost']);
  });

  it('still saves a real edit made in the same session', () => {
    const legend = seedCard({ ...LEGEND });
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });

    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
        { card: a, quantity: 1, zone: 'main' },
      ],
    }).versionId;
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);
    lockVersion(built);

    useDeckEditor.getState().load({
      deckId,
      versionId: built,
      name: 'Vi',
      list: loadDeckList(built),
    });
    useDeckEditor.getState().adjust(b, 'main', 2);
    seedCard({ id: 'ghost', name: 'Vanishing Act' });

    const state = useDeckEditor.getState();
    const result = saveDeckEdit(
      built,
      reconcileWithStored({ slots: state.slots }, loadDeckList(built), state.loadedKeys)
    );

    // The user's edit forks, and the resynced card rides along untouched.
    expect(result.outcome).toBe('forked');
    expect(result.diff.added.map((e) => e.card.id)).toEqual(['b']);
    expect(result.diff.removed).toEqual([]);
    expect(
      loadDeckList(result.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
        .sort()
    ).toEqual(['a', 'b', 'ghost']);
    expect(missingCards(result.versionId)).toEqual([]);
  });
});
