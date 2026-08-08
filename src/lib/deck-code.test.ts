import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';

import { cardKey } from './card-identity';
import {
  decodeDeckCode,
  DeckCodeError,
  encodeDeckList,
  extractDeckCode,
  isTokenCard,
  suggestDeckName,
} from './deck-code';
import { checkLegality, type DeckList, type DeckSlot } from './legality';

/**
 * Deck codes, against the real 1,451-card catalogue.
 *
 * The round trip that matters is **through our model**, not through the
 * package: our zones and the format's sections do not correspond, so the
 * interesting failures are all in the translation.
 */

const SEED = join(process.cwd(), 'assets/seed/cards.json');
const hasSeed = existsSync(SEED);
const catalogue: CardRow[] = hasSeed
  ? JSON.parse(readFileSync(SEED, 'utf8')).cards
  : [];

const find = (predicate: (c: CardRow) => boolean, n = 1) =>
  catalogue.filter(predicate).slice(0, n);

/** A deck built the way the builder builds one: legal counts, real cards. */
function buildRealDeck(): DeckList {
  const legend = find((c) => c.type === 'Legend' && c.riftboundId.startsWith('ogn-'))[0]!;
  const champion = find(
    (c) =>
      c.type === 'Unit' &&
      c.supertype === 'Champion' &&
      c.tags.some((t) => legend.tags.includes(t)) &&
      c.domains.every((d) => d === 'Colorless' || legend.domains.includes(d))
  )[0]!;

  const main = catalogue
    .filter(
      (c) =>
        ['Unit', 'Spell', 'Gear'].includes(c.type) &&
        c.supertype !== 'Champion' &&
        !isTokenCard(c) &&
        c.domains.every((d) => d === 'Colorless' || legend.domains.includes(d))
    )
    .slice(0, 13);

  const runes = catalogue
    .filter((c) => c.type === 'Rune' && c.domains.some((d) => legend.domains.includes(d)))
    .slice(0, 2);
  const fields = catalogue.filter((c) => c.type === 'Battlefield').slice(0, 3);

  const slots: DeckSlot[] = [
    { card: legend, quantity: 1, zone: 'legend' },
    { card: champion, quantity: 1, zone: 'champion' },
    ...main.map((card) => ({ card, quantity: 3, zone: 'main' as const })),
    ...runes.map((card) => ({ card, quantity: 6, zone: 'rune' as const })),
    ...fields.map((card) => ({ card, quantity: 1, zone: 'battlefield' as const })),
  ];
  return { slots };
}

/**
 * Compare two lists at the level the format preserves: card (not printing),
 * quantity, and zone.
 */
function fingerprint(list: DeckList): string[] {
  return list.slots
    .filter((s) => s.quantity > 0)
    .map((s) => `${s.zone} ${cardKey(s.card)} x${s.quantity}`)
    .sort();
}

