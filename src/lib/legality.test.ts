import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';

import { cardKey, isChampionUnit, isSignatureCard } from './card-identity';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  deckCounts,
  defaultZoneFor,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  slotBlockReason,
  type DeckList,
  type DeckSlot,
  type LegalityCode,
} from './legality';

let nextId = 0;

function card(partial: Partial<CardRow> & Pick<CardRow, 'name' | 'type'>): CardRow {
  return {
    id: `c${nextId++}`,
    riftboundId: 'ogn-001-100',
    tcgplayerId: null,
    cleanName: partial.name,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
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
    imageUrl: null,
    artist: null,
    accessibilityText: null,
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    updatedOn: null,
    ...partial,
  };
}

const LEGEND = card({
  name: 'Vi - Piltover Enforcer',
  type: 'Legend',
  domains: ['Fury', 'Order'],
  domainKey: 'Fury,Order',
  tags: ['Vi'],
});

const CHAMPION = card({
  name: 'Vi - Enforcer',
  type: 'Unit',
  supertype: 'Champion',
  domains: ['Fury'],
  tags: ['Vi', 'Piltover'],
});

const codes = (list: DeckList): LegalityCode[] =>
  checkLegality(list).issues.map((i) => i.code);

/** A legal deck built from fixtures: Legend + Champion + 39 main + 12 runes + 3 BF. */
function legalList(): DeckList {
  const filler = card({ name: 'Fury Strike', type: 'Spell', domains: ['Fury'] });

  const slots: DeckSlot[] = [
    { card: LEGEND, quantity: 1, zone: 'legend' },
    { card: CHAMPION, quantity: 1, zone: 'champion' },
  ];

  // Rule 103.4.c — the Battlefields must all have different names.
  for (let i = 0; i < BATTLEFIELD_COUNT; i++) {
    slots.push({
      card: card({
        name: `Battlefield ${i}`,
        type: 'Battlefield',
        domains: ['Colorless'],
        id: `bf${i}`,
      }),
      quantity: 1,
      zone: 'battlefield',
    });
  }

  // 39 main + champion = 40, respecting the 3-copy limit: 13 distinct cards × 3.
  for (let i = 0; i < 13; i++) {
    slots.push({
      card: card({ ...filler, name: `Fury Strike ${i}`, id: `main${i}` }),
      quantity: 3,
      zone: 'main',
    });
  }
  // 12 runes as a real deck holds them: 6 of each of the identity's two domain
  // runes. Only one rune card exists per domain, so this shape is only possible
  // because Basic runes are exempt from the 3-copy limit.
  for (const domain of LEGEND.domains) {
    slots.push({
      card: card({
        name: `${domain} Rune`,
        type: 'Rune',
        supertype: 'Basic',
        domains: [domain],
        id: `rune-${domain}`,
      }),
      quantity: 6,
      zone: 'rune',
    });
  }
  return { slots };
}

