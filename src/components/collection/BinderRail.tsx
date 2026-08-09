import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { Pressable } from '@/components/ui/Pressable';
import type { Binder } from '@/db/queries/collection';
import { domainColor, isDomain } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The binders, across the top of the Collection tab.
 *
 * Selecting one is what turns browsing into managing: with a binder active the
 * grid gains quantity controls and every tap puts a card somewhere specific.
 * "All" is the resting state and shows what you own across every binder,
 * because the question "do I have this?" is asked far more often than "which
 * box is it in?".
 *
 * A rail rather than a list, and always visible rather than behind a tab,
 * because it is the control that decides what the rest of the screen means.
 */

interface BinderRailProps {
  binders: Binder[];
  /** Null is "All binders". */
  selectedId: string | null;
  onSelect: (binderId: string | null) => void;
  /** Long-press an active binder to edit it; the plus creates one. */
  onEdit: (binder: Binder) => void;
  onCreate: () => void;
}

export function BinderRail({
  binders,
  selectedId,
  onSelect,
  onEdit,
  onCreate,
}: BinderRailProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {binders.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === null }}
          onPress={() => onSelect(null)}
          style={({ pressed }) => [
            styles.chip,
            selectedId === null && styles.chipOn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.name, selectedId === null && styles.nameOn]}>All</Text>
        </Pressable>
      ) : null}

      {binders.map((binder) => {
        const on = binder.id === selectedId;
        // Narrowed rather than cast: `accent` is a free-text column, so a value
        // that is no longer a domain name simply loses its colour.
        const domain = binder.accent && isDomain(binder.accent) ? binder.accent : null;
        const accent = domain ? domainColor(domain) : null;

        return (
          <Pressable
            key={binder.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${binder.name}, ${binder.totalCards} cards`}
            accessibilityHint="Long press to rename or delete"
            onPress={() => onSelect(on ? null : binder.id)}
            onLongPress={() => onEdit(binder)}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.chip,
              accent ? { borderColor: on ? accent.base : color.border } : null,
              on && (accent ? { backgroundColor: accent.dim } : styles.chipOn),
              pressed && styles.pressed,
            ]}
          >
            {domain && accent ? (
              <DomainGlyph domain={domain} size={12} color={accent.base} />
            ) : null}
            <Text
              style={[
                styles.name,
                on && (accent ? { color: accent.base } : styles.nameOn),
              ]}
              numberOfLines={1}
            >
              {binder.name}
            </Text>
            <Text style={[styles.count, on && !accent && styles.nameOn]}>{binder.totalCards}</Text>
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New binder"
        onPress={onCreate}
        style={({ pressed }) => [styles.chip, styles.add, pressed && styles.pressed]}
      >
        <Text style={styles.addLabel}>{binders.length === 0 ? '+  New binder' : '+'}</Text>
      </Pressable>

      {/* Keeps the rail a fixed height whether or not any binder exists. */}
      <View style={styles.tail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    height: 34,
    maxWidth: 190,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.text, borderColor: color.text },
  name: { ...text.smallMedium, color: color.textSecondary, flexShrink: 1 },
  nameOn: { color: color.bg },
  count: { ...text.microMeta, color: color.textMuted },
  add: { borderStyle: 'dashed' },
  addLabel: { ...text.smallMedium, color: color.textSecondary },
  tail: { width: space[2] },
  pressed: { opacity: 0.75 },
});