describe.skipIf(!hasSeed)('deck code, through our model', () => {
  it('round-trips a real built deck as identity', () => {
    const deck = buildRealDeck();
    const { code, omitted } = encodeDeckList(deck, catalogue);
    const decoded = decodeDeckCode(code, catalogue);

    expect(omitted).toEqual([]);
    expect(decoded.unknown).toEqual([]);
    expect(fingerprint({ slots: decoded.slots })).toEqual(fingerprint(deck));
  });

  it('keeps the deck legal through the round trip', () => {
    const deck = buildRealDeck();
    const before = checkLegality(deck);
    const after = checkLegality({
      slots: decodeDeckCode(encodeDeckList(deck, catalogue).code, catalogue).slots,
    });

    expect(after.counts).toEqual(before.counts);
    expect(after.issues.map((i) => i.code).sort()).toEqual(
      before.issues.map((i) => i.code).sort()
    );
  });

  /**
   * The Chosen Champion is counted inside the Main Deck by rule 103.2.b.1, but
   * our model holds it in its own zone. Encoding has to add its copy back and
   * decoding has to take it away, or the deck gains or loses a card each trip.
   */
  it('preserves a Champion that also has copies in the main deck', () => {
    const deck = buildRealDeck();
    const champion = deck.slots.find((s) => s.zone === 'champion')!.card;
    const withExtras: DeckList = {
      slots: [...deck.slots, { card: champion, quantity: 2, zone: 'main' }],
    };

    const decoded = decodeDeckCode(
      encodeDeckList(withExtras, catalogue).code,
      catalogue
    );

    const championSlot = decoded.slots.find((s) => s.zone === 'champion');
    const mainCopies = decoded.slots.find(
      (s) => s.zone === 'main' && cardKey(s.card) === cardKey(champion)
    );
    expect(championSlot?.quantity).toBe(1);
    expect(mainCopies?.quantity).toBe(2);
    // Total copies of that card is what the copy limit counts.
    expect(checkLegality({ slots: decoded.slots }).counts.main).toBe(
      checkLegality(withExtras).counts.main
    );
  });

  it('recovers every zone from the card type alone', () => {
    const deck = buildRealDeck();
    const decoded = decodeDeckCode(encodeDeckList(deck, catalogue).code, catalogue);

    const zoneCount = (list: DeckSlot[], zone: string) =>
      list.filter((s) => s.zone === zone).reduce((n, s) => n + s.quantity, 0);

    for (const zone of ['legend', 'champion', 'main', 'rune', 'battlefield']) {
      expect(zoneCount(decoded.slots, zone)).toBe(zoneCount(deck.slots, zone));
    }
  });

  /**
   * A sideboard can only arrive by import — nothing in the builder creates one,
   * since `defaultZoneFor` never returns that zone. It still has to survive
   * everything that happens to a deck afterwards, or importing someone's list
   * quietly discards part of it on the first edit.
   */
  it('keeps an imported sideboard through an edit and back out again', () => {
    const deck = buildRealDeck();
    const extra = catalogue.filter(
      (c) => c.type === 'Spell' && !deck.slots.some((s) => s.card.id === c.id)
    )[0]!;
    const imported = decodeDeckCode(
      encodeDeckList(
        { slots: [...deck.slots, { card: extra, quantity: 2, zone: 'sideboard' }] },
        catalogue
      ).code,
      catalogue
    );

    // An edit that touches only the main deck, as the editor would produce.
    const edited = {
      slots: imported.slots.map((s) =>
        s.zone === 'main' ? { ...s, quantity: Math.max(1, s.quantity - 1) } : s
      ),
    };

    const reExported = decodeDeckCode(encodeDeckList(edited, catalogue).code, catalogue);
    const side = reExported.slots.filter((s) => s.zone === 'sideboard');
    expect(side).toHaveLength(1);
    expect(side[0]!.quantity).toBe(2);
    expect(cardKey(side[0]!.card)).toBe(cardKey(extra));
  });

  it('leaves the sideboard out of the legality counts', () => {
    const deck = buildRealDeck();
    const extra = catalogue.filter(
      (c) => c.type === 'Spell' && !deck.slots.some((s) => s.card.id === c.id)
    )[0]!;

    const withSide = {
      slots: [...deck.slots, { card: extra, quantity: 5, zone: 'sideboard' as const }],
    };
    // A sideboard is not part of the 40 / 12 / 3, so adding one must not move
    // any count or change whether the deck is legal.
    expect(checkLegality(withSide).counts).toEqual(checkLegality(deck).counts);
  });

  it('carries a sideboard separately from the main deck', () => {
    const deck = buildRealDeck();
    const extra = catalogue.filter(
      (c) => c.type === 'Spell' && !deck.slots.some((s) => s.card.id === c.id)
    )[0]!;
    const withSide: DeckList = {
      slots: [...deck.slots, { card: extra, quantity: 2, zone: 'sideboard' }],
    };

    const decoded = decodeDeckCode(encodeDeckList(withSide, catalogue).code, catalogue);
    const side = decoded.slots.filter((s) => s.zone === 'sideboard');
    expect(side).toHaveLength(1);
    expect(side[0]!.quantity).toBe(2);
    expect(cardKey(side[0]!.card)).toBe(cardKey(extra));
  });
});