describe('checkLegality', () => {
  it('accepts a complete 40 + 12 + 3 deck', () => {
    const result = checkLegality(legalList());
    expect(result.issues).toEqual([]);
    expect(result.legal).toBe(true);
    expect(result.counts).toMatchObject({ main: 40, rune: 12, battlefield: 3 });
  });

  it('counts the Champion toward the 40-card main deck', () => {
    const list = legalList();
    const counts = deckCounts(list);
    // 13 × 3 main slots is 39; the Champion is the fortieth card.
    expect(counts.main).toBe(MAIN_DECK_SIZE);

    const withoutChampion = { slots: list.slots.filter((s) => s.zone !== 'champion') };
    expect(deckCounts(withoutChampion).main).toBe(MAIN_DECK_SIZE - 1);
  });

  it('reports the exact shortfall rather than just failing', () => {
    const list = legalList();
    const main = list.slots.find((s) => s.zone === 'main')!;
    main.quantity = 1; // 39 - 2 = 37, + champion = 38
    const issue = checkLegality(list).issues.find((i) => i.code === 'main-count');
    expect(issue?.message).toBe('Main deck 38/40 — 2 more cards');
  });

  it('uses the singular when exactly one card is missing', () => {
    const list = legalList();
    list.slots.find((s) => s.zone === 'main')!.quantity = 2;
    const issue = checkLegality(list).issues.find((i) => i.code === 'main-count');
    expect(issue?.message).toBe('Main deck 39/40 — 1 more card');
  });

  it('allows a main deck larger than 40 — rule 103.2 sets a minimum', () => {
    const list = legalList();
    list.slots.push({
      card: card({ name: 'Extra', type: 'Spell', domains: ['Fury'] }),
      quantity: 2,
      zone: 'main',
    });
    const result = checkLegality(list);
    expect(result.counts.main).toBe(42);
    expect(result.issues.map((i) => i.code)).not.toContain('main-count');
    expect(result.legal).toBe(true);
  });

  it('still requires the rune deck to be exactly 12', () => {
    const list = legalList();
    list.slots.find((s) => s.zone === 'rune')!.quantity = 7;
    const issue = checkLegality(list).issues.find((i) => i.code === 'rune-count');
    expect(issue?.message).toBe('Runes 13/12 — 1 too many');
  });

  it('requires a Legend and a Champion', () => {
    expect(codes({ slots: [] })).toContain('no-legend');
    expect(codes({ slots: [] })).toContain('no-champion');
  });

  it('rejects a Champion whose tags do not overlap the Legend', () => {
    const list = legalList();
    const champion = list.slots.find((s) => s.zone === 'champion')!;
    champion.card = card({
      name: 'Jinx - Loose Cannon',
      type: 'Unit',
      supertype: 'Champion',
      domains: ['Fury'],
      tags: ['Jinx'],
    });
    expect(codes(list)).toContain('champion-name');
  });

  it('rejects a Champion sharing a name but no domain', () => {
    const list = legalList();
    list.slots.find((s) => s.zone === 'champion')!.card = card({
      name: 'Vi - Elsewhere',
      type: 'Unit',
      supertype: 'Champion',
      domains: ['Calm'],
      tags: ['Vi'],
    });
    const result = codes(list);
    expect(result).toContain('champion-domain');
    expect(result).not.toContain('champion-name');
  });

  it('rejects a Champion-supertype Legend as the Champion', () => {
    const list = legalList();
    list.slots.find((s) => s.zone === 'champion')!.card = card({
      name: 'Vi - Piltover Enforcer',
      type: 'Legend',
      supertype: 'Champion',
      domains: ['Fury'],
      tags: ['Vi'],
    });
    expect(codes(list)).toContain('champion-not-unit');
  });

  it('counts copies per card, not per printing', () => {
    const list = legalList();
    const base = card({ name: 'Statikk Shock', type: 'Spell', domains: ['Fury'] });
    const alt = card({ name: 'Statikk Shock (Alternate Art)', type: 'Spell', domains: ['Fury'] });
    // Two different printings, three copies each — six copies of one card.
    list.slots.push({ card: base, quantity: 3, zone: 'main' });
    list.slots.push({ card: alt, quantity: 3, zone: 'main' });

    const issue = checkLegality(list).issues.find((i) => i.code === 'copy-limit');
    expect(issue?.message).toBe('6 copies of Statikk Shock — the limit is 3');
    expect(issue?.cardIds).toEqual([base.id, alt.id]);
  });

  it('applies no copy limit to the rune deck — rule 103.2.b scopes it to the Main Deck', () => {
    // 6 copies of one rune card, which every legal deck needs: there is exactly
    // one rune per domain and the rune deck must hold 12.
    const result = checkLegality(legalList());
    expect(result.counts.rune).toBe(RUNE_DECK_SIZE);
    expect(result.issues.map((i) => i.code)).not.toContain('copy-limit');
    expect(
      slotBlockReason(
        card({ name: 'Fury Rune', type: 'Rune', supertype: 'Basic', domains: ['Fury'] }),
        legalList()
      )
    ).toBeNull();
  });

  it('requires the three Battlefields to be different — rule 103.4.c', () => {
    const list = legalList();
    const duplicated = list.slots.filter((s) => s.zone === 'battlefield');
    // Collapse the three distinct Battlefields into three copies of one.
    const first = duplicated[0]!;
    list.slots = list.slots.filter((s) => s.zone !== 'battlefield');
    list.slots.push({ card: first.card, quantity: 3, zone: 'battlefield' });

    const result = checkLegality(list);
    expect(result.counts.battlefield).toBe(BATTLEFIELD_COUNT);
    // The count is right, so only the distinctness rule catches this.
    expect(result.issues.map((i) => i.code)).not.toContain('battlefield-count');
    const issue = result.issues.find((i) => i.code === 'battlefield-duplicate');
    expect(issue?.message).toBe('3 copies of Battlefield 0 — Battlefields must be different');
  });

  it('blocks a duplicate Battlefield in the rail', () => {
    const list = legalList();
    const existing = list.slots.find((s) => s.zone === 'battlefield')!.card;
    expect(slotBlockReason(existing, list)).toBe('battlefield-duplicate');

    const fresh = card({ name: 'Somewhere Else', type: 'Battlefield', domains: ['Colorless'] });
    expect(slotBlockReason(fresh, list)).toBeNull();
  });

  it('allows three copies spread across printings', () => {
    const list = legalList();
    list.slots.find((s) => s.zone === 'main')!.quantity = 1;
    list.slots.push({
      card: card({ name: 'Fury Strike 0 (Metal)', type: 'Spell', domains: ['Fury'] }),
      quantity: 2,
      zone: 'main',
    });
    expect(codes(list)).not.toContain('copy-limit');
  });

  it('enforces the Signature limit on supertype, not the art treatment', () => {
    const list = legalList();
    // Four Signature-supertype cards belonging to this Legend's Champion.
    for (let i = 0; i < 4; i++) {
      list.slots.push({
        card: card({
          name: `Vi Signature ${i}`,
          type: 'Spell',
          supertype: 'Signature',
          domains: ['Fury', 'Order'],
          tags: ['Vi'],
        }),
        quantity: 1,
        zone: 'main',
      });
    }
    expect(codes(list)).toContain('signature-limit');
  });

  it('ignores the signature art flag when counting Signature cards', () => {
    const list = legalList();
    for (let i = 0; i < 5; i++) {
      list.slots.push({
        card: card({
          name: `Fury Bolt ${i} (Signature)`,
          type: 'Spell',
          signature: true, // art treatment only — not a Signature-supertype card
          domains: ['Fury'],
        }),
        quantity: 1,
        zone: 'main',
      });
    }
    const result = checkLegality(list);
    expect(result.counts.signature).toBe(0);
    expect(result.issues.map((i) => i.code)).not.toContain('signature-limit');
  });

  it("rejects another Champion's Signature card", () => {
    const list = legalList();
    list.slots.push({
      card: card({
        name: 'Death from Below',
        type: 'Spell',
        supertype: 'Signature',
        domains: ['Fury', 'Order'],
        tags: ['Pyke'],
      }),
      quantity: 1,
      zone: 'main',
    });
    expect(codes(list)).toContain('signature-tag');
  });

  it('requires both symbols of a dual-domain card to be inside the identity', () => {
    const list = legalList();
    list.slots.push({
      card: card({
        name: 'Half In',
        type: 'Spell',
        domains: ['Fury', 'Chaos'], // Fury is legal, Chaos is not
        tags: ['Vi'],
      }),
      quantity: 1,
      zone: 'main',
    });
    const issue = checkLegality(list).issues.find((i) => i.code === 'domain-identity');
    expect(issue?.message).toBe('Half In is outside Fury/Order');
  });

  it('treats Colorless as legal in every identity', () => {
    const list = legalList();
    expect(codes(list)).not.toContain('domain-identity');
    // The three Battlefields in the legal list are Colorless.
    expect(
      list.slots.filter((s) => s.zone === 'battlefield')[0]!.card.domains
    ).toEqual(['Colorless']);
  });

  it('never blocks — an illegal deck still produces a result, not a throw', () => {
    const result = checkLegality({ slots: [] });
    expect(result.legal).toBe(false);
    expect(result.counts).toEqual({ main: 0, rune: 0, battlefield: 0, signature: 0 });
  });
});

