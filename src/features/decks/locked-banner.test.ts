import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '@/db/connection';
import { MIGRATIONS } from '@/db/migrations';
import { getCard } from '@/db/queries/cards';
import { createDeck, loadDeckList, lockVersion, saveDeckEdit } from '@/db/queries/decks';
import { seenFork } from '@/db/queries/settings';
import type { CardRow } from '@/db/schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '@/db/testing';

import { bannerKey, bannerKeyFor } from './locked-banner';

/**
 * The locked-version banner's two forms, and what moves between them.
 *
 * The rule under test is **the switch happens on the fork, not on the render**.
 * A "banner was shown" flag would be cleared by the one gesture that proves
 * nothing was read — opening the editor, glancing at it, backing out — and that
 * player is exactly who still needs the long form. Only a version actually
 * forking means the explanation has done its job.
 */

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

describe('choosing a form', () => {
  it('is long until a fork has been seen, short after', () => {
    expect(bannerKeyFor('editor.lockedBanner.one', false)).toBe('editor.lockedBanner.one.long');
    expect(bannerKeyFor('editor.lockedBanner.one', true)).toBe('editor.lockedBanner.one');
  });

  it('carries the plural distinction into the long form', () => {
    // Three parallel keys, never one short form with a tail glued on: German
    // puts the new version number at the end of its clause, so a joined
    // fragment would land mid-sentence there.
    expect(bannerKeyFor('editor.lockedBanner.locked', false)).toBe(
      'editor.lockedBanner.locked.long'
    );
    expect(bannerKeyFor('editor.lockedBanner.other', false)).toBe('editor.lockedBanner.other.long');
  });
});

describe('across a real fork', () => {
  it('stays long no matter how often the banner is rendered', () => {
    const { versionId } = playedDeck();

    // Rendering is what a "shown" flag would key on. It must change nothing.
    expect(bannerKey('editor.lockedBanner.one')).toBe('editor.lockedBanner.one.long');
    expect(bannerKey('editor.lockedBanner.one')).toBe('editor.lockedBanner.one.long');
    expect(bannerKey('editor.lockedBanner.one')).toBe('editor.lockedBanner.one.long');
    expect(seenFork()).toBe(false);
    expect(versionId).toBeTruthy();
  });

  it('collapses only once a version has actually forked', () => {
    const { versionId } = playedDeck();
    expect(bannerKey('editor.lockedBanner.one')).toBe('editor.lockedBanner.one.long');

    const result = saveDeckEdit(versionId, dropOneCard(versionId));

    expect(result.outcome).toBe('forked');
    expect(result.firstFork).toBe(true);
    expect(result.parentGames).toBe(1);
    expect(seenFork()).toBe(true);
    expect(bannerKey('editor.lockedBanner.one')).toBe('editor.lockedBanner.one');
  });

  it('claims the first fork exactly once', () => {
    const { deckId, versionId } = playedDeck();

    const first = saveDeckEdit(versionId, dropOneCard(versionId));
    expect(first.firstFork).toBe(true);

    // The fork arrives unlocked, so it needs its own game before it will fork.
    logGame(deckId, first.versionId, 'game-2');
    lockVersion(first.versionId);
    const second = saveDeckEdit(first.versionId, dropOneCard(first.versionId, 'a'));

    expect(second.outcome).toBe('forked');
    expect(second.firstFork).toBe(false);
  });
});

/* ---------------------------------------------------------------- fixtures */

function seedCard(id: string, type = 'Unit'): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, `ogn-${id}`, `Card ${id}`, `Card ${id}`, 1, type, 'Common',
     '["Fury"]', 'Fury', '[]', 'OGN', 'Origins', '', '', 'portrait']
  );
  // Read back rather than hand-built: `createDeck` binds columns a partial
  // literal does not carry, and an undefined binding is a runtime error rather
  // than a type one.
  return getCard(id)!;
}

/** A deck whose current version has one game on it, and is therefore locked. */
function playedDeck(): { deckId: string; versionId: string } {
  const legend = seedCard('legend', 'Legend');
  const a = seedCard('a');
  const b = seedCard('b');

  const { deckId, versionId } = createDeck({
    name: 'Test deck',
    legend,
    champion: null,
    slots: [
      { card: legend, quantity: 1, zone: 'legend' },
      { card: a, quantity: 1, zone: 'main' },
      { card: b, quantity: 1, zone: 'main' },
    ],
  });

  logGame(deckId, versionId, 'game-1');
  lockVersion(versionId);
  return { deckId, versionId };
}

/** A real row, because `parentGames` counts games rather than reading the lock. */
function logGame(deckId: string, versionId: string, id: string): void {
  const stamp = new Date().toISOString();
  db.runSync(
    `INSERT INTO games (id, deck_id, deck_version_id, played_at, result, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, deckId, versionId, stamp, 'win', stamp, stamp]
  );
}

/** Any real change, so the save is not a no-op. A second fork has to drop a
 *  different card — dropping one already gone is a no-op, not a fork. */
function dropOneCard(versionId: string, cardId = 'b') {
  const list = loadDeckList(versionId);
  return { slots: list.slots.filter((slot) => slot.card.id !== cardId) };
}
