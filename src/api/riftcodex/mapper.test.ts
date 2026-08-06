import { describe, expect, it } from 'vitest';

import { domainKey, toCardRow, toSetRow } from './mapper';
import { cardSchema, setSchema } from './schemas';

/**
 * Fixtures are verbatim responses captured from the live API on 2026-08-05, so
 * these tests fail loudly if the upstream shape drifts.
 */

const VI_LEGEND = {
  id: '69c4407c9288b1e85d94de8a',
  name: 'Vi - Piltover Enforcer (Signature)',
  riftbound_id: 'unl-229*-219',
  tcgplayer_id: '685522',
  collector_number: 229,
  attributes: { energy: null, might: null, power: null },
  classification: { type: 'Legend', supertype: null, rarity: 'Rare', domain: ['Fury', 'Order'] },
  text: { rich: '<p>When you conquer…</p>', plain: 'When you conquer…', flavour: null },
  set: { set_id: 'UNL', label: 'Unleashed' },
  media: {
    image_url: 'https://cmsassets.rgpub.io/sanity/images/x/y-744x1039.png?accountingTag=RB',
    artist: 'Jonathan Santoro',
    accessibility_text: 'Riftbound Legend: Piltover Enforcer.',
  },
  tags: ['Vi'],
  orientation: 'portrait',
  metadata: {
    clean_name: 'Vi Piltover Enforcer Signature',
    updated_on: '2026-07-10T22:45:08.861364+00:00',
    alternate_art: false,
    overnumbered: false,
    signature: true,
  },
  new: false,
};

describe('domainKey', () => {
  it('orders domains canonically regardless of input order', () => {
    // Both orders must produce the same key, or the "legal in my identity"
    // query silently misses cards.
    expect(domainKey(['Order', 'Fury'])).toBe('Fury,Order');
    expect(domainKey(['Fury', 'Order'])).toBe('Fury,Order');
  });

  it('sorts unknown domains last rather than first', () => {
    expect(domainKey(['Nonsense', 'Mind'])).toBe('Mind,Nonsense');
  });

  it('handles mono and empty domain lists', () => {
    expect(domainKey(['Chaos'])).toBe('Chaos');
    expect(domainKey([])).toBe('');
  });
});

describe('toCardRow', () => {
  const row = toCardRow(cardSchema.parse(VI_LEGEND));

  it('flattens nested attributes and classification', () => {
    expect(row.energy).toBeNull();
    expect(row.type).toBe('Legend');
    expect(row.rarity).toBe('Rare');
    expect(row.domains).toEqual(['Fury', 'Order']);
    expect(row.domainKey).toBe('Fury,Order');
  });

  it('falls back to name when the API omits clean_name', () => {
    const withoutClean = toCardRow(
      cardSchema.parse({ ...VI_LEGEND, metadata: { ...VI_LEGEND.metadata, clean_name: null } })
    );
    expect(withoutClean.cleanName).toBe('Vi - Piltover Enforcer (Signature)');
  });

  it('preserves the signature flag used by the 3-signature deck limit', () => {
    expect(row.signature).toBe(true);
  });

  it('defaults orientation when the API sends an empty string', () => {
    const row2 = toCardRow(cardSchema.parse({ ...VI_LEGEND, orientation: '' }));
    expect(row2.orientation).toBe('portrait');
  });
});

describe('toSetRow', () => {
  it('normalises a bare cardmarket_id string into an array', () => {
    const row = toSetRow(
      setSchema.parse({
        id: 'a',
        name: 'Origins',
        set_id: 'OGN',
        card_count: 352,
        tcgplayer_id: '24344',
        cardmarket_id: '6286',
        published_on: '2025-10-31T00:00:00',
      })
    );
    expect(row.cardmarketIds).toEqual(['6286']);
  });

  it('keeps an array cardmarket_id as-is', () => {
    const row = toSetRow(
      setSchema.parse({
        id: 'b',
        name: 'Promos',
        set_id: 'PR',
        card_count: 13,
        cardmarket_id: ['6322', '6483'],
      })
    );
    expect(row.cardmarketIds).toEqual(['6322', '6483']);
  });

  it('treats a missing cardmarket_id as empty', () => {
    const row = toSetRow(
      setSchema.parse({ id: 'c', name: 'Vendetta', set_id: 'VEN', card_count: 358 })
    );
    expect(row.cardmarketIds).toEqual([]);
  });
});
