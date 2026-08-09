import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, deleteDeck } from './decks';
import {
  createEvent,
  deleteEvent,
  eventMatches,
  getEvent,
  listEvents,
  updateEvent,
} from './events';
import { deleteMatch, listMatches, logMatch, undoMatch } from './matches';

/**
 * Events, against real SQLite.
 *
 * The point of the table is the distinction it draws: `matches.event_type` is a
 * category ("a Nexus Night"), an event is an instance ("*the* Nexus Night on
 * the 9th"). These tests defend the instance — that its record counts only its
 * own rounds, that deleting it never rewrites a match, and that a match can
 * exist perfectly well without one.
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

function seedLegend(id: string): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      `Legend ${id}`,
      `Legend ${id}`,
      1,
      'Legend',
      'Rare',
      '["Fury"]',
      'Fury',
      '[]',
      'OGN',
      'Origins',
      'https://cdn.example/a.png',
      'A',
      'portrait',
    ]
  );
  return {
    id,
    riftboundId: `ogn-${id}-1`,
    tcgplayerId: null,
    name: `Legend ${id}`,
    cleanName: `Legend ${id}`,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    type: 'Legend',
    supertype: null,
    rarity: 'Rare',
    domains: ['Fury'],
    domainKey: 'Fury',
    textPlain: null,
    textRich: null,
    flavour: null,
    tags: [],
    setId: 'OGN',
    setLabel: 'Origins',
    imageUrl: 'https://cdn.example/a.png',
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

function makeDeck() {
  const legend = seedLegend('lg');
  return createDeck({ name: 'Deck', legend, champion: null });
}

function log(deck: { deckId: string; versionId: string }, result: 'win' | 'loss' | 'draw', eventId?: string) {
  return logMatch({
    deckId: deck.deckId,
    deckVersionId: deck.versionId,
    result,
    // A match style, not an event style — the two vocabularies are separate.
    eventType: 'tournament',
    eventId: eventId ?? null,
  });
}

describe('migration 15: the style split', () => {
  /*
   * The three organised tiers stop being match styles and become event styles.
   * Existing matches have to land somewhere true — "tournament" is true of all
   * three — and nothing else about them may move.
   */
  it('folds the organised tiers into tournament and leaves the rest alone', () => {
    const old = createTestDatabase();
    applyMigrationsUpTo(old, MIGRATIONS, 14);

    // The matches need a deck to point at: foreign keys are on in the harness,
    // matching the device.
    old.runSync(
      "INSERT INTO decks (id, name, domains, created_at, updated_at) VALUES ('d','D','[]','2026-01-01','2026-01-01')"
    );

    const styles = ['casual', 'skirmish', 'nexus-night', 'locals', 'tournament', 'online', 'testing'];
    styles.forEach((style, i) => {
      old.runSync(
        `INSERT INTO matches
           (id, deck_id, deck_version_id, played_at, result, event_type, created_at, updated_at)
         VALUES (?, 'd', 'v', ?, 'win', ?, '2026-01-01', '2026-01-01')`,
        [`m${i}`, `2026-08-0${i + 1}T10:00:00.000Z`, style]
      );
    });

    applyMigrationsUpTo(old, MIGRATIONS, 15);

    const after = old.getAllSync<{ id: string; event_type: string }>(
      'SELECT id, event_type FROM matches ORDER BY id'
    );
    expect(after.map((r) => r.event_type)).toEqual([
      'casual', // untouched
      'tournament', // was skirmish
      'tournament', // was nexus-night
      'tournament', // was locals
      'tournament', // untouched
      'online', // untouched
      'testing', // untouched
    ]);
    // Nothing else moved. The migration relabels; it does not edit history.
    expect(
      old.getFirstSync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM matches WHERE result = 'win'"
      )!.n
    ).toBe(7);

    old.close();
  });

  it('leaves events alone, even ones holding a style no longer offered', () => {
    const old = createTestDatabase();
    applyMigrationsUpTo(old, MIGRATIONS, 14);
    setTestConnection(old);

    old.runSync(
      `INSERT INTO events (id, name, event_type, started_at, created_at, updated_at)
       VALUES ('e1', 'Legacy', 'tournament', '2026-08-01', '2026-01-01', '2026-01-01')`
    );

    applyMigrationsUpTo(old, MIGRATIONS, 15);

    // Not rewritten to fit the new vocabulary; `eventStyleLabel` renders it.
    expect(getEvent('e1')?.eventType).toBe('tournament');

    setTestConnection(null);
    old.close();
  });
});

