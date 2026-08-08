import {
  getCodeFromDeck,
  getDeckFromCode,
  SET_MAP,
} from '@piltoverarchive/riftbound-deck-codes';

import type { CardRow } from '@/db/schema/cards';

import { cardKey } from './card-identity';
import { defaultZoneFor, type DeckList, type DeckSlot, type DeckZone } from './legality';

/**
 * Deck codes — the only place that touches
 * `@piltoverarchive/riftbound-deck-codes`.
 *
 * Every rule a call site could get wrong lives here, because each one fails
 * quietly rather than loudly:
 *
 * - **`{ signedSuffix: '*' }` on every decode.** The package accepts `s` and `*`
 *   for the signed variant and defaults to `s`; our catalogue writes `*`. Decode
 *   without it and signed cards come back as codes the mirror cannot resolve —
 *   36 cards that look like they simply are not in the library.
 * - **Promo and judge printings resolve to their base-set card.** `OPP`, `PR`
 *   and `JDG` have no integer in `SET_MAP`, so they cannot be encoded directly.
 *   All 149 of them are alternate printings of cards that *are* in a mapped set,
 *   matched on `cardKey()` — the same base-name key the copy limit uses. Not on
 *   collector number: four of them disagree between `riftbound_id` and
 *   `collector_number`.
 * - **Tokens are excluded.** A `t`-prefixed card is created during play and can
 *   never be in a decklist.
 *
 * ## How our zones map onto the format
 *
 * The format carries `mainDeck`, `sideboard` and an optional `chosenChampion`.
 * It has no Legend field and no rune or battlefield section, so everything
 * except the sideboard travels in `mainDeck` and the zone is recovered from the
 * card's type on the way back — `defaultZoneFor()`, which the builder already
 * uses.
 *
 * That is not a guess. Decoding the reference code published with the library
 * gives a main deck of exactly 56 cards: 40 Units and Spells, 12 Runes, 3
 * Battlefields and 1 Legend. Our convention is the ecosystem's convention.
 *
 * The Chosen Champion is the one card that appears twice over: `chosenChampion`
 * names it, *and* its copy is counted in `mainDeck`, because rule 103.2.b.1 puts
 * it inside the Main Deck. Our model splits those — one copy in the `champion`
 * zone, any further copies in `main` — so encoding adds the champion's copy back
 * and decoding takes it away again.
 */

/** `unl-229*-219` → UNL / '' / 229 / *      `ven-sp4-006` → VEN / SP / 4 / '' */
const RIFTBOUND_ID = /^([a-z]+)-([a-z]{0,2})(\d+)([a-z*]?)(?:-|$)/;

export type CardCodeSkip = 'unparseable' | 'token' | 'unresolved-promo' | 'not-in-library';

export interface OmittedCard {
  /** Null for a card the mirror could not resolve — only its name survives. */
  card: CardRow | null;
  name: string;
  quantity: number;
  reason: CardCodeSkip;
}

/**
 * A card the version holds that the mirror cannot resolve.
 *
 * `loadDeckList` drops these before the editor or the encoder ever see them, so
 * they have to be passed in separately or the export is quietly short.
 */
export interface UnresolvedCard {
  name: string | null;
  quantity: number;
}

/**
 * The card code for a printing, ignoring promo resolution.
 *
 * Returns null for anything the format cannot name: tokens, and cards in sets
 * with no integer mapping.
 */
function directCardCode(card: CardRow): string | null {
  const match = RIFTBOUND_ID.exec(card.riftboundId);
  if (!match) return null;

  const [, rawSet, prefix, digits, variant] = match;
  const set = rawSet!.toUpperCase();
  const upperPrefix = prefix!.toUpperCase();

  if (upperPrefix === 'T') return null;
  if (!(set in SET_MAP)) return null;

  return `${set}-${upperPrefix}${digits}${variant}`;
}

/** True for a card the format can never carry, regardless of the catalogue. */
export function isTokenCard(card: CardRow): boolean {
  const match = RIFTBOUND_ID.exec(card.riftboundId);
  return match?.[2]?.toUpperCase() === 'T';
}

