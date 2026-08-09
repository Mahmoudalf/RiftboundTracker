import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A select, for choosing from a list that is too long to spend a chip rail on.
 *
 * Chips are better when there are three or four options and the choice is worth
 * showing at rest. A deck list is neither — it grows without bound, and the
 * screen below it is the thing the user came for.
 *
 * `multiple` keeps the sheet open and accumulates a set instead of replacing
 * one. Both modes deliberately render the same fixed-height trigger: these sit
 * in list headers, and a control that changes height as you use it makes the
 * list beneath it jump.
 *
 * Drawn chevron and tick rather than typed characters, for the same reason as
 * the back control: a font fallback should never make a control unreadable.
 */

export interface DropdownOption<T> {
  value: T;
  label: string;
  /** Small trailing text — a record, a count. */
  meta?: string;
}

type DropdownProps<T> = {
  label: string;
  options: DropdownOption<T>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** In `multiple` mode this is a toggle — the caller adds or removes. */
  onSelect: (value: T) => void;
} & (
  | { multiple?: false; value: T }
  | { multiple: true; values: readonly T[]; onClear: () => void }
);

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

function Tick() {
  return (
    <Svg width={14} height={11} viewBox="0 0 14 11" fill="none">
      <Path
        d="M1 5.5L5 9.5L13 1.5"
        stroke={color.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Dropdown<T extends string | null>(props: DropdownProps<T>) {
  const { label, options, open, onOpenChange, onSelect } = props;
  const selected = props.multiple ? props.values : [props.value];

  /*
   * One selection reads better as itself than as "Type · 1" — the whole point
   * of the trigger is to answer "what is filtering this list" without opening
   * anything. Past one, the name of the field plus a count is all that fits.
   */
  const chosen = options.filter((o) => selected.includes(o.value));
  const triggerLabel =
    chosen.length === 1 ? chosen[0]!.label : chosen.length > 1 ? `${label} · ${chosen.length}` : label;
  const active = props.multiple && chosen.length > 0;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen.map((o) => o.label).join(', ') || 'any'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(true)}
        style={({ pressed }) => [
          styles.trigger,
          active && styles.triggerActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.triggerLabel, active && styles.triggerLabelActive]} numberOfLines={1}>
          {triggerLabel}
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
              const isSelected = selected.includes(option.value);
              return (
                <Pressable
                  key={String(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(option.value);
                    if (!props.multiple) onOpenChange(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.optionLabel, isSelected && styles.optionLabelActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  {option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}
                  {props.multiple && isSelected ? <Tick /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {props.multiple ? (
            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                disabled={chosen.length === 0}
                onPress={props.onClear}
                style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
              >
                <Text style={[styles.clearLabel, chosen.length === 0 && styles.disabled]}>
                  Clear
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenChange(false)}
                style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
              >
                <Text style={styles.doneLabel}>Done</Text>
              </Pressable>
            </View>
          ) : null}
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
  triggerActive: { backgroundColor: color.accent, borderColor: color.text },
  triggerLabel: { ...text.smallMedium, color: color.text, flexShrink: 1 },
  triggerLabelActive: { color: color.onAccent },
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: color.borderSubtle,
  },
  footerButton: { minHeight: 44, justifyContent: 'center' },
  clearLabel: { ...text.smallMedium, color: color.textMuted },
  doneLabel: { ...text.smallMedium, color: color.info },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