describe('slotBlockReason', () => {
  it('blocks off-identity cards', () => {
    const list = legalList();
    const chaos = card({ name: 'Chaos Bolt', type: 'Spell', domains: ['Chaos'] });
    expect(slotBlockReason(chaos, list)).toBe('off-identity');
  });

  it('blocks a fourth copy across printings', () => {
    const list = legalList();
    const alt = card({ name: 'Fury Strike 0 (Metal)', type: 'Spell', domains: ['Fury'] });
    expect(slotBlockReason(alt, list)).toBe('copy-limit');
  });

  it("blocks another Champion's Signature card", () => {
    const list = legalList();
    const foreign = card({
      name: 'Void Assault',
      type: 'Spell',
      supertype: 'Signature',
      domains: ['Fury', 'Order'],
      tags: ["Kha'Zix"],
    });
    expect(slotBlockReason(foreign, list)).toBe('foreign-signature');
  });

  it('allows a legal in-identity card', () => {
    const list = legalList();
    expect(
      slotBlockReason(card({ name: 'Brand New', type: 'Spell', domains: ['Order'] }), list)
    ).toBeNull();
  });
});

describe('defaultZoneFor', () => {
  it('routes each card type to its zone', () => {
    expect(defaultZoneFor({ type: 'Rune' })).toBe('rune');
    expect(defaultZoneFor({ type: 'Battlefield' })).toBe('battlefield');
    expect(defaultZoneFor({ type: 'Legend' })).toBe('legend');
    expect(defaultZoneFor({ type: 'Unit' })).toBe('main');
    expect(defaultZoneFor({ type: 'Spell' })).toBe('main');
    expect(defaultZoneFor({ type: 'Gear' })).toBe('main');
  });
});

