import type { CardRow } from '@/db/schema/cards';
import { t } from '@/i18n';

import {
  baseName,
  cardKey,
  championMatchesLegend,
  inDomainIdentity,
  isChampionUnit,
  isSignatureCard,
} from './card-identity';

/**
 * Constructed deck legality.
 *
 * Every rule here is cited to the **official Riftbound Core Rules** (rule 101–
 * 103, "Deck Construction", last updated 2026-07-16) rather than to a
 * secondary summary. Three of them contradict what a reasonable reading of the
 * summaries gives you, so the citations are load-bearing — see docs/API.md §7.
 *
 * Pure functions over a decklist — no database, no React — because this runs on
 * every keystroke in the editor and every issue it reports has to name the exact
 * thing that is wrong. "Deck is illegal" is useless; "Main deck 38/40 — 2 more
 * cards" is an instruction.
 *
 * Illegal decks are always saveable. Deckbuilding is iterative and a builder
 * that refuses to save a half-finished list is hostile, so nothing here blocks
 * anything — it only reports.
 */

/**
 * The zones a card can occupy.
 *
 * A bare union rather than an exported array: nothing ever iterated the array,
 * and the screens that show zones each order them their own way.
 */
export type DeckZone =
  | 'legend'
  | 'champion'
  | 'main'
  | 'rune'
  | 'battlefield'
  | 'sideboard';

/**
 * Revision of the rules encoded here.
 *
 * `deck_versions` caches this module's output (`is_legal`, the three counts).
 * When the rules change, that cache is wrong — so every stored version carries
 * the revision that wrote it, and the query layer recomputes anything older.
 *
 * Bump this whenever a change here could alter a verdict.
 *
 * - **1** — first version checked against the official Core Rules. Corrected
 *   the Main Deck from an exact 40 to a minimum, scoped the copy limit to the
 *   Main Deck instead of exempting Basic cards everywhere, and added the
 *   distinct-Battlefields rule.
 * - **2** — the sideboard became reachable from the builder, and its copies now
 *   count towards the 3-copy limit. That can turn a previously "legal" imported
 *   deck illegal, so every cached verdict written under revision 1 is stale.
 */
export const RULES_VERSION = 2;

/** Rule 103.2 — "A Main Deck of **at least** 40 cards". A minimum, not a target. */
export const MAIN_DECK_SIZE = 40;

/**
 * How the main deck's threshold is written on screen — **`40+`, never `40`**.
 *
 * Every other zone in the same readout is an exact requirement, so `x/y` had
 * come to mean "y is the number you must hit": `Runes 12/12`, `BF 3/3`. Printing
 * the minimum in that same form made `Main 41/40` read as one card over the
 * limit, and it sat directly beside a verdict saying the deck was legal. Two
 * screens went further and coloured 41 in `danger` red while declaring the same
 * deck legal — a readout arguing with itself.
 *
 * The rule was right and the notation was lying about which kind of rule it was.
 * Exported as a string so the exact and the minimum zones are visibly different
 * wherever they appear together, and so the five places that render this cannot
 * drift apart.
 */
export const MAIN_DECK_TARGET = `${MAIN_DECK_SIZE}+`;
/** Rule 103.3.a — exactly 12 Rune Cards. */
export const RUNE_DECK_SIZE = 12;
/** Rule 103.4.a — dictated by the Mode of Play; 3 for standard Constructed. */
export const BATTLEFIELD_COUNT = 3;
/** Rule 103.2.b — "Your **Main Deck** can include up to 3 copies of the same named card." */
export const COPY_LIMIT = 3;
/** Rule 103.2.d.1 — "a deck may only contain a sum total of 3 Signature cards". */
const SIGNATURE_LIMIT = 3;

/**
 * Zones the 3-copy limit applies to.
 *
 * Rule 103.2.b scopes it to the **Main Deck**, and 103.2.b.1 puts the Chosen
 * Champion inside that scope ("This includes your Chosen Champion" — a deck may
 * run Volibear as its Champion and 2 more in the Main Deck).
 *
 * The Rune Deck (103.3) states no copy limit at all, and Battlefields have
 * their own distinct-names rule (103.4.c) instead. An earlier version of this
 * file got the same answer for runes by exempting `supertype === 'Basic'`,
 * reasoned from the fact that only 6 distinct rune cards exist so a capped
 * 12-rune deck is impossible. That inference was right about runes and wrong
 * about everything else: keyed on the card rather than the zone, it also let
 * three copies of one Battlefield through.
 *
 * **`sideboard` shares the same pool of 3.** The limit is 3 copies of a card
 * *in total* across the Main Deck and the sideboard together — 3 + 0, 2 + 1 and
 * 1 + 2 are all legal holdings of three, and 3 + 1 is four copies.
 *
 * That is the whole point of the sideboard: it is an extension of the deck, not
 * a second deck. Running 2 in the Main Deck and 1 on the side lets a player swap
 * the third copy in between games of a Bo3 or Bo5 — taking something else out to
 * stay at 40 — which is impossible if the two zones each get their own limit.
 *
 * Confirmed by the project owner rather than by a rule number: 103.2.b names
 * only the Main Deck, and the Core Rules text checked here says nothing about
 * sideboards. Recorded that way so the provenance is not mistaken for a
 * citation.
 */