describe('event CRUD', () => {
  it('creates, reads, updates and deletes', () => {
    const id = createEvent({ name: 'Nexus Night', eventType: 'nexus-night', location: 'The Shop' });

    expect(listEvents()).toHaveLength(1);
    expect(getEvent(id)?.name).toBe('Nexus Night');
    expect(getEvent(id)?.location).toBe('The Shop');
    expect(getEvent(id)?.eventType).toBe('nexus-night');

    updateEvent(id, { name: 'Nexus Night #4', rounds: 5, finalPlacement: 3, notes: 'Good day' });
    const updated = getEvent(id)!;
    expect(updated.name).toBe('Nexus Night #4');
    expect(updated.rounds).toBe(5);
    expect(updated.finalPlacement).toBe(3);
    expect(updated.notes).toBe('Good day');

    deleteEvent(id);
    expect(listEvents()).toHaveLength(0);
    expect(getEvent(id)).toBeNull();
  });

  it('soft deletes, so sync can propagate the removal', () => {
    const id = createEvent({ name: 'Gone', eventType: 'nexus-night' });
    deleteEvent(id);

    expect(
      db.getFirstSync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM events WHERE id = ?',
        [id]
      )?.deleted_at
    ).not.toBeNull();
  });

  it('falls back to a name rather than storing an empty one', () => {
    const id = createEvent({ name: '   ', eventType: 'nexus-night' });
    expect(getEvent(id)?.name).toBe('Event');
    updateEvent(id, { name: '  ' });
    expect(getEvent(id)?.name).toBe('Event');
  });

  it('clears a blank location or note instead of storing an empty string', () => {
    const id = createEvent({ name: 'E', eventType: 'nexus-night', location: '  ' });
    expect(getEvent(id)?.location).toBeNull();

    updateEvent(id, { notes: 'something' });
    updateEvent(id, { notes: '   ' });
    expect(getEvent(id)?.notes).toBeNull();
  });

  it('ignores an empty patch rather than bumping the row', () => {
    const id = createEvent({ name: 'E', eventType: 'nexus-night' });
    const before = db.getFirstSync<{ updated_at: string }>(
      'SELECT updated_at FROM events WHERE id = ?',
      [id]
    )!.updated_at;

    updateEvent(id, {});

    expect(
      db.getFirstSync<{ updated_at: string }>('SELECT updated_at FROM events WHERE id = ?', [id])!
        .updated_at
    ).toBe(before);
  });
});