/** Where a set sits in `SET_MAP`; roughly chronological, so lower is earlier. */
function setRank(code: string): number {
  const set = code.slice(0, code.indexOf('-'));
  return (SET_MAP as Record<string, number>)[set] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Base-set code for every card in the catalogue, keyed by `cardKey()`.
 *
 * Built once per encode or decode rather than per card — the catalogue is 1,451
 * rows and both are one-off user actions, so a map is cheaper than repeated
 * scans and far cheaper than a query per card.
 *
 * **Ordered explicitly, not by whatever the caller passed in.** Both maps used
 * to take first-wins over the argument, which meant the answer depended on
 * `queryCards({})`'s `ORDER BY clean_name` — and 205 names tie under that sort,
 * with 25 cards printed in two or more mapped sets. Reversing the catalogue
 * changed the emitted code, so the same deck could export differently on two
 * devices, or on one device across a resync.
 *
 * The rule is now: **earliest set wins, then lowest card id.** A promo is a
 * reprint of an original, so it resolves to the original.
 */
function buildIndex(catalogue: readonly CardRow[]) {
  const entries: { card: CardRow; code: string }[] = [];
  for (const card of catalogue) {
    const code = directCardCode(card);
    if (code) entries.push({ card, code });
  }

  entries.sort(
    (a, b) =>
      setRank(a.code) - setRank(b.code) ||
      Number(isDecorated(a.card)) - Number(isDecorated(b.card)) ||
      a.card.id.localeCompare(b.card.id)
  );

  const codeByKey = new Map<string, string>();
  const cardsByCode = new Map<string, CardRow[]>();

  for (const { card, code } of entries) {
    if (!codeByKey.has(cardKey(card))) codeByKey.set(cardKey(card), code);
    const rows = cardsByCode.get(code) ?? [];
    rows.push(card);
    cardsByCode.set(code, rows);
  }

  return { codeByKey, cardsByCode };
}

/** Any treatment other than the plain printing. */
function isDecorated(card: CardRow): boolean {
  return card.alternateArt || card.signature || card.overnumbered;
}

export interface EncodeResult {
  code: string;
  /** Cards the code could not carry. Always shown, never silently dropped. */
  omitted: OmittedCard[];
  /** Cards whose printing normalised to a different one — promo → base set. */
  reprinted: { card: CardRow; code: string }[];
}

/**
 * Encode a decklist.
 *
 * Throws when nothing encodable is left, because the package does **not**:
 * `getCodeFromDeck([])` returns a perfectly valid 28-character code that
 * decodes to an empty deck. Sharing that would hand someone a code for nothing
 * and look like it worked.
 *
 * `unresolved` carries the cards the mirror could not resolve. They never reach
 * `list` — `loadDeckList` drops them — so without this an export of a deck
 * missing a card silently produces a *smaller deck*, which is the exact failure
 * the token and promo rules exist to prevent.
 */
export function encodeDeckList(
  list: DeckList,
  catalogue: readonly CardRow[],
  unresolved: readonly UnresolvedCard[] = []
): EncodeResult {
  const { codeByKey } = buildIndex(catalogue);

  const counts = new Map<string, number>();
  const omitted: OmittedCard[] = [];
  const reprinted: { card: CardRow; code: string }[] = [];
  const sideboard = new Map<string, number>();
  let chosenChampion: string | undefined;

  const add = (target: Map<string, number>, code: string, quantity: number) => {
    target.set(code, (target.get(code) ?? 0) + quantity);
  };

  for (const slot of list.slots) {
    if (slot.quantity <= 0) continue;

    let code = directCardCode(slot.card);
    if (!code) {
      if (isTokenCard(slot.card)) {
        omitted.push({
          card: slot.card,
          name: slot.card.name,
          quantity: slot.quantity,
          reason: 'token',
        });
        continue;
      }
      // A promo or judge printing: carry the same card from a mapped set.
      code = codeByKey.get(cardKey(slot.card)) ?? null;
      if (!code) {
        omitted.push({
          card: slot.card,
          name: slot.card.name,
          quantity: slot.quantity,
          reason: 'unresolved-promo',
        });
        continue;
      }
      reprinted.push({ card: slot.card, code });
    }

    if (slot.zone === 'sideboard') {
      add(sideboard, code, slot.quantity);
      continue;
    }

    // Everything else — Legend, Champion, main, runes, battlefields — is one
    // flat main deck, exactly as the reference code lays it out.
    add(counts, code, slot.quantity);
    if (slot.zone === 'champion') chosenChampion = code;
  }

  // Cards the mirror could not resolve. Named as far as the database can name
  // them — `deck_version_cards.card_name` survives a card leaving the library.
  for (const missing of unresolved) {
    omitted.push({
      card: null,
      name: missing.name ?? 'An unknown card',
      quantity: missing.quantity,
      reason: 'not-in-library',
    });
  }

  const mainDeck = [...counts.entries()].map(([cardCode, count]) => ({ cardCode, count }));
  const side = [...sideboard.entries()].map(([cardCode, count]) => ({ cardCode, count }));

  if (mainDeck.length === 0 && side.length === 0) {
    throw new DeckCodeError('There is nothing in this deck a code can carry yet.');
  }

  return {
    code: getCodeFromDeck(mainDeck, side, chosenChampion),
    omitted,
    reprinted,
  };
}

export interface UnknownCard {
  cardCode: string;
  count: number;
}

export interface DecodeResult {
  slots: DeckSlot[];
  /** Codes the mirror cannot resolve. Named to the user, never dropped in silence. */
  unknown: UnknownCard[];
  /** True when the code designated a Chosen Champion. */
  hadChosenChampion: boolean;
}

export class DeckCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckCodeError';
  }
}

