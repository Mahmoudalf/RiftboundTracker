import { describe, expect, it } from 'vitest';

import { cardColumns, hydrateCard, hydrateSet, toBindValue } from './hydrate';

/**
 * These tests exist because the original implementation cast a raw `SELECT *`
 * row straight to CardRow. SQLite returns snake_case column names, so 12 of 29
 * fields — including `imageUrl` — were silently `undefined`, and every card in
 * the gallery rendered without art. Typecheck could not catch it; only asserting
 * on real column names can.
 */

/** A row exactly as SQLite returns it: snake_case, 0/1 booleans, JSON strings. */
const RAW_CARD_ROW: Record<string, unknown> = {
  id: 'card-1',
  riftbound_id: 'unl-229-219',
  tcgplayer_id: '685522',
  name: 'Vi - Piltover Enforcer',
  clean_name: 'Vi Piltover Enforcer',
  collector_number: 229,
  energy: 3,
  might: 2,
  power: null,
  type: 'Unit',
  supertype: 'Champion',
  rarity: 'Rare',
  domains: '["Fury","Order"]',
  domain_key: 'Fury,Order',
  text_plain: 'When you conquer, ready a unit.',
  text_rich: '<p>When you conquer, ready a unit.</p>',
  flavour: 'Punch first.',
  tags: '["Vi","Piltover"]',
  set_id: 'UNL',
  set_label: 'Unleashed',
  image_url: 'https://cdn.example/vi-744x1039.png?accountingTag=RB',
  artist: 'Jonathan Santoro',
  accessibility_text: 'Riftbound Unit: Vi.',
  orientation: 'portrait',
  alternate_art: 0,
  signature: 0,
  overnumbered: 0,
  is_new: 1,
  updated_on: '2026-07-10T22:45:08Z',
};

describe('hydrateCard', () => {
  const card = hydrateCard(RAW_CARD_ROW);

  it('populates every field the schema declares', () => {
    // The regression guard: nothing may come back undefined.
    const undefinedKeys = cardColumns
      .map((m) => m.key)
      .filter((key) => (card as unknown as Record<string, unknown>)[key] === undefined);
    expect(undefinedKeys).toEqual([]);
  });

  it('maps snake_case columns onto camelCase fields', () => {
    expect(card.imageUrl).toBe('https://cdn.example/vi-744x1039.png?accountingTag=RB');
    expect(card.cleanName).toBe('Vi Piltover Enforcer');
    expect(card.collectorNumber).toBe(229);
    expect(card.setId).toBe('UNL');
    expect(card.setLabel).toBe('Unleashed');
    expect(card.textPlain).toBe('When you conquer, ready a unit.');
    expect(card.accessibilityText).toBe('Riftbound Unit: Vi.');
    expect(card.riftboundId).toBe('unl-229-219');
    expect(card.domainKey).toBe('Fury,Order');
    expect(card.updatedOn).toBe('2026-07-10T22:45:08Z');
  });

  it('parses JSON columns into arrays', () => {
    expect(card.domains).toEqual(['Fury', 'Order']);
    expect(card.tags).toEqual(['Vi', 'Piltover']);
  });

  it('converts SQLite 0/1 integers into booleans', () => {
    expect(card.isNew).toBe(true);
    expect(card.alternateArt).toBe(false);
    expect(card.signature).toBe(false);
  });

  it('preserves nulls rather than coercing them', () => {
    expect(card.power).toBeNull();
  });

  it('survives malformed or missing JSON without throwing', () => {
    const broken = hydrateCard({ ...RAW_CARD_ROW, domains: 'not json', tags: null });
    expect(broken.domains).toEqual([]);
    expect(broken.tags).toEqual([]);
  });

  it('covers every column defined on the cards table', () => {
    // 29 columns; if the schema grows, the mapping grows with it automatically.
    expect(cardColumns).toHaveLength(29);
    expect(cardColumns.map((m) => m.sqlName)).toContain('accessibility_text');
  });
});

describe('toBindValue', () => {
  const column = (key: string) => cardColumns.find((c) => c.key === key)!;

  it('stringifies JSON columns, including when the value is missing', () => {
    expect(toBindValue(['Fury'], column('domains'))).toBe('["Fury"]');
    expect(toBindValue(undefined, column('tags'))).toBe('[]');
  });

  it('writes booleans as 0/1 integers', () => {
    expect(toBindValue(true, column('isNew'))).toBe(1);
    expect(toBindValue(false, column('isNew'))).toBe(0);
    expect(toBindValue(undefined, column('signature'))).toBe(0);
  });

  it('falls back to the column default rather than inserting null into NOT NULL', () => {
    // `orientation` is NOT NULL DEFAULT 'portrait'. Binding null here would
    // abort the whole seed transaction on a card missing that field.
    expect(toBindValue(undefined, column('orientation'))).toBe('portrait');
    expect(toBindValue(null, column('orientation'))).toBe('portrait');
    expect(toBindValue('landscape', column('orientation'))).toBe('landscape');
  });

  it('keeps nulls for genuinely nullable columns', () => {
    expect(toBindValue(undefined, column('power'))).toBeNull();
    expect(toBindValue(null, column('artist'))).toBeNull();
  });

  it('round-trips every column through bind then hydrate', () => {
    const bound: Record<string, unknown> = {};
    for (const col of cardColumns) {
      bound[col.sqlName] = toBindValue(
        (hydrateCard(RAW_CARD_ROW) as unknown as Record<string, unknown>)[col.key],
        col
      );
    }
    const round = hydrateCard(bound);
    expect(round).toEqual(hydrateCard(RAW_CARD_ROW));
  });
});

describe('hydrateSet', () => {
  it('maps columns and parses the cardmarket id array', () => {
    const set = hydrateSet({
      id: 'set-1',
      name: 'Origins',
      set_id: 'OGN',
      card_count: 352,
      tcgplayer_id: '24344',
      cardmarket_ids: '["6286"]',
      published_on: '2025-10-31T00:00:00',
    });

    expect(set.setId).toBe('OGN');
    expect(set.cardCount).toBe(352);
    expect(set.cardmarketIds).toEqual(['6286']);
    expect(set.publishedOn).toBe('2025-10-31T00:00:00');
    expect(set.tcgplayerId).toBe('24344');
  });
});