describe.skipIf(!hasSeed)('lossy edges, stated rather than discovered', () => {
  /**
   * A promo printing exports as its base-set card, so the art changes on the way
   * back. Deliberate: the format has no integer for OPP, PR or JDG, and a
   * statistics app cares which card was played, not which print run it came
   * from. The export screen says so.
   */
  it('normalises a promo printing to its base-set card', () => {
    // A promo Unit, so it lands in the main deck rather than the legend zone.
    const promo = catalogue.find(
      (c) => c.riftboundId.startsWith('opp-') && c.type === 'Unit'
    )!;
    const legend = find((c) => c.type === 'Legend')[0]!;
    const list: DeckList = {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: promo, quantity: 2, zone: 'main' },
      ],
    };

    const { code, reprinted, omitted } = encodeDeckList(list, catalogue);
    expect(omitted).toEqual([]);
    expect(reprinted).toHaveLength(1);
    expect(reprinted[0]!.card.id).toBe(promo.id);

    const decoded = decodeDeckCode(code, catalogue);
    const back = decoded.slots.find((s) => s.zone === 'main')!;

    // Same card by name — which is the unit the rules and the statistics use.
    expect(cardKey(back.card)).toBe(cardKey(promo));
    expect(back.quantity).toBe(2);
    // But not necessarily the same row: the promo printing is gone.
    expect(back.card.riftboundId.startsWith('opp-')).toBe(false);
  });

  it('omits tokens rather than failing the whole export', () => {
    const token = catalogue.find(isTokenCard);
    if (!token) return;

    const legend = find((c) => c.type === 'Legend')[0]!;
    const { code, omitted } = encodeDeckList(
      {
        slots: [
          { card: legend, quantity: 1, zone: 'legend' },
          { card: token, quantity: 1, zone: 'main' },
        ],
      },
      catalogue
    );

    expect(omitted).toHaveLength(1);
    expect(omitted[0]!.reason).toBe('token');
    // The rest of the deck still encodes.
    expect(decodeDeckCode(code, catalogue).slots).toHaveLength(1);
  });

  it('prefers the standard printing when several rows share a code', () => {
    // Runes repeat in the mirror under one riftbound_id.
    const rune = catalogue.find((c) => c.type === 'Rune')!;
    const legend = find((c) => c.type === 'Legend')[0]!;
    const decoded = decodeDeckCode(
      encodeDeckList(
        {
          slots: [
            { card: legend, quantity: 1, zone: 'legend' },
            { card: rune, quantity: 6, zone: 'rune' },
          ],
        },
        catalogue
      ).code,
      catalogue
    );

    const back = decoded.slots.find((s) => s.zone === 'rune')!;
    expect(back.quantity).toBe(6);
    expect(cardKey(back.card)).toBe(cardKey(rune));
  });
});

describe.skipIf(!hasSeed)('audit regressions', () => {
  /**
   * `loadDeckList` drops cards the mirror cannot resolve, so they never reach
   * the encoder. Before this, a deck missing a card exported as a *smaller
   * deck* with nothing said — the exact failure the token and promo rules
   * exist to prevent, not applied to the one case the screen already knew
   * about.
   */
  it('names cards the mirror lost instead of exporting a shorter deck', () => {
    const deck = buildRealDeck();
    const { omitted, code } = encodeDeckList(deck, catalogue, [
      { name: 'Statikk Shock', quantity: 3 },
      { name: null, quantity: 1 },
    ]);

    expect(omitted).toHaveLength(2);
    expect(omitted.map((o) => o.reason)).toEqual(['not-in-library', 'not-in-library']);
    expect(omitted[0]).toMatchObject({ name: 'Statikk Shock', quantity: 3, card: null });
    // A card with no stored name still has to appear, just less usefully.
    expect(omitted[1]!.name).toBeTruthy();
    // The code itself is still valid for what it could carry.
    expect(decodeDeckCode(code, catalogue).slots.length).toBeGreaterThan(0);
  });

  /**
   * Both lookups used to be first-wins over the caller's array, which came from
   * `queryCards({})` ordered by `clean_name` — a sort with 205 ties, over a
   * catalogue where 25 cards appear in two or more mapped sets. Reversing the
   * input changed the emitted code.
   */
  it('encodes and decodes identically whatever order the catalogue arrives in', () => {
    const deck = buildRealDeck();
    const reversed = [...catalogue].reverse();

    const forward = encodeDeckList(deck, catalogue).code;
    const backward = encodeDeckList(deck, reversed).code;
    expect(backward).toBe(forward);

    const rowsA = decodeDeckCode(forward, catalogue).slots.map((s) => s.card.id);
    const rowsB = decodeDeckCode(forward, reversed).slots.map((s) => s.card.id);
    expect(rowsB).toEqual(rowsA);
  });

  it('resolves a card printed in several sets to the earliest one', () => {
    // Body Rune exists in OGN, VEN and the unmapped OPP.
    const rune = catalogue.find(
      (c) => c.type === 'Rune' && c.riftboundId.startsWith('ven-')
    );
    if (!rune) return;

    const legend = find((c) => c.type === 'Legend')[0]!;
    const promo = catalogue.find(
      (c) => c.riftboundId.startsWith('opp-') && cardKey(c) === cardKey(rune)
    );
    if (!promo) return;

    const { code } = encodeDeckList(
      {
        slots: [
          { card: legend, quantity: 1, zone: 'legend' },
          { card: promo, quantity: 6, zone: 'rune' },
        ],
      },
      catalogue
    );

    // OGN ranks below VEN in SET_MAP, so the original printing wins.
    const back = decodeDeckCode(code, catalogue).slots.find((s) => s.zone === 'rune')!;
    expect(back.card.riftboundId.startsWith('ogn-')).toBe(true);
    expect(cardKey(back.card)).toBe(cardKey(rune));
  });

  /**
   * `getCodeFromDeck([])` does **not** throw — it returns a valid 28-character
   * code that decodes to an empty deck. Sharing that hands someone a code for
   * nothing while looking like it worked.
   */
  it('refuses to build a code for a deck with nothing in it', () => {
    expect(() => encodeDeckList({ slots: [] }, catalogue)).toThrow(DeckCodeError);
  });

  it('encodes the degenerate decks the create flow actually produces', () => {
    const legend = find((c) => c.type === 'Legend')[0]!;
    const champion = find((c) => c.type === 'Unit' && c.supertype === 'Champion')[0]!;

    // Legend only — the state between picking a Legend and picking a Champion.
    const onlyLegend = decodeDeckCode(
      encodeDeckList({ slots: [{ card: legend, quantity: 1, zone: 'legend' }] }, catalogue).code,
      catalogue
    );
    expect(onlyLegend.slots).toHaveLength(1);
    expect(onlyLegend.slots[0]!.zone).toBe('legend');

    // Legend + Champion — a deck straight out of the create flow.
    const pair = decodeDeckCode(
      encodeDeckList(
        {
          slots: [
            { card: legend, quantity: 1, zone: 'legend' },
            { card: champion, quantity: 1, zone: 'champion' },
          ],
        },
        catalogue
      ).code,
      catalogue
    );
    expect(pair.hadChosenChampion).toBe(true);
    expect(pair.slots.map((s) => s.zone).sort()).toEqual(['champion', 'legend']);
  });
});

