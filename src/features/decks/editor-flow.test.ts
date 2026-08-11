import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '@/db/connection';
import { MIGRATIONS } from '@/db/migrations';
import {
  listBattlefields,
  listChampionsForLegend,
  listLegends,
  listRunesForIdentity,
  queryCards,
} from '@/db/queries/cards';
import {
  createDeck,
  getDeck,
  getVersion,
  listDecks,
  loadDeckList,
  lockVersion,
  saveDeckEdit,
} from '@/db/queries/decks';
import { cardColumns, toBindValue } from '@/db/queries/hydrate';
import type { CardRow } from '@/db/schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '@/db/testing';
import { baseName, variantLabel } from '@/lib/card-identity';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  RUNE_DECK_SIZE,
  type DeckList,
} from '@/lib/legality';

import { useDeckEditor } from './useDeckEditor';

/**
 * The editor flow, end to end, against the real card library.
 *
 * Everything else tests a layer. This drives the exact sequence a user does â€”
 * pick a Legend, pick a Champion, tap cards in the rail, save â€” through the
 * real queries, the real store, and all 1,451 real cards, then reads the
 * database back to check it says what the legality bar said.
 */

const SEED_PATH = join(process.cwd(), 'assets/seed/cards.json');
const hasSeed = existsSync(SEED_PATH);

let db: TestDatabase;

function loadRealCards(): number {
  const cards: CardRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf8')).cards;
  const columns = cardColumns;
  const sql = `INSERT INTO cards (${columns.map((c) => c.sqlName).join(',')})
               VALUES (${columns.map(() => '?').join(',')})`;

  db.withTransactionSync(() => {
    for (const card of cards) {
      db.runSync(
        sql,
        columns.map((c) => toBindValue((card as Record<string, unknown>)[c.key], c))
      );
    }
  });
  return cards.length;
}

beforeEach(() => {
  if (!hasSeed) return;
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
  loadRealCards();
  useDeckEditor.getState().reset();
});

afterEach(() => {
  if (!hasSeed) return;
  setTestConnection(null);
  db.close();
});

/** Drive the editor the way the screen does: load, then tap cards in the rail. */
function openEditor(deckId: string) {
  const deck = getDeck(deckId)!;
  useDeckEditor.getState().load({
    deckId: deck.id,
    versionId: deck.currentVersionId!,
    name: deck.name,
    list: loadDeckList(deck.currentVersionId!),
  });
  return deck;
}

/** Exactly the query `edit.tsx` runs for the rail. */
function railFor(legend: CardRow, search = ''): CardRow[] {
  return queryCards({
    search: search.trim() || undefined,
    identity: legend.domains,
    hideAlternateArt: true,
    sort: search.trim() ? 'relevance' : 'energy',
  }).filter((c) => c.type !== 'Legend');
}

