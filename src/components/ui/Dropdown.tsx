import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A select, for choosing one of a list that is too long to spend a chip rail on.
 *
 * Chips are better when there are three or four options and the choice is worth
 * showing at rest. A deck list is neither — it grows without bound, and the
 * screen below it is the thing the user came for.
 *
 * Drawn chevron rather than a typed character, for the same reason as the back
 * control: a font fallback should never be able to make a control unreadable.
 */

export interface DropdownOption<T> {
  value: T;
  label: string;
  /** Small trailing text — a record, a count. */
  meta?: string;
}

interface DropdownProps<T> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: T) => void;
}

function Chevron() {
  return (
    <Svg width={12} height={8} viewBox="0 0 12 8" fill="none">
      <Path
        d="M1 1.5L6 6.5L11 1.5"
        stroke={color.textMuted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Dropdown<T extends string | null>({
  label,
  value,
  options,
  open,
  onOpenChange,
  onSelect,
}: DropdownProps<T>) {
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'none'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerLabel} numberOfLines={1}>
          {selected?.label ?? label}
        </Text>
        <Chevron />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => onOpenChange(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => onOpenChange(false)}
          style={styles.scrim}
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetLabel}>{label}</Text>
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={String(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelect(option.value);
                    onOpenChange(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  {option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 40,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  triggerLabel: { ...text.smallMedium, color: color.text, flexShrink: 1 },
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    top: '18%',
    maxHeight: '64%',
    borderRadius: radius.xl,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space[2],
  },
  sheetLabel: {
    ...text.meta,
    color: color.textMuted,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
  },
  list: { paddingHorizontal: space[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: 48,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
  },
  optionActive: { backgroundColor: color.overlay },
  optionLabel: { ...text.body, color: color.textSecondary, flexShrink: 1 },
  optionLabelActive: { color: color.text },
  optionMeta: { ...text.microMeta, color: color.textMuted },
  pressed: { opacity: 0.7 },
});
