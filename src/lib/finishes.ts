import type { CardRow } from '@/db/schema/cards';
import { t } from '@/i18n';

/**
 * Which finishes a card was printed in.
 *
 * **This is game knowledge, not data.** The Riftcodex API carries no finish
 * field — checked against the live endpoint, not just our mirror — so nothing
 * here can be derived or verified from a card row. It is a rule table, stated
 * once, in one place, so that correcting it is a single edit rather than a hunt
 * through the collection screens.
 *
 * The default is permissive on purpose: a card outside every rule offers both
 * finishes. If a rule is missing, the cost is an unused option; if the default
 * were "standard only", the cost would be a foil you physically hold and cannot
 * record. Losing data is worse than offering a choice nobody takes.
 */

export const FINISHES = ['standard', 'foil'] as const;
export type Finish = (typeof FINISHES)[number];

const FOIL_ONLY: readonly Finish[] = ['foil'];
const BOTH: readonly Finish[] = FINISHES;

/**
 * The four foil-only classes, confirmed 2026-08-09.
 *
 * Kept as separate predicates rather than one boolean expression so a rule can
 * be corrected — or dropped — without re-reading the other three.
 */
function isFoilOnly(card: Pick<CardRow, 'type' | 'rarity' | 'supertype' | 'signature' | 'alternateArt' | 'overnumbered'>): boolean {
  if (card.type === 'Legend') return true;
  if (card.rarity === 'Showcase') return true;
  // Both spellings of the same fact: the API exposes Signature as a supertype
  // and again as a metadata flag, and they do not always agree.
  if (card.supertype === 'Signature' || card.signature) return true;
  if (card.alternateArt || card.overnumbered) return true;
  return false;
}

export function finishesFor(
  card: Parameters<typeof isFoilOnly>[0]
): readonly Finish[] {
  return isFoilOnly(card) ? FOIL_ONLY : BOTH;
}

/** Was this card printed in this finish? The guard on every write. */
export function supportsFinish(card: Parameters<typeof isFoilOnly>[0], finish: Finish): boolean {
  return finishesFor(card).includes(finish);
}

/**
 * Which finish's count to *show* for a card, given the one being filed.
 *
 * Display only. There was briefly a `resolveFinish` that did this and was also
 * used by the write path, so tapping a Legend while the toggle said Standard
 * quietly filed a foil — the app doing something the user had not asked for.
 * Writes now refuse; only the badge substitutes, so a foil-only card still
 * shows the number it actually has.
 */
export function displayFinish(card: Parameters<typeof isFoilOnly>[0], wanted: Finish): Finish {
  return supportsFinish(card, wanted) ? wanted : 'foil';
}

export function finishLabel(finish: Finish): string {
  return t(finish === 'foil' ? 'finish.foil' : 'finish.standard');
}
