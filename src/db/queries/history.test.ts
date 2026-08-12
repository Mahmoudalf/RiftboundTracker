import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, saveDeckEdit } from './decks';
import { deleteGame, logGame, opponentChampionFields, opponentFields } from './games';
import { HISTORY_PAGE, gameHistory } from './history';

/**
 * Match history.
 *
 * The load-bearing property is that *our* side is read from the version that
 * played the match. A history that redrew old matches with the deck's current
 * Legend would be quietly rewriting them — the same class of mistake as
 * rewriting a locked version's cards.
 */

let db: TestDatabase;

function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: `rb-${overrides.id}`, tcgplayerId: null, name: 'Test Card',
    cleanName: 'Test Card', collectorNumber: 1, energy: null, might: null, power: null,
    type: 'Spell', supertype: null, rarity: 'Common', domains: ['Fury'], domainKey: 'Fury',
    textPlain: null, textRich: null, flavour: null, tags: [], setId: 'OGN', setLabel: 'Origins',
    imageUrl: `https://cdn.example/${overrides.id}.png`, artist: 'Someone',
    accessibilityText: null, orientation: 'portrait', alternateArt: false, signature: false,
    overnumbered: false, isNew: false, updatedOn: null, ...overrides,
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

const VI = {
  id: 'vi-legend', name: 'Vi - Piltover Enforcer', type: 'Legend',
  domains: ['Fury', 'Order'], domainKey: 'Fury,Order', tags: ['Vi'],
};

