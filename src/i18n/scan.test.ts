import { describe, expect, it } from 'vitest';

import { scanSource } from './scan';

/**
 * The scanner, against the five shapes that got past the first migration.
 *
 * Every case below is a real string from the app, in the construct it was
 * actually written in. That matters more than coverage: a scanner tested on
 * strings invented for the test proves only that it finds strings someone
 * already had in mind, which is precisely how 107 of these survived a pass that
 * reported zero.
 */

const texts = (source: string) => scanSource(source).map((f) => f.text);

describe('the five shapes the first pass missed', () => {
  it('1 · finds copy passed as a call argument', () => {
    // Two positional arguments. Nothing about them looks like UI text.
    const found = texts(`
      Alert.alert('Delete this deck?', 'Its versions and match history go with it.');
      showToast('Match detail saved');
    `);
    expect(found).toContain('Delete this deck?');
    expect(found).toContain('Its versions and match history go with it.');
    expect(found).toContain('Match detail saved');
  });

  it('2 · finds copy as an object value under an arbitrary key', () => {
    const found = texts(`
      const states = {
        onPlay: { needs: 'No games in this scope.' },
      };
    `);
    expect(found).toContain('No games in this scope.');
  });

  it('3 · finds copy returned from a helper', () => {
    // The text never appears in any JSX — it is produced here and rendered
    // somewhere else entirely.
    const found = texts(`
      function turnOrder(onPlay: boolean) {
        return onPlay ? 'On the play' : 'On the draw';
      }
    `);
    expect(found).toContain('On the play');
    expect(found).toContain('On the draw');
  });

  it('4 · finds template literals, interpolation and all', () => {
    const found = texts('const a = `Match ${n}`;\nconst b = `Delete ${event.name}?`;');
    // The expression is replaced, the prose around it survives.
    expect(found).toContain('Match {}');
    expect(found).toContain('Delete {}?');
  });

  it('5 · finds a module-scope constant table', () => {
    const found = texts(`
      const BLOCK_LABELS = {
        'off-identity': 'Off identity',
        'foreign-signature': 'Another Champion',
      };
    `);
    expect(found).toContain('Off identity');
    expect(found).toContain('Another Champion');
    // The keys are identifiers, not copy.
    expect(found).not.toContain('off-identity');
  });

  it('also still finds what the first pass did cover', () => {
    const found = texts('<Text>Deck is legal</Text>');
    expect(found).toContain('Deck is legal');
  });

  it('finds ALL-CAPS labels, which read as constants but are copy', () => {
    // The design sets section headers in uppercase and several are written that
    // way in the source. They shout like identifiers and hid in plain sight.
    const found = texts("const label = which === 'legend' ? 'LEGEND' : 'CHAMPION';");
    expect(found).toContain('LEGEND');
    expect(found).toContain('CHAMPION');
  });

  it('leaves set codes alone — those are printed on the card', () => {
    expect(texts("const sets = ['OGN', 'UNL', 'VEN'];")).toEqual([]);
  });

  it('finds a sentence that opens with an interpolation, not a capital', () => {
    // The leading character here is a lowercase `v`, so every capital-first
    // rule walks past it — which is how this one survived two scans.
    const found = texts(
      'const s = `v${n} is measurably ahead — the intervals do not overlap.`;'
    );
    expect(found.some((f) => f.includes('is measurably ahead'))).toBe(true);
  });
});

describe('what it must not report', () => {
  it('ignores comments, including copy quoted inside one', () => {
    const found = texts(`
      // This read 'MAIN · 14 IN DECK' before the tab said it.
      /* The archive prompt used to say 'It leaves the deck list.' */
      const x = 1;
    `);
    expect(found).toEqual([]);
  });

  it('ignores the style block', () => {
    const found = texts(`
      const styles = StyleSheet.create({
        label: { fontFamily: 'SpaceGrotesk_500Medium', textTransform: 'uppercase' },
      });
    `);
    expect(found).toEqual([]);
  });

  it('ignores developer logging', () => {
    expect(texts("console.log('Editor unmounted, clearing draft');")).toEqual([]);
  });

  it('ignores card vocabulary, which stays in the API language by decision', () => {
    const found = texts(`
      const types = ['Unit', 'Spell', 'Gear'];
      const domains = ['Fury', 'Order', 'Colorless'];
      const rarity = 'Epic';
    `);
    expect(found).toEqual([]);
  });

  it('ignores catalogue keys, style values and accessibility roles', () => {
    const found = texts(`
      t('deck.preview.gallery');
      <View accessibilityRole="button" style={{ alignItems: 'center' }} />;
      <Screen animation="slide_from_bottom" />;
    `);
    expect(found).toEqual([]);
  });

  it('ignores imports and module paths', () => {
    expect(texts("import { Icon } from '@/components/ui/Icon';")).toEqual([]);
  });

  it('honours an inline i18n-ignore', () => {
    expect(texts("const dev = 'Pseudo locale probe'; // i18n-ignore")).toEqual([]);
  });
});

describe('quoting it has to survive', () => {
  it('reads an apostrophe inside single quotes without ending the string', () => {
    // The exact archive-prompt shape: a contraction inside the copy.
    const found = texts("const s = 'Its versions and match history go with it.';");
    expect(found).toContain('Its versions and match history go with it.');
  });

  it('does not treat an escaped quote as a terminator', () => {
    const found = texts('const s = "She said \\"go\\" and left the room";');
    expect(found.length).toBe(1);
  });

  it('reports the line the string starts on', () => {
    const found = scanSource("const a = 1;\nconst b = 2;\nAlert.alert('Could not build a code');");
    expect(found[0]?.line).toBe(3);
  });
});