/**
 * Base32 as the format emits it: RFC 4648's alphabet, unpadded.
 *
 * The length floor matters. Our own share sheet writes `"<deck name>\n\n<code>"`,
 * so import has to find the code inside prose — but a lenient scan that grabs
 * any run of capitals would happily return `DECKLIST` and then report "invalid
 * deck code", which sends the user hunting for a problem in the code rather
 * than in the paste. 24 characters is comfortably below the shortest real code
 * (an empty deck is 28, a Legend alone 36) and far above anything that occurs
 * in ordinary writing.
 */
const BASE32_RUN = /[A-Z2-7]{24,}/g;

/**
 * Pull a deck code out of whatever the user pasted.
 *
 * Candidates are tried longest first and validated by actually decoding them,
 * so a message containing both a code and a long shouty word cannot pick the
 * wrong one — the wrong one does not decode.
 */
export function extractDeckCode(pasted: string): string {
  const text = pasted.trim();
  if (!text) throw new DeckCodeError('Paste a deck code first.');

  const candidates = [...text.matchAll(BASE32_RUN)]
    .map((m) => m[0])
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) {
    throw new DeckCodeError('No deck code found in that text.');
  }

  for (const candidate of candidates) {
    try {
      getDeckFromCode(candidate, { signedSuffix: '*' });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new DeckCodeError('That does not look like a valid deck code.');
}

/**
 * A name for an imported deck.
 *
 * Deck codes carry no name, so there are three sources in descending order of
 * how much they actually know:
 *
 * 1. **A line the sender wrote.** Our share sheet puts the deck name directly
 *    above the code, so when a code arrives that way the real name is right
 *    there. Only a suggestion — it is whatever text happened to accompany the
 *    code, and the preview lets it be edited.
 * 2. **The Legend.** "Darius" is a better starting point than "Imported deck"
 *    because it is at least about this deck.
 * 3. A generic fallback, when the code resolves to nothing recognisable.
 */
export function suggestDeckName(pasted: string, legend: CardRow | null): string {
  const code = (() => {
    try {
      return extractDeckCode(pasted);
    } catch {
      return null;
    }
  })();

  if (code) {
    const line = pasted
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.includes(code) && l.length <= 60)[0];
    if (line) return line;
  }

  if (legend) {
    // "Darius - Hand of Noxus" → "Darius"; "Vi, Piltover Enforcer" → "Vi".
    const short = legend.name.replace(/\s*\([^()]*\)\s*$/, '').split(/\s+[-,]\s+/)[0];
    if (short) return short.trim();
  }

  return 'Imported deck';
}

/**
 * Choose which of our rows to use when several share one card code.
 *
 * `riftbound_id` is not unique — the same printing appears more than once in the
 * mirror. Prefer the standard treatment so an imported deck opens on the plain
 * card rather than on whichever row the database happened to return first.
 */
function preferredPrinting(rows: readonly CardRow[]): CardRow {
  // `rows` arrives already ordered by `buildIndex` — earliest set, plain
  // treatment, then card id — so first-wins here is a decision rather than an
  // accident of query order.
  return rows.find((c) => !isDecorated(c)) ?? rows[0]!;
}

/**
 * Decode a deck code into slots.
 *
 * Zones come from the card's type, which is what makes the flattening lossless:
 * a Rune can only be in the rune deck, a Battlefield can only be a battlefield.
 * The Chosen Champion is lifted out of the main deck into its own zone, since
 * that is how our model stores it.
 */
export function decodeDeckCode(code: string, catalogue: readonly CardRow[]): DecodeResult {
  const trimmed = code.trim();
  if (!trimmed) throw new DeckCodeError('Enter a deck code.');

  let decoded;
  try {
    // Never omit this option — see the module comment.
    decoded = getDeckFromCode(trimmed, { signedSuffix: '*' });
  } catch {
    throw new DeckCodeError('That is not a valid deck code.');
  }

  const { cardsByCode } = buildIndex(catalogue);
  const slots: DeckSlot[] = [];
  const unknown: UnknownCard[] = [];

  const championCode = decoded.chosenChampion;
  const push = (card: CardRow, quantity: number, zone: DeckZone) => {
    if (quantity > 0) slots.push({ card, quantity, zone });
  };

  for (const entry of decoded.mainDeck) {
    const rows = cardsByCode.get(entry.cardCode);
    if (!rows?.length) {
      unknown.push({ cardCode: entry.cardCode, count: entry.count });
      continue;
    }
    const card = preferredPrinting(rows);

    if (championCode && entry.cardCode === championCode) {
      // One copy is the Chosen Champion; the rest are ordinary main-deck cards.
      push(card, 1, 'champion');
      push(card, entry.count - 1, 'main');
      continue;
    }
    push(card, entry.count, defaultZoneFor(card));
  }

  for (const entry of decoded.sideboard) {
    const rows = cardsByCode.get(entry.cardCode);
    if (!rows?.length) {
      unknown.push({ cardCode: entry.cardCode, count: entry.count });
      continue;
    }
    push(preferredPrinting(rows), entry.count, 'sideboard');
  }

  return { slots, unknown, hadChosenChampion: !!championCode };
}
