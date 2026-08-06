import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { Pressable } from './Pressable';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Accent for the selected state — a domain `base` where relevant. */
  accent?: string;
  /**
   * Leading mark. Carries meaning alongside color, never instead of it, so it
   * takes a rendered node rather than a character — a glyph that fails to
   * render as tofu would take half the meaning with it.
   */
  glyph?: ReactNode;
  /** Trailing count, e.g. the number of cards a filter would match. */
  count?: number;
  disabled?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  accent,
  glyph,
  count,
  disabled = false,
}: ChipProps) {
  const tint = accent ?? color.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={count !== undefined ? `${label}, ${count} cards` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: tint, borderColor: tint },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {glyph ? <View style={styles.glyph}>{glyph}</View> : null}
      <Text style={[styles.label, { color: selected ? color.bg : color.textSecondary }]}>
        {label}
      </Text>
      {count !== undefined ? (
        <View style={[styles.count, selected && styles.countSelected]}>
          <Text style={[styles.countText, { color: selected ? color.bg : color.textFaint }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  label: { ...text.smallMedium },
  count: { paddingHorizontal: space[1] },
  countSelected: {},
  countText: { ...text.microMeta },
});
