import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { color, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The final score of one match, as the design draws it.
 *
 * Two equal columns — You and Them — each a 46px field with a chevron that
 * **opens in place**. Not two rows of 0–8 chips, which is what shipped first
 * and is a different control: eighteen targets in the middle of a form, for a
 * question with one answer per side.
 *
 * The little "You" / "Them" labels are sentence case at `textMuted`, per the
 * design, rather than the mono uppercase `fieldLabel` used elsewhere on this
 * card. They name a column inside a field, not a section.
 */

/** Riftbound scores to 8, so 0–8 is the whole range a match can end on. */
const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export interface ScoreRowProps {
  scoreFor: number | null;
  scoreAgainst: number | null;
  onChange: (next: { scoreFor?: number | null; scoreAgainst?: number | null }) => void;
}

export function ScoreRow({ scoreFor, scoreAgainst, onChange }: ScoreRowProps) {
  /*
   * One open field at a time.
   *
   * Both expand in place, so leaving the other open would push the second
   * column's list down past the first's and stack two scrolls of numbers in a
   * form that is already long.
   */
  const [open, setOpen] = useState<'you' | 'them' | null>(null);

  const column = (
    side: 'you' | 'them',
    label: string,
    value: number | null,
    onSelect: (next: number | null) => void
  ) => (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <SelectField
        compact
        placeholder="Not set"
        value={value === null ? null : String(value)}
        open={open === side}
        onToggle={() => setOpen((current) => (current === side ? null : side))}
      >
        {SCORES.map((n) => (
          <OptionRow
            key={n}
            label={String(n)}
            selected={value === n}
            onPress={() => {
              // Re-tapping the current value clears it, so "I do not remember"
              // stays reachable without a separate — option.
              onSelect(value === n ? null : n);
              setOpen(null);
            }}
          />
        ))}
      </SelectField>
    </View>
  );

  return (
    <View style={styles.block}>
      <SectionLabel>Score</SectionLabel>
      <View style={styles.row}>
        {column('you', 'You', scoreFor, (next) => onChange({ scoreFor: next }))}
        {column('them', 'Them', scoreAgainst, (next) => onChange({ scoreAgainst: next }))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  // `flex-start` above and `flex: 1` here: an open column grows downward on its
  // own rather than stretching the closed one to match it.
  column: { flex: 1, gap: space[1.5] },
  label: { ...text.caption, fontSize: 9.5, lineHeight: 13, color: color.textMuted },
});
