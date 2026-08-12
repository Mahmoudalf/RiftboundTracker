import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The design's form vocabulary.
 *
 * Every screen in the Hi-Fi spec is assembled from four shapes, and the app had
 * none of them — which is why a recolour alone left everything still looking
 * like the old app. They live here so a screen is composed rather than
 * hand-styled, and so the next screen inherits the language for free.
 *
 * - `SectionLabel` — mono, uppercase, tracked. The spec's `THE MATCHUP`.
 * - `SelectField` — a 52px translucent row with a chevron that opens **in
 *   place**. The app used modal pickers; the design expands inline, so the
 *   answer lands next to the question instead of over it.
 * - `OptionRow` — a 46px choice inside an open field.
 * - `ChoiceRow` — equal-width chips for two to four short options.
 */

function Chevron({ open }: { open: boolean }) {
  return (
    <Svg width={12} height={8} viewBox="0 0 12 8" fill="none">
      <Path
        d={open ? 'M1 6.5L6 1.5L11 6.5' : 'M1 1.5L6 6.5L11 1.5'}
        stroke={color.textMuted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface SelectFieldProps {
  /** Shown when nothing is chosen — never a fake value. */
  placeholder: string;
  value: string | null;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** 46px rather than 52 — the height the design uses inside a card. */
  compact?: boolean;
  /** The option rows, rendered only while open. */
  children?: ReactNode;
}

export function SelectField({
  placeholder,
  value,
  open,
  onToggle,
  disabled = false,
  compact = false,
  children,
}: SelectFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={`${placeholder}: ${value ?? 'not recorded'}`}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.field,
          compact && styles.fieldCompact,
          disabled && styles.fieldDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Chevron open={open} />
      </Pressable>

      {open && children ? <View style={styles.options}>{children}</View> : null}
    </View>
  );
}

interface OptionRowProps {
  label: string;
  meta?: string | null;
  selected: boolean;
  onPress: () => void;
}

export function OptionRow({ label, meta, selected, onPress }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelOn]} numberOfLines={1}>
        {label}
      </Text>
      {meta ? (
        <Text style={[styles.optionMeta, selected && styles.optionLabelOn]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

interface ChoiceRowProps<T> {
  options: { key: string; label: string; value: T }[];
  value: T;
  onSelect: (value: T) => void;
  /** Taller cells for the primary answers — `BEST OF`, `WHO WON?`. */
  tall?: boolean;
}

export function ChoiceRow<T>({ options, value, onSelect, tall = false }: ChoiceRowProps<T>) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.choice,
              tall && styles.choiceTall,
              on && styles.choiceOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.choiceLabel, on && styles.choiceLabelOn]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/*
 * `NumberRow` lived here — a wrapping row of fixed-width numeric chips.
 *
 * Built for the Champion landing turn, inherited by the score, and outlived by
 * both: the turn went with migration 19 and the score became the design's pair
 * of dropdowns. An exported component with no consumer is what gap 15 named,
 * so it is deleted rather than kept warm for a third caller that may never come.
 */

const styles = StyleSheet.create({
  sectionLabel: {
    ...text.microMeta,
    color: color.textFaint,
    /*
     * No bottom padding.
     *
     * Every caller puts this at the head of a container with `gap: space[2]`,
     * so a padding here was added to that gap rather than instead of it: the
     * design draws 8–10px between a section label and what it labels, and this
     * was rendering 16 on every screen that uses one. The gap is the caller's
     * to own; the label only asks for a little air above it.
     */
    paddingTop: space[1],
  },

  fieldGroup: { gap: space[2] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    // Translucent rather than a flat surface, so a field reads the same over the
    // shell and over a card.
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  // radius.md rather than the design's 10, to sit flush with the ChoiceRow
  // directly above it in a game card.
  fieldCompact: { height: 46, borderRadius: radius.md, paddingHorizontal: space[3] },
  fieldDisabled: { opacity: 0.45 },
  fieldValue: { ...text.body, color: color.text, flexShrink: 1 },
  fieldPlaceholder: { ...text.body, color: color.textMuted, flexShrink: 1 },

  options: {
    gap: space[2],
    padding: space[2],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  option: {
    minHeight: 46,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space[3],
    borderRadius: 9,
    borderWidth: 1,
    borderColor: color.border,
  },
  optionOn: { backgroundColor: color.accent, borderColor: color.accent },
  optionLabel: { ...text.smallMedium, color: color.textDim },
  optionLabelOn: { color: color.onAccent },
  optionMeta: { ...text.microMeta, color: color.textFaint },

  choiceRow: { flexDirection: 'row', gap: space[2] },
  choice: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  choiceTall: { height: 52, borderRadius: radius.lg },
  choiceOn: { backgroundColor: color.accent, borderColor: color.accent },
  // The design's own value for an unselected segment: a step below
  // `textSecondary`, so the chosen option is the one that reads as chosen.
  choiceLabel: { ...text.smallMedium, color: color.textDim },
  choiceLabelOn: { color: color.onAccent },

  pressed: { opacity: 0.75 },
});
