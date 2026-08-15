import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { useT } from '@/i18n';
import { color } from '@/theme/tokens';

/**
 * List or gallery — one control, one definition.
 *
 * The same choice was drawn three different ways: the deck overview spelled out
 * "List" and "Gallery" in a bordered pill, while the editor and the deck
 * preview used `☰` and `▦` in an inset track. Two problems, and the second is
 * the one that mattered.
 *
 * The words and the glyphs disagreed about what kind of control this is. And
 * neither `☰` (U+2630) nor `▦` (U+25A6) exists in Space Grotesk or JetBrains
 * Mono, so both were being drawn by whatever the OS substituted — a different
 * typeface at a different weight, and a different one on Android than on iOS.
 * They were never part of the icon set; they only looked like they were.
 *
 * The inset-track form wins on a vote of two to one, and because a segmented
 * control that shows its unselected option as a *track* rather than a border
 * is what the rest of the app uses. Icons win over words because the pair sits
 * beside a search field and a filter, both of which are already icons — and
 * because "Gallery" is `Galerie`/`Galerie` and `Liste`/`Liste` elsewhere, which
 * made the widest control on the row a translation risk for no gain.
 */

export type DeckView = 'list' | 'gallery';

interface ViewToggleProps {
  value: DeckView;
  onChange: (view: DeckView) => void;
  /**
   * 36 rather than 32, for the editor's control row where it sits beside a
   * taller pill. Everywhere else the default lines up with a 32 dp section
   * header.
   */
  large?: boolean;
}

export function ViewToggle({ value, onChange, large = false }: ViewToggleProps) {
  const t = useT();

  return (
    <View style={styles.track}>
      {(['list', 'gallery'] as const).map((view) => {
        const on = value === view;
        return (
          <Pressable
            key={view}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={
              view === 'list' ? t('deck.preview.list.a11y') : t('deck.preview.gallery.a11y')
            }
            onPress={() => onChange(view)}
            style={[styles.option, large && styles.optionLarge, on && styles.optionOn]}
          >
            <Icon
              name={view}
              size={16}
              // `onAccent` on the selected cell, matching every other segmented
              // control in the app — the icon is the label here.
              color={on ? color.onAccent : color.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  option: {
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  optionLarge: { height: 36, paddingHorizontal: 13 },
  optionOn: { backgroundColor: color.accent },
});