describe('gameHistory', () => {
  it('resolves both sides with art and names', () => {
    const legend = seedCard({ ...VI });
    const champion = seedCard({
      id: 'vi-unit', name: 'Vi - Enforcer', type: 'Unit', supertype: 'Champion', tags: ['Vi'],
    });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion });

    const oppLegend = seedCard({ id: 'yasuo', name: 'Yasuo - Windrunner', type: 'Legend' });
    const oppChamp = seedCard({ id: 'yasuo-unit', name: 'Yasuo - Unforgiven', type: 'Unit' });

    logGame({
      deckId, deckVersionId: versionId, result: 'win', bestOf: 3, gameStyle: 'tournament',
      ...opponentFields(oppLegend), ...opponentChampionFields(oppChamp),
    });

    const [entry] = gameHistory({ deckId }).entries;
    expect(entry!.ours.legend).toMatchObject({
      id: 'vi-legend',
      name: 'Vi - Piltover Enforcer',
      imageUrl: 'https://cdn.example/vi-legend.png',
    });
    expect(entry!.ours.champion.name).toBe('Vi - Enforcer');
    expect(entry!.theirs.legend.name).toBe('Yasuo - Windrunner');
    expect(entry!.theirs.champion.name).toBe('Yasuo - Unforgiven');
    expect(entry!.game.bestOf).toBe(3);
    expect(entry!.game.gameStyle).toBe('tournament');
  });

  /**
   * The reason "ours" comes from `deck_version_cards` and not from the deck row.
   */
  it('shows the Legend that played the match, not the deck’s current one', () => {
    const vi = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Shifting', legend: vi, champion: null });

    logGame({ deckId, deckVersionId: versionId, result: 'win' });

    // The deck is rebuilt around a different Legend. The old match must not be
    // redrawn as though it had been played with it.
    const pyke = seedCard({
      id: 'pyke', name: 'Pyke - Bloodharbor Ripper', type: 'Legend',
      domains: ['Fury', 'Chaos'], domainKey: 'Chaos,Fury', tags: ['Pyke'],
    });
    const forked = saveDeckEdit(versionId, {
      slots: [{ card: pyke, quantity: 1, zone: 'legend' }],
    });
    logGame({ deckId, deckVersionId: forked.versionId, result: 'loss' });

    const entries = gameHistory({ deckId }).entries;
    const names = entries.map((e) => e.ours.legend.name);
    expect(names).toContain('Vi - Piltover Enforcer');
    expect(names).toContain('Pyke - Bloodharbor Ripper');
  });

  it('keeps the name when the printing has left the library', () => {
    const legend = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
    const opp = seedCard({ id: 'yasuo', name: 'Yasuo - Windrunner', type: 'Legend' });
    logGame({ deckId, deckVersionId: versionId, result: 'win', ...opponentFields(opp) });

    db.runSync("DELETE FROM cards WHERE id IN ('yasuo', 'vi-legend')");

    const [entry] = gameHistory({ deckId }).entries;
    // Art is gone; identity is not.
    expect(entry!.theirs.legend.name).toBe('Yasuo - Windrunner');
    expect(entry!.theirs.legend.imageUrl).toBeNull();
    expect(entry!.ours.legend.name).toBe('Vi - Piltover Enforcer');
    expect(entry!.ours.legend.imageUrl).toBeNull();
  });

  it('reports empty faces rather than throwing when nothing was recorded', () => {
    const legend = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
    logGame({ deckId, deckVersionId: versionId, result: 'draw' });

    const [entry] = gameHistory({ deckId }).entries;
    expect(entry!.theirs.legend).toMatchObject({ id: null, name: null, imageUrl: null });
    expect(entry!.ours.champion).toEqual({ id: null, name: null, imageUrl: null });
  });

  it('carries the opponent’s domains for the art-less fallback', () => {
    const legend = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
    const opp = seedCard({
      id: 'yasuo', name: 'Yasuo', type: 'Legend', domains: ['Chaos', 'Mind'],
    });
    logGame({ deckId, deckVersionId: versionId, result: 'win', ...opponentFields(opp) });

    db.runSync('DELETE FROM cards WHERE id = ?', ['yasuo']);

    // The row draws these when there is no art left — the job `opp_domains`
    // was denormalized for.
    const [entry] = gameHistory({ deckId }).entries;
    expect(entry!.theirs.legend.imageUrl).toBeNull();
    expect(entry!.theirs.legend.domains).toEqual(['Chaos', 'Mind']);
  });

  it('windows by default and reports the full count', () => {
    const legend = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
    for (let i = 0; i < HISTORY_PAGE + 12; i++) {
      logGame({ deckId, deckVersionId: versionId, result: 'win' });
    }

    const page = gameHistory({ deckId });
    // The screen must be able to say it is showing a window, so the total is
    // not the window length.
    expect(page.entries).toHaveLength(HISTORY_PAGE);
    expect(page.total).toBe(HISTORY_PAGE + 12);

    expect(gameHistory({ deckId, limit: HISTORY_PAGE * 2 }).entries).toHaveLength(
      HISTORY_PAGE + 12
    );
    // limit 0 means "everything" — analytics reads unwindowed.
    expect(gameHistory({ deckId, limit: 0 }).entries).toHaveLength(HISTORY_PAGE + 12);
  });

  it('orders newest first, scopes by deck, and honours a limit', () => {
    const legend = seedCard({ ...VI });
    const first = createDeck({ name: 'First', legend, champion: null });
    const second = createDeck({ name: 'Second', legend, champion: null });

    logGame({
      deckId: first.deckId, deckVersionId: first.versionId, result: 'win',
      playedAt: '2026-08-01T10:00:00.000Z',
    });
    logGame({
      deckId: first.deckId, deckVersionId: first.versionId, result: 'loss',
      playedAt: '2026-08-03T10:00:00.000Z',
    });
    logGame({
      deckId: second.deckId, deckVersionId: second.versionId, result: 'draw',
      playedAt: '2026-08-02T10:00:00.000Z',
    });

    expect(gameHistory().entries.map((e) => e.game.result)).toEqual(['loss', 'draw', 'win']);
    expect(gameHistory({ deckId: first.deckId }).entries).toHaveLength(2);
    expect(gameHistory({ limit: 2 }).entries).toHaveLength(2);
  });

  it('ignores deleted matches', () => {
    const legend = seedCard({ ...VI });
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
    const id = logGame({ deckId, deckVersionId: versionId, result: 'win' });
    deleteGame(id);

    expect(gameHistory({ deckId }).entries).toEqual([]);
  });
});