const COPY_LIMIT_ZONES: DeckZone[] = ['main', 'champion', 'sideboard'];

export interface DeckSlot {
  card: CardRow;
  quantity: number;
  zone: DeckZone;
}

/**
 * A decklist as the editor holds it.
 *
 * Deliberately a flat slot list rather than `{ legend, champion, main[] }`: it
 * maps 1:1 onto `deck_version_cards`, so there is no second representation to
 * keep in step with the database. The Legend and Champion are read back out
 * with the helpers below.
 */
export interface DeckList {
  slots: DeckSlot[];
}

export type LegalityCode =
  | 'no-legend'
  | 'no-champion'
  | 'champion-not-unit'
  | 'champion-name'
  | 'champion-domain'
  | 'main-count'
  | 'rune-count'
  | 'battlefield-count'
  | 'battlefield-duplicate'
  | 'copy-limit'
  | 'signature-limit'
  | 'signature-tag'
  | 'domain-identity';

export interface LegalityIssue {
  code: LegalityCode;
  /** Written to be shown verbatim in the legality bar. */
  message: string;
  /** Printing ids the editor should highlight. Empty for whole-deck issues. */
  cardIds: string[];
}

export interface DeckCounts {
  /** Includes the Champion — it occupies one of the 40 main-deck slots. */
  main: number;
  rune: number;
  battlefield: number;
  signature: number;
}

export interface LegalityResult {
  legal: boolean;
  issues: LegalityIssue[];
  counts: DeckCounts;
}

function legendOf(list: DeckList): CardRow | null {
  return list.slots.find((s) => s.zone === 'legend')?.card ?? null;
}

function championOf(list: DeckList): CardRow | null {
  return list.slots.find((s) => s.zone === 'champion')?.card ?? null;
}

function total(list: DeckList, zone: DeckZone): number {
  return list.slots
    .filter((s) => s.zone === zone)
    .reduce((sum, s) => sum + s.quantity, 0);
}

export function deckCounts(list: DeckList): DeckCounts {
  const champion = championOf(list);
  return {
    main: total(list, 'main') + (champion ? 1 : 0),
    rune: total(list, 'rune'),
    battlefield: total(list, 'battlefield'),
    signature: list.slots
      .filter((s) => s.zone !== 'legend' && isSignatureCard(s.card))
      .reduce((sum, s) => sum + s.quantity, 0),
  };
}

/** Zones that hold actual deck cards, as opposed to the Legend. */
const DECK_CARD_ZONES: DeckZone[] = ['champion', 'main', 'rune', 'battlefield'];

/**
 * The three countable zones, as catalogue keys.
 *
 * A narrow union rather than `Key`: none of the three takes a placeholder, and
 * `t()` only lets you omit the parameter argument when the key's type proves
 * there is nothing to fill in.
 *
 * `plural()` lived here and went with the sentences it built — the count
 * messages are whole keys now, one per case, because German puts the shortfall
 * before the noun and no fragment order reads correctly in both languages.
 */
type ZoneKey =
  | 'legality.zone.main'
  | 'legality.zone.runes'
  | 'legality.zone.battlefields';

/**
 * A zone whose size must be exact — the Rune Deck and the Battlefields.
 */
function exactCountIssue(
  code: LegalityCode,
  zone: ZoneKey,
  actual: number,
  required: number
): LegalityIssue | null {
  if (actual === required) return null;
  const diff = Math.abs(actual - required);
  /*
   * Whole sentences, not a label plus a fraction plus a tail.
   *
   * The three pieces were concatenated in English order. German puts the
   * shortfall before the noun — "2 Karten fehlen" — so no arrangement of the
   * fragments reads correctly in both languages; each case is its own key.
   */
  const message =
    actual < required
      ? t(diff === 1 ? 'legality.short.one' : 'legality.short.other', {
          zone: t(zone),
          actual,
          required,
          count: diff,
        })
      : t('legality.over', { zone: t(zone), actual, required, count: diff });
  return { code, message, cardIds: [] };
}