describe('an event and its rounds', () => {
  it('records only its own matches', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'Tournament', eventType: 'nexus-night' });

    log(deck, 'win', event);
    log(deck, 'win', event);
    log(deck, 'loss', event);
    log(deck, 'draw', event);
    // A casual match on the same deck, no event.
    log(deck, 'loss');

    const summary = getEvent(event)!;
    expect(summary).toMatchObject({ wins: 2, losses: 1, draws: 1, total: 4 });
    expect(eventMatches(event)).toHaveLength(4);
    // The unattached match is still a match, just not this event's.
    expect(listMatches()).toHaveLength(5);
  });

  it('reads its rounds oldest first', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'T', eventType: 'nexus-night' });

    logMatch({
      deckId: deck.deckId,
      deckVersionId: deck.versionId,
      result: 'win',
      eventId: event,
      playedAt: '2026-08-09T10:00:00.000Z',
    });
    logMatch({
      deckId: deck.deckId,
      deckVersionId: deck.versionId,
      result: 'loss',
      eventId: event,
      playedAt: '2026-08-09T11:00:00.000Z',
    });

    // Round 1 first: an event is read forwards, unlike a match list.
    expect(eventMatches(event).map((m) => m.result)).toEqual(['win', 'loss']);
  });

  it('reports an event with no rounds as empty rather than missing', () => {
    const id = createEvent({ name: 'Not started', eventType: 'skirmish' });
    expect(getEvent(id)).toMatchObject({ wins: 0, losses: 0, draws: 0, total: 0 });
    expect(eventMatches(id)).toEqual([]);
  });

  it('drops an undone match from the record', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'T', eventType: 'nexus-night' });
    log(deck, 'win', event);
    const mistake = log(deck, 'loss', event);

    undoMatch(mistake);

    expect(getEvent(event)).toMatchObject({ wins: 1, losses: 0, total: 1 });
  });

  it('drops a deleted match from the record', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'T', eventType: 'nexus-night' });
    log(deck, 'win', event);
    const mistake = log(deck, 'loss', event);

    deleteMatch(mistake);

    expect(getEvent(event)).toMatchObject({ wins: 1, losses: 0, total: 1 });
  });

  /*
   * The rule worth defending. Deleting an event is tidying a label; the rounds
   * were still played, and detaching or removing them would rewrite history to
   * make a list look neater.
   */
  it('leaves every match untouched when the event is deleted', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'T', eventType: 'nexus-night' });
    log(deck, 'win', event);
    log(deck, 'loss', event);

    deleteEvent(event);

    expect(listMatches()).toHaveLength(2);
    // The link survives on the tombstone, exactly as a deleted binder keeps its
    // cards — so nothing is lost if the delete is ever reversed.
    expect(
      db.getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM matches WHERE event_id = ?',
        [event]
      )!.n
    ).toBe(2);
  });

  /*
   * A cross-feature probe. Deleting a deck soft-deletes its matches — a fix
   * from an earlier audit, because a deleted deck's results were still counting
   * in global stats. An event holding those rounds must agree, or the same
   * matches would be gone from one screen and present on another.
   */
  it('drops rounds whose deck was deleted', () => {
    const deck = makeDeck();
    const event = createEvent({ name: 'T', eventType: 'nexus-night' });
    log(deck, 'win', event);
    log(deck, 'win', event);

    expect(getEvent(event)).toMatchObject({ wins: 2, total: 2 });

    deleteDeck(deck.deckId);

    expect(getEvent(event)).toMatchObject({ wins: 0, total: 0 });
    expect(eventMatches(event)).toEqual([]);
    // The event itself survives — it happened, even if the deck is gone.
    expect(listEvents()).toHaveLength(1);
  });

  it('keeps two events on the same day apart', () => {
    const deck = makeDeck();
    const morning = createEvent({ name: 'Morning', eventType: 'nexus-night' });
    const evening = createEvent({ name: 'Evening', eventType: 'nexus-night' });

    log(deck, 'win', morning);
    log(deck, 'loss', evening);
    log(deck, 'loss', evening);

    expect(getEvent(morning)).toMatchObject({ wins: 1, losses: 0, total: 1 });
    expect(getEvent(evening)).toMatchObject({ wins: 0, losses: 2, total: 2 });
  });

  it('orders events with the most recent first', () => {
    const older = createEvent({
      name: 'Older',
      eventType: 'nexus-night',
      startedAt: '2026-08-01T10:00:00.000Z',
    });
    const newer = createEvent({
      name: 'Newer',
      eventType: 'nexus-night',
      startedAt: '2026-08-09T10:00:00.000Z',
    });

    expect(listEvents().map((e) => e.id)).toEqual([newer, older]);
  });
});
