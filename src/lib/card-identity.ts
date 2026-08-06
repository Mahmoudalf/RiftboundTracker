import type { CardRow } from '@/db/schema/cards';

/**
 * Card identity — telling *cards* apart from *printings*.
 *
 * The mirror stores 1,451 printings of 954 distinct cards. Almost every rule in
 * `legality.ts` is about the card, not the printing, so getting this wrong is
 * how you end up allowing six copies of one card in a legal-looking deck.
 */

/**
 * Printing treatments observed across the whole library, as of the 1,451-card
 * mirror: Signature, Alternate Art, Overnumbered, Metal, Ultimate, Launch
 * Exclusive, GG EZ, Starter. Every one is a trailing parenthetical, and no card
 * uses a trailing parenthetical for anything else.
 *
 * The pattern is deliberately general rather than an enumeration of those eight.
 * A new treatment appearing upstream then collapses correctly with no code
 * change; the cost is that a card genuinely named `Foo (Bar)` would be treated
 * as a printing of `Foo`. That failure direction is the safe one — it makes the
 * copy limit stricter, so the builder flags a deck rather than quietly passing
 * an illegal one.
 */
const PRINTING_SUFFIX = /\s*\([^()]*\)\s*$/;

/**
 * The key that the 3-copy limit counts against.
 *
 * `id` is per-printing and `cleanName` keeps the treatment in it, so both let
 * "Poppy - Paragon" and "Poppy - Paragon (Alternate Art)" sit in the same deck
 * at three copies each. They are the same card.
 */
export function cardKey(card: Pick<CardRow, 'name'>): string {
  return card.name.replace(PRINTING_SUFFIX, '').trim().toLowerCase();
}

/** Display name with the printing treatment removed. */
export function baseName(name: string): string {
  return name.replace(PRINTING_SUFFIX, '').trim();
}

/**
 * The printing treatment, or null for the standard printing.
 *
 * Every observed treatment is a trailing parenthetical: Signature, Alternate
 * Art, Overnumbered, Metal, Ultimate, Launch Exclusive, GG EZ, Starter. Pickers
 * show this so the variants of one card can be told apart — they are the same
 * card to the rules and a different card to the player choosing art.
 */
export function variantLabel(name: string): string | null {
  const match = PRINTING_SUFFIX.exec(name);
  return match ? match[0].trim().replace(/^\(|\)$/g, '') : null;
}

/**
 * A Champion Unit — the card a deck's Legend must be paired with.
 *
 * `supertype === 'Champion'` alone is not enough: 27 of the 403 Champion-
 * supertype cards are Legends, which cannot be the deck's Champion.
 */
export function isChampionUnit(card: Pick<CardRow, 'type' | 'supertype'>): boolean {
  return card.type === 'Unit' && card.supertype === 'Champion';
}

/**
 * A Signature card, for the "max 3 Signature cards" rule.
 *
 * This is the `supertype`, **not** the `signature` column. The two describe
 * different things and their sets do not intersect at all:
 *
 * - `supertype === 'Signature'` — 61 cards (52 Spells, 5 Gear, 4 Units). These
 *   are the deck-legal Signature cards the rule is about. All are dual-domain
 *   and all carry a champion tag.
 * - `signature === true` — 36 cards, all Legends or alternate printings. This is
 *   an *art treatment* (the `(Signature)` suffix), and none of them can be in a
 *   main deck at all.
 *
 * Reading the column instead would enforce the limit against cards that can
 * never be in a deck, and never enforce it against the cards it exists for.
 */
export function isSignatureCard(card: Pick<CardRow, 'supertype'>): boolean {
  return card.supertype === 'Signature';
}

/**
 * Whether a card falls inside a Legend's domain identity.
 *
 * Colorless is always legal — that is what makes every Battlefield playable in
 * every deck. A dual-domain card needs *both* of its symbols inside the
 * identity, which is why this is `every` and not `some`.
 */
export function inDomainIdentity(
  card: Pick<CardRow, 'domains'>,
  legendDomains: readonly string[]
): boolean {
  return card.domains.every((d) => d === 'Colorless' || legendDomains.includes(d));
}

/**
 * Whether a Champion Unit may be paired with a Legend.
 *
 * Matching is on **tags**, not names. Names are unreliable: they use both
 * `" - "` and `", "` as separators, and 23 Legends carry only a title
 * ("Master of Shadows" is Zed's). Tags are exact — checked against all 180
 * Legends, every one has at least one Champion Unit that shares a tag and a
 * domain, and none match through a region tag by accident.
 *
 * Tag matching also handles the tribal case correctly for free: Kennen's Legend
 * is tagged `["Yordle", "Kennen"]`, so it legally pairs with any Yordle
 * Champion rather than only with Kennen.
 */
export function championMatchesLegend(
  champion: Pick<CardRow, 'type' | 'supertype' | 'tags' | 'domains'>,
  legend: Pick<CardRow, 'tags' | 'domains'>
): { nameMatches: boolean; inIdentity: boolean } {
  return {
    nameMatches: champion.tags.some((t) => legend.tags.includes(t)),
    // Rule 103.2.c — the Chosen Champion is a Main Deck card and so is subject
    // to Domain Identity, not merely required to share one domain. Every
    // Champion Unit in the library is single-domain today, so the two readings
    // coincide; they would not for a dual-domain Champion.
    inIdentity: inDomainIdentity(champion, legend.domains),
  };
}