describe.skipIf(!hasSeed)('editor flow against the real library', () => {
  it('loads the whole mirror', () => {
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM cards')?.n
    ).toBe(1451);
  });

  it('creates a deck through the real create-flow queries', () => {
    const legends = listLegends();
    /*
     * Every *pickable* printing, not one per card: choosing a Legend also
     * chooses its art. The library holds 180 Legend rows — 79 plain, 44
     * Overnumbered, 1 Alternate Art, and then 28 Metal, 24 Signature and 4
     * Starter, which are the same Legends in other packaging and would make the
     * picker read as the same name five times over.
     */
    expect(legends.length).toBe(79 + 44 + 1);

    // Variants of one Legend sort adjacent, so the grid reads as "which Vi"
    // rather than as four unrelated entries scattered through the list.
    const positions = new Map<string, number[]>();
    legends.forEach((l, i) => {
      const key = baseName(l.name);
      positions.set(key, [...(positions.get(key) ?? []), i]);
    });
    for (const [name, at] of positions) {
      const contiguous = at.every((p, i) => i === 0 || p === at[i - 1]! + 1);
      expect(contiguous, `${name} printings are not adjacent`).toBe(true);
    }

    const legend = legends.find((l) => l.name.startsWith('Vi - Piltover Enforcer'))!;
    const champions = listChampionsForLegend(legend);
    expect(champions.length).toBeGreaterThan(0);

    const { deckId, versionId } = createDeck({
      name: 'Vi Aggro',
      legend,
      champion: champions[0]!,
    });

    const list = loadDeckList(versionId);
    expect(list.slots.filter((s) => s.zone === 'legend')).toHaveLength(1);
    expect(list.slots.filter((s) => s.zone === 'champion')).toHaveLength(1);
    expect(getDeck(deckId)?.domains).toEqual(legend.domains);
  });

  /**
   * The audit's central question: the bar reads `checkLegality` on the editor's
   * in-memory slots, while the database column is written by `syncVersionCounts`
   * from the list handed to `saveDeckEdit`. If those can ever differ, every
   * cached `is_legal` is suspect.
   */
  it('writes an is_legal that matches what the bar showed', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champion = listChampionsForLegend(legend)[0]!;
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion });

    openEditor(deckId);
    const editor = useDeckEditor.getState();

    // Tap rail cards until the main deck is full, the way a user builds.
    const rail = railFor(legend);
    for (const card of rail) {
      const state = useDeckEditor.getState();
      if (checkLegality({ slots: state.slots }).counts.main >= 40) break;
      if (card.type === 'Rune' || card.type === 'Battlefield') continue;
      for (let i = 0; i < 3; i++) editor.add(card);
    }
    for (const rune of rail.filter((c) => c.type === 'Rune')) {
      for (let i = 0; i < 6; i++) editor.add(rune);
      if (checkLegality({ slots: useDeckEditor.getState().slots }).counts.rune >= 12) break;
    }
    for (const bf of rail.filter((c) => c.type === 'Battlefield').slice(0, 3)) {
      editor.add(bf);
    }

    const slots = useDeckEditor.getState().slots;
    const list: DeckList = { slots };
    const barSaw = checkLegality(list);

    const saved = saveDeckEdit(versionId, list).versionId;

    // The cache belongs to the version the edit produced.
    const version = getVersion(saved)!;
    expect(version.mainCount).toBe(barSaw.counts.main);
    expect(version.runeCount).toBe(barSaw.counts.rune);
    expect(version.battlefieldCount).toBe(barSaw.counts.battlefield);
    expect(version.isLegal).toBe(barSaw.legal);

    // And re-reading from disk must agree with what was cached.
    const reloaded = checkLegality(loadDeckList(saved));
    expect(reloaded.counts).toEqual(barSaw.counts);
    expect(reloaded.legal).toBe(version.isLegal);
  });

  /**
   * Exactly what the match log reads for "Your battlefield — from this deck".
   *
   * The field is populated from `listDecks()` → `deck.currentVersionId` →
   * `loadDeckList` → the battlefield slots, and it renders "This deck has no
   * Battlefields yet" when that comes back empty. Four things sit between the
   * user tapping a Battlefield in the editor and the log form offering it, and
   * a break in any of them looks identical from the screen — so the whole chain
   * is asserted here rather than any one link.
   */
  it('offers the deck\'s Battlefields to the match log, through a fork', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champion = listChampionsForLegend(legend)[0]!;
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion });

    openEditor(deckId);
    const editor = useDeckEditor.getState();
    const chosen = railFor(legend)
      .filter((c) => c.type === 'Battlefield')
      .slice(0, BATTLEFIELD_COUNT);
    expect(chosen).toHaveLength(BATTLEFIELD_COUNT);
    for (const bf of chosen) editor.add(bf);

    saveDeckEdit(versionId, { slots: useDeckEditor.getState().slots });

    // The log form's own expression, verbatim.
    const fieldsFor = (id: string) =>
      loadDeckList(id)
        .slots.filter((s) => s.zone === 'battlefield')
        .map((s) => s.card);

    const summary = listDecks().find((d) => d.deck.id === deckId)!;
    expect(summary.deck.currentVersionId).toBeTruthy();
    expect(fieldsFor(summary.deck.currentVersionId!).map((c) => c.id).sort()).toEqual(
      chosen.map((c) => c.id).sort()
    );

    /*
     * And again after a locked version forks, which is the case that could
     * silently break it: the deck must follow the fork, or the log form would
     * offer the Battlefields of a list that is no longer current.
     */
    lockVersion(summary.deck.currentVersionId!);
    openEditor(deckId);
    const swap = railFor(legend).find(
      (c) => c.type === 'Battlefield' && !chosen.some((x) => x.id === c.id)
    )!;
    useDeckEditor.getState().adjust(chosen[0]!, 'battlefield', -1);
    useDeckEditor.getState().add(swap);
    saveDeckEdit(useDeckEditor.getState().versionId!, {
      slots: useDeckEditor.getState().slots,
    });

    const forked = listDecks().find((d) => d.deck.id === deckId)!;
    expect(fieldsFor(forked.deck.currentVersionId!)).toHaveLength(BATTLEFIELD_COUNT);
    expect(fieldsFor(forked.deck.currentVersionId!).map((c) => c.id)).toContain(swap.id);
  });

  it('never offers an off-identity card in the rail', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const offIdentity = railFor(legend).filter(
      (c) => !c.domains.every((d) => d === 'Colorless' || legend.domains.includes(d))
    );
    expect(offIdentity.map((c) => c.name)).toEqual([]);
  });

  /**
   * Where does a Champion Unit go when tapped in the rail? `defaultZoneFor`
   * sends every Unit to `main`, so it stacks alongside the designated Champion
   * rather than replacing it. Rule 103.2.b.1 says that is correct â€” the Chosen
   * Champion's copy counts toward the 3-copy limit â€” so the question is whether
   * the fourth copy is caught.
   */
  it('counts extra copies of the Chosen Champion against the 3-copy limit', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champion = listChampionsForLegend(legend)[0]!;
    const { deckId } = createDeck({ name: 'Vi', legend, champion });
    openEditor(deckId);
    const editor = useDeckEditor.getState();

    // The same card, tapped from the rail, lands in main.
    const railCopy = railFor(legend).find((c) => c.id === champion.id);
    expect(railCopy, 'the Chosen Champion should be offered in the rail').toBeTruthy();

    editor.add(railCopy!);
    editor.add(railCopy!);
    let issues = checkLegality({ slots: useDeckEditor.getState().slots }).issues;
    expect(issues.map((i) => i.code)).not.toContain('copy-limit');

    editor.add(railCopy!); // champion zone (1) + main (3) = 4
    issues = checkLegality({ slots: useDeckEditor.getState().slots }).issues;
    expect(issues.map((i) => i.code)).toContain('copy-limit');
  });

  /**
   * `saveDeckEdit` rewrites `decks.legend_card_id` from the slot list, and
   * `loadDeckList` drops cards missing from the mirror. If the Legend's
   * printing ever leaves the library, opening the editor loads a list with no
   * legend slot â€” and saving then wipes the deck's Legend and domains.
   */
  it('survives its Legend printing leaving the mirror', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champion = listChampionsForLegend(legend)[0]!;
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion });

    // A resync drops this printing â€” the mirror is disposable by design.
    db.runSync('DELETE FROM cards WHERE id = ?', [legend.id]);

    const list = loadDeckList(versionId);
    expect(list.slots.filter((s) => s.zone === 'legend')).toEqual([]);

    openEditor(deckId);
    saveDeckEdit(versionId, { slots: useDeckEditor.getState().slots });

    // The deck keeps its identity even though the editor could not see it.
    const deck = getDeck(deckId)!;
    expect(deck.legendCardId).toBe(legend.id);
    expect(deck.domains).toEqual(legend.domains);

    // And the slot row survived, so the card returns when the mirror does.
    expect(
      db.getFirstSync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM deck_version_cards
          WHERE deck_version_id = ? AND zone = 'legend'`,
        [versionId]
      )?.n
    ).toBe(1);
  });

  /**
   * The build flow seeds the rune deck with an even split across the identity.
   * Only one rune card exists per domain, so this is the shape nearly every
   * legal deck has â€” and it is only possible because the copy limit is scoped
   * to the Main Deck (rule 103.2.b).
   */
  it('can seed a complete rune deck from an even domain split', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const runes = listRunesForIdentity(legend.domains);

    // One rune card per domain, each in several art treatments.
    const distinct = new Set(runes.map((r) => baseName(r.name)));
    expect(distinct.size).toBe(legend.domains.length);
    expect(runes.length).toBeGreaterThan(distinct.size);

    // Every rune offered is inside the identity.
    for (const rune of runes) {
      expect(rune.domains.every((d) => legend.domains.includes(d))).toBe(true);
    }

    const perDomain = RUNE_DECK_SIZE / legend.domains.length;
    const seeded = legend.domains.map((domain) => ({
      card: runes.find((r) => r.domains.includes(domain) && variantLabel(r.name) === null)!,
      quantity: perDomain,
      zone: 'rune' as const,
    }));
    expect(seeded.every((s) => s.card)).toBe(true);

    const result = checkLegality({
      slots: [{ card: legend, quantity: 1, zone: 'legend' }, ...seeded],
    });
    expect(result.counts.rune).toBe(RUNE_DECK_SIZE);
    expect(result.issues.map((i) => i.code)).not.toContain('rune-count');
    expect(result.issues.map((i) => i.code)).not.toContain('copy-limit');
  });

  it('offers enough distinct Battlefields to fill the zone', () => {
    const fields = listBattlefields();
    const distinct = new Set(fields.map((f) => baseName(f.name)));
    expect(distinct.size).toBeGreaterThanOrEqual(BATTLEFIELD_COUNT);
  });

  it('keeps Legends out of the rail â€” they are changed through the picker', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    expect(railFor(legend).filter((c) => c.type === 'Legend')).toEqual([]);
  });

  /**
   * The picker is the only way to change either single-card slot. Before it
   * existed a mis-picked Legend meant deleting the deck and starting over.
   */
  it('changes the Legend through the picker and re-flags the deck', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champion = listChampionsForLegend(legend)[0]!;
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion });

    openEditor(deckId);
    const editor = useDeckEditor.getState();

    // A Fury/Order card, legal under the current Legend.
    const furyCard = railFor(legend).find(
      (c) => c.type === 'Spell' && c.domains.every((d) => legend.domains.includes(d))
    )!;
    editor.add(furyCard);
    expect(
      checkLegality({ slots: useDeckEditor.getState().slots }).issues.map((i) => i.code)
    ).not.toContain('domain-identity');

    // Swap to a Legend sharing no domain with that card.
    const otherLegend = listLegends().find(
      (l) => !l.domains.some((d) => furyCard.domains.includes(d))
    )!;
    editor.setLegend(otherLegend);

    const after = checkLegality({ slots: useDeckEditor.getState().slots });
    expect(after.issues.map((i) => i.code)).toContain('domain-identity');
    // Flagged, never deleted â€” the cards are still in the list.
    expect(
      useDeckEditor.getState().slots.some((s) => s.card.id === furyCard.id)
    ).toBe(true);

    // Exactly one Legend slot survives the swap.
    const legendSlots = useDeckEditor.getState().slots.filter((s) => s.zone === 'legend');
    expect(legendSlots).toHaveLength(1);
    expect(legendSlots[0]!.card.id).toBe(otherLegend.id);

    saveDeckEdit(versionId, { slots: useDeckEditor.getState().slots });
    expect(getDeck(deckId)!.legendCardId).toBe(otherLegend.id);
    expect(getDeck(deckId)!.domains).toEqual(otherLegend.domains);
  });

  it('changes the Champion through the picker without stacking a second one', () => {
    const legend = listLegends().find((l) => l.name.startsWith('Vi - Piltover'))!;
    const champions = listChampionsForLegend(legend);
    const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: champions[0]! });

    openEditor(deckId);
    const alternative = champions.find((c) => c.id !== champions[0]!.id);
    if (!alternative) return; // only one Champion partners this Legend

    useDeckEditor.getState().setChampion(alternative);

    const championSlots = useDeckEditor.getState().slots.filter((s) => s.zone === 'champion');
    expect(championSlots).toHaveLength(1);
    expect(championSlots[0]!.card.id).toBe(alternative.id);

    saveDeckEdit(versionId, { slots: useDeckEditor.getState().slots });
    expect(getDeck(deckId)!.championCardId).toBe(alternative.id);
  });
});