/**
 * The Main Deck, which rule 103.2 specifies as a **minimum** of 40 — "A Main
 * Deck of at least 40 cards". A 42-card deck is legal, not two cards over.
 */
function minimumCountIssue(
  code: LegalityCode,
  zone: ZoneKey,
  actual: number,
  minimum: number
): LegalityIssue | null {
  if (actual >= minimum) return null;
  const diff = minimum - actual;
  return {
    code,
    message: t(diff === 1 ? 'legality.short.one' : 'legality.short.other', {
      zone: t(zone),
      actual,
      required: minimum,
      count: diff,
    }),
    cardIds: [],
  };
}

export function checkLegality(list: DeckList): LegalityResult {
  const issues: LegalityIssue[] = [];
  const counts = deckCounts(list);
  const legend = legendOf(list);
  const champion = championOf(list);

  if (!legend) {
    issues.push({
      code: 'no-legend',
      message: t('legality.noLegend'),
      cardIds: [],
    });
  }

  if (!champion) {
    issues.push({
      code: 'no-champion',
      message: t('legality.noChampion'),
      cardIds: [],
    });
  } else if (!isChampionUnit(champion)) {
    issues.push({
      code: 'champion-not-unit',
      message: t('legality.championNotUnit', { name: baseName(champion.name) }),
      cardIds: [champion.id],
    });
  } else if (legend) {
    const { nameMatches, inIdentity } = championMatchesLegend(champion, legend);
    if (!nameMatches) {
      issues.push({
        code: 'champion-name',
        message: t('legality.championName', {
          name: baseName(champion.name),
          legend: baseName(legend.name),
        }),
        cardIds: [champion.id],
      });
    }
    if (!inIdentity) {
      issues.push({
        code: 'champion-domain',
        message: t('legality.championDomain', {
          name: baseName(champion.name),
          domains: legend.domains.join('/'),
        }),
        cardIds: [champion.id],
      });
    }
  }

  const mainIssue = minimumCountIssue(
    'main-count',
    'legality.zone.main',
    counts.main,
    MAIN_DECK_SIZE
  );
  if (mainIssue) issues.push(mainIssue);

  const runeIssue = exactCountIssue(
    'rune-count',
    'legality.zone.runes',
    counts.rune,
    RUNE_DECK_SIZE
  );
  if (runeIssue) issues.push(runeIssue);

  const bfIssue = exactCountIssue(
    'battlefield-count',
    'legality.zone.battlefields',
    counts.battlefield,
    BATTLEFIELD_COUNT
  );
  if (bfIssue) issues.push(bfIssue);

  // Rule 103.4.c — "Cannot include more than one of a Battlefield of the same
  // name when there are more than one required for the deck." Battlefields are
  // outside the Main Deck's 3-copy limit and carry this instead: the three must
  // be distinct. 64 distinct Battlefields exist, so this constrains nothing in
  // practice — it just has to be checked.
  if (BATTLEFIELD_COUNT > 1) {
    const byBattlefield = new Map<string, { quantity: number; ids: string[]; name: string }>();
    for (const slot of list.slots) {
      if (slot.zone !== 'battlefield') continue;
      const key = cardKey(slot.card);
      const entry = byBattlefield.get(key) ?? {
        quantity: 0,
        ids: [],
        name: baseName(slot.card.name),
      };
      entry.quantity += slot.quantity;
      entry.ids.push(slot.card.id);
      byBattlefield.set(key, entry);
    }
    for (const entry of byBattlefield.values()) {
      if (entry.quantity > 1) {
        issues.push({
          code: 'battlefield-duplicate',
          message: t('legality.battlefieldDuplicate', {
            count: entry.quantity,
            name: entry.name,
          }),
          cardIds: entry.ids,
        });
      }
    }
  }

  // Rule 103.2.b — copy limit, counted per card rather than per printing.
  // 103.2.b.2 makes names the unit ("cards have different names even if they
  // represent the same character"), and a printing treatment is not part of the
  // name, so three copies of an alternate art plus three of the original is six
  // copies of one card.
  const byKey = new Map<string, { quantity: number; ids: string[]; name: string }>();
  for (const slot of list.slots) {
    if (!COPY_LIMIT_ZONES.includes(slot.zone)) continue;
    const key = cardKey(slot.card);
    const entry = byKey.get(key) ?? { quantity: 0, ids: [], name: baseName(slot.card.name) };
    entry.quantity += slot.quantity;
    entry.ids.push(slot.card.id);
    byKey.set(key, entry);
  }
  for (const entry of byKey.values()) {
    if (entry.quantity > COPY_LIMIT) {
      issues.push({
        code: 'copy-limit',
        message: t('legality.copyLimit', {
          count: entry.quantity,
          name: entry.name,
          limit: COPY_LIMIT,
        }),
        cardIds: entry.ids,
      });
    }
  }

  if (counts.signature > SIGNATURE_LIMIT) {
    issues.push({
      code: 'signature-limit',
      message: t('legality.signatureLimit', {
        count: counts.signature,
        limit: SIGNATURE_LIMIT,
      }),
      cardIds: list.slots
        .filter((s) => s.zone !== 'legend' && isSignatureCard(s.card))
        .map((s) => s.card.id),
    });
  }

  if (legend) {
    // Every Signature card must belong to this Legend's Champion.
    const foreignSignatures = list.slots.filter(
      (s) =>
        s.zone !== 'legend' &&
        isSignatureCard(s.card) &&
        !s.card.tags.some((t) => legend.tags.includes(t))
    );
    if (foreignSignatures.length > 0) {
      issues.push({
        code: 'signature-tag',
        message:
          foreignSignatures.length === 1
            ? t('legality.foreignSignature.one', {
                name: baseName(foreignSignatures[0]!.card.name),
              })
            : t('legality.foreignSignature.other', { count: foreignSignatures.length }),
        cardIds: foreignSignatures.map((s) => s.card.id),
      });
    }

    // Domain identity. Battlefields are Colorless, so they pass automatically
    // and are checked here rather than exempted, which keeps the rule uniform.
    const offIdentity = list.slots.filter(
      (s) =>
        DECK_CARD_ZONES.includes(s.zone) && !inDomainIdentity(s.card, legend.domains)
    );
    if (offIdentity.length > 0) {
      const names = [...new Set(offIdentity.map((s) => baseName(s.card.name)))];
      issues.push({
        code: 'domain-identity',
        message:
          names.length === 1
            ? t('legality.offIdentity.one', {
                name: names[0] ?? '',
                domains: legend.domains.join('/'),
              })
            : t('legality.offIdentity.other', {
                count: names.length,
                domains: legend.domains.join('/'),
              }),
        cardIds: offIdentity.map((s) => s.card.id),
      });
    }
  }

  return { legal: issues.length === 0, issues, counts };
}

