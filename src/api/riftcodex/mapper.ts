import type { NewCardRow } from '@/db/schema/cards';

import type { ApiCard, ApiSet } from './schemas';

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

export function toSetRow(set: ApiSet) {
  return {
    id: set.id,
    name: set.name,
    setId: set.set_id,
    cardCount: set.card_count,
    tcgplayerId: set.tcgplayer_id ?? null,
    cardmarketIds: set.cardmarket_id,
    publishedOn: set.published_on ?? null,
  };
}