describe.skipIf(!hasSeed)('extracting a code from pasted text', () => {
  const codeOf = () => encodeDeckList(buildRealDeck(), catalogue).code;

  it('finds the code in the message our own share sheet produces', () => {
    const code = codeOf();
    expect(extractDeckCode(`Darius Aggro\n\n${code}`)).toBe(code);
  });

  it('survives the mess a chat app makes of a paste', () => {
    const code = codeOf();
    for (const wrapper of [
      `  ${code}  `,
      `here you go: ${code}`,
      `${code}\n\n— sent from my phone`,
      `My Deck\n\n${code}\n\ngood luck!`,
    ]) {
      expect(extractDeckCode(wrapper)).toBe(code);
    }
  });

  it('is not fooled by shouting', () => {
    const code = codeOf();
    // A lenient scan would grab the capitals and then blame the code.
    expect(extractDeckCode(`THIS DECK IS ABSOLUTELY INCREDIBLE\n\n${code}`)).toBe(code);
  });

  it('reports no code rather than a bad one', () => {
    expect(() => extractDeckCode('')).toThrow(DeckCodeError);
    expect(() => extractDeckCode('just some words here')).toThrow(DeckCodeError);
    // Long enough to look like a code, but it is not one.
    expect(() => extractDeckCode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toThrow(DeckCodeError);
  });
});

describe.skipIf(!hasSeed)('naming an imported deck', () => {
  it('prefers the line the sender wrote above the code', () => {
    const code = encodeDeckList(buildRealDeck(), catalogue).code;
    const legend = find((c) => c.type === 'Legend')[0]!;
    expect(suggestDeckName(`Darius Aggro\n\n${code}`, legend)).toBe('Darius Aggro');
  });

  it('falls back to the Legend rather than to "Imported deck"', () => {
    const code = encodeDeckList(buildRealDeck(), catalogue).code;
    const legend = catalogue.find((c) => c.name.startsWith('Darius - '))!;
    expect(suggestDeckName(code, legend)).toBe('Darius');
  });

  it('strips a printing treatment out of the Legend name', () => {
    const code = encodeDeckList(buildRealDeck(), catalogue).code;
    const decorated = catalogue.find((c) => /\(.*\)$/.test(c.name) && c.type === 'Legend')!;
    expect(suggestDeckName(code, decorated)).not.toMatch(/[()]/);
  });

  it('has something to say even with no Legend at all', () => {
    expect(suggestDeckName('nonsense', null)).toBe('Imported deck');
  });
});

describe('deck code errors', () => {
  it('rejects an empty or malformed code with a readable message', () => {
    for (const bad of ['', '   ', 'not-a-code', 'AAAA!!!!']) {
      expect(() => decodeDeckCode(bad, catalogue)).toThrow(DeckCodeError);
    }
  });

  it('names codes the mirror cannot resolve instead of dropping them', () => {
    // A syntactically valid code for a card no catalogue contains.
    const { code } = encodeDeckList(
      {
        slots: [
          {
            card: { ...catalogue[0]!, riftboundId: 'ogn-999-298', id: 'ghost' },
            quantity: 3,
            zone: 'main',
          },
        ],
      },
      catalogue
    );

    const decoded = decodeDeckCode(code, catalogue);
    expect(decoded.slots).toEqual([]);
    expect(decoded.unknown).toEqual([{ cardCode: 'OGN-999', count: 3 }]);
  });
});