/**
 * Why a single card cannot go in a deck, or null if it can.
 *
 * Used by the builder's card rail to grey out illegal cards rather than hide
 * them — you need to see that a card exists and is off-identity, otherwise the
 * rail just looks like it is missing cards.
 */
export function slotBlockReason(
  card: CardRow,
  list: DeckList
): 'off-identity' | 'copy-limit' | 'foreign-signature' | 'battlefield-duplicate' | null {
  const legend = legendOf(list);
  if (legend && !inDomainIdentity(card, legend.domains)) return 'off-identity';
  if (legend && isSignatureCard(card) && !card.tags.some((t) => legend.tags.includes(t))) {
    return 'foreign-signature';
  }

  const key = cardKey(card);
  const copiesIn = (zones: DeckZone[]) =>
    list.slots
      .filter((s) => zones.includes(s.zone) && cardKey(s.card) === key)
      .reduce((sum, s) => sum + s.quantity, 0);

  // Battlefields answer to 103.4.c (all different), not to the Main Deck's
  // 3-copy limit; runes answer to neither.
  const zone = defaultZoneFor(card);
  if (zone === 'battlefield') {
    return copiesIn(['battlefield']) >= 1 ? 'battlefield-duplicate' : null;
  }
  if (COPY_LIMIT_ZONES.includes(zone) && copiesIn(COPY_LIMIT_ZONES) >= COPY_LIMIT) {
    return 'copy-limit';
  }

  return null;
}

/** The zone a card belongs in when added from the card rail. */
export function defaultZoneFor(card: Pick<CardRow, 'type'>): DeckZone {
  if (card.type === 'Rune') return 'rune';
  if (card.type === 'Battlefield') return 'battlefield';
  if (card.type === 'Legend') return 'legend';
  return 'main';
}

/*
 * `legalitySummary()` lived here and returned the counts as one string. Deleted
 * in the post-M5 audit: `LegalityBar` renders each count as its own element so
 * it can colour them independently, which is strictly better than a sentence,
 * and the string had no caller.
 */
