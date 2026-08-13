import type { NewCardRow } from '@/db/schema/cards';

import type { ApiCard } from './schemas';

/**
 * API shape -> database row.
 *
 * Shared by the live sync and the build-time seed generator so both write
 * byte-identical rows; a seeded database and a synced one must be
 * indistinguishable.
 */

/**
 * Canonical domain ordering, so `domain_key` is stable regardless of the order
 * the API happened to return. Mirrors DOMAINS in `src/theme/domains.ts` — kept
 * as a local copy so this module stays importable from a plain Node script.
 */
const DOMAIN_ORDER = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order', 'Colorless'];

export function domainKey(domains: readonly string[]): string {
  return [...domains]
    .sort((a, b) => {
      const ia = DOMAIN_ORDER.indexOf(a);
      const ib = DOMAIN_ORDER.indexOf(b);
      // Unknown domains sort last, alphabetically, rather than to the front.
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .join(',');
}

export function toCardRow(card: ApiCard): NewCardRow {
  const domains = card.classification.domain ?? [];

  return {
    id: card.id,
    riftboundId: card.riftbound_id,
    tcgplayerId: card.tcgplayer_id ?? null,

    name: card.name,
    cleanName: card.metadata.clean_name ?? card.name,
    collectorNumber: card.collector_number ?? null,

    energy: card.attributes.energy ?? null,
    might: card.attributes.might ?? null,
    power: card.attributes.power ?? null,

    type: card.classification.type,
    supertype: card.classification.supertype ?? null,
    rarity: card.classification.rarity,
    domains,
    domainKey: domainKey(domains),

    textPlain: card.text.plain ?? null,
    textRich: card.text.rich ?? null,
    flavour: card.text.flavour ?? null,
    tags: card.tags ?? [],

    setId: card.set.set_id,
    setLabel: card.set.label,

    imageUrl: card.media.image_url ?? null,
    artist: card.media.artist ?? null,
    accessibilityText: card.media.accessibility_text ?? null,
    orientation: card.orientation || 'portrait',

    alternateArt: card.metadata.alternate_art,
    signature: card.metadata.signature,
    overnumbered: card.metadata.overnumbered,
    isNew: card.new ?? false,

    updatedOn: card.metadata.updated_on ?? null,
  };
}

/*
 * `toSetRow` was here. It mapped `GET /sets` into the `sets` table, which
 * migration 22 dropped for having no reader — so the mapper went with it.
 *
 * The endpoint is still called: `syncCards` sums `card_count` across the live
 * response to decide whether anything upstream has changed. It just reads that
 * field directly rather than shaping a row for storage.
 */

/**
 * Drop the stale twin when the API returns a card twice.
 *
 * Measured against the live 1,451-card response: **147 `riftbound_id`s appear
 * on two rows.** 131 of those pairs have one complete row and one leftover with
 * `clean_name: null` — and in 52 cases the leftover also carries the *wrong*
 * display name, missing its `(Alternate Art)` suffix. That is what puts two
 * apparently identical "Shen, Scourge of Shadows" entries in a Champion picker:
 * one of them is the alt-art printing wearing the standard printing's name.
 *
 * The other 16 pairs are real. A Metal printing genuinely shares its
 * `riftbound_id` with the standard one, and both rows are complete — so
 * de-duplicating on `riftbound_id` alone would delete every Metal card in the
 * set. The discriminator has to be `clean_name`, not the id.
 *
 * Upstream's problem, fixed at our boundary: the mirror is rebuilt from this on
 * every sync, so filtering here is enough and no migration is needed.
 */
export function dropStaleDuplicates(cards: readonly ApiCard[]): ApiCard[] {
  const named = new Set<string>();
  for (const card of cards) {
    if (card.metadata.clean_name) named.add(card.riftbound_id);
  }
  return cards.filter((card) => card.metadata.clean_name || !named.has(card.riftbound_id));
}
