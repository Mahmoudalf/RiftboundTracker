import { describe, expect, it } from 'vitest';

import { isPickablePrinting } from './card-identity';

describe('isPickablePrinting', () => {
  const card = (name: string) => ({ name });

  it('accepts the three treatments a decklist distinguishes', () => {
    expect(isPickablePrinting(card('Shen - Eye of Twilight'))).toBe(true);
    expect(isPickablePrinting(card('Shen - Eye of Twilight (Alternate Art)'))).toBe(true);
    expect(isPickablePrinting(card('Shen - Eye of Twilight (Overnumbered)'))).toBe(true);
  });

  /*
   * 28 Metal Legends exist. Offering them alongside the standard, alt-art and
   * overnumbered printings turns "pick your Legend" into the same Legend five
   * times over — they stay collectable and searchable, just not pickable.
   */
  it('rejects the packaging variants', () => {
    expect(isPickablePrinting(card('Yasuo - Unforgiven (Metal)'))).toBe(false);
    expect(isPickablePrinting(card('Vi - Piltover Enforcer (Signature)'))).toBe(false);
    expect(isPickablePrinting(card('Jinx - Loose Cannon (Starter)'))).toBe(false);
    expect(isPickablePrinting(card('Ekko - Boy Genius (Launch Exclusive)'))).toBe(false);
  });
});