/**
 * Fixtures prove the rules do what they say. This proves the rules match the
 * actual card library — that the assumptions behind them (tags identify
 * Champions, Signature is a supertype, Battlefields are Colorless) hold across
 * all 1,451 printings and not just the ones I hand-wrote.
 *
 * Skipped when the seed is absent, since `assets/seed/cards.json` is generated
 * rather than committed.
 */
const SEED_PATH = join(process.cwd(), 'assets/seed/cards.json');
const hasSeed = existsSync(SEED_PATH);

describe.skipIf(!hasSeed)('against the real card library', () => {
  const cards: CardRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf8')).cards;

  const legends = cards.filter((c) => c.type === 'Legend');
  const champions = cards.filter(isChampionUnit);

  it('finds every Legend a legal Champion', () => {
    const orphans = legends.filter(
      (l) =>
        !champions.some(
          (c) =>
            c.tags.some((t) => l.tags.includes(t)) &&
            c.domains.some((d) => l.domains.includes(d))
        )
    );
    expect(orphans.map((l) => l.name)).toEqual([]);
  });

  it('keeps the Signature supertype and the signature art flag disjoint', () => {
    // If these ever overlap, `isSignatureCard` needs revisiting — the whole
    // reason it reads the supertype is that they describe different things.
    expect(cards.filter((c) => isSignatureCard(c) && c.signature)).toEqual([]);
    expect(cards.filter(isSignatureCard).length).toBeGreaterThan(0);
  });

  it('has only Colorless Battlefields, so any Battlefield fits any deck', () => {
    const coloured = cards
      .filter((c) => c.type === 'Battlefield')
      .filter((c) => c.domains.some((d) => d !== 'Colorless'));
    expect(coloured.map((c) => c.name)).toEqual([]);
  });

  it('builds a legal deck out of real cards', () => {
    const legend = legends.find((l) => l.name.startsWith('Vi - Piltover Enforcer'))!;
    const champion = champions.find(
      (c) =>
        c.tags.some((t) => legend.tags.includes(t)) &&
        c.domains.some((d) => legend.domains.includes(d))
    )!;

    const inIdentity = (c: CardRow) =>
      c.domains.every((d) => d === 'Colorless' || legend.domains.includes(d));

    // Distinct cards, so the 3-copy limit is counted per card not per printing.
    const seen = new Set<string>([cardKey(champion)]);
    const pool = cards.filter((c) => {
      if (!['Unit', 'Spell', 'Gear'].includes(c.type)) return false;
      if (!inIdentity(c) || isSignatureCard(c)) return false;
      const key = cardKey(c);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // One distinct rune per domain in the identity, split evenly. Slicing four
    // rune *printings* instead would be six copies of the same card.
    const runeKeys = new Set<string>();
    const runes = cards.filter((c) => {
      if (c.type !== 'Rune' || !inIdentity(c)) return false;
      const key = cardKey(c);
      if (runeKeys.has(key)) return false;
      runeKeys.add(key);
      return true;
    });
    expect(runes).toHaveLength(legend.domains.length);

    // Three *distinct* Battlefields — rule 103.4.c forbids repeats.
    const bfKeys = new Set<string>();
    const battlefields = cards
      .filter((c) => {
        if (c.type !== 'Battlefield') return false;
        const key = cardKey(c);
        if (bfKeys.has(key)) return false;
        bfKeys.add(key);
        return true;
      })
      .slice(0, BATTLEFIELD_COUNT);

    const slots: DeckSlot[] = [
      { card: legend, quantity: 1, zone: 'legend' },
      { card: champion, quantity: 1, zone: 'champion' },
      ...pool.slice(0, 13).map((c): DeckSlot => ({ card: c, quantity: 3, zone: 'main' })),
      ...runes.map(
        (c): DeckSlot => ({
          card: c,
          quantity: RUNE_DECK_SIZE / runes.length,
          zone: 'rune',
        })
      ),
      ...battlefields.map((c): DeckSlot => ({ card: c, quantity: 1, zone: 'battlefield' })),
    ];

    const result = checkLegality({ slots });
    expect(result.issues).toEqual([]);
    expect(result.legal).toBe(true);
  });
});
