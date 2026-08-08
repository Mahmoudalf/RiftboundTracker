import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { Pressable } from '@/components/ui/Pressable';
import { setFacets, type CardSort } from '@/db/queries/cards';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Search, sort and filters for the card pool in the builder.
 *
 * Picking 40 cards out of ~900 by name assumes the player already knows the
 * card they want, which is exactly backwards for anyone still learning the
 * format. Search finds a card you can name; filters find the card you cannot.
 *
 * Three dropdowns rather than chip rails, for one structural reason: this sits
 * in a FlashList header, and any control that changes height as you use it —
 * a panel that expands, a row that wraps, a Clear button that appears — makes
 * the grid below it jump mid-tap. Every state here is the same height, and the
 * options open in a modal over the page instead of pushing it down.
 */

/** `Champion` is a supertype; the rest are types. See `CardFilters`. */
const POOL_KINDS = [
  { key: 'Unit', label: 'Unit', kind: 'type' as const },
  { key: 'Spell', label: 'Spell', kind: 'type' as const },
  { key: 'Gear', label: 'Gear', kind: 'type' as const },
  { key: 'Champion', label: 'Champion', kind: 'supertype' as const },
];

const SORTS: DropdownOption<Extract<CardSort, 'name' | 'energy'>>[] = [
  { value: 'energy', label: 'Energy cost' },
  { value: 'name', label: 'Name' },
];

export interface PoolFilterState {
  search: string;
  sort: Extract<CardSort, 'name' | 'energy'>;
  /** Keys from `POOL_KINDS`. */
  kinds: string[];
  setIds: string[];
}

export const EMPTY_POOL_FILTERS: PoolFilterState = {
  search: '',
  sort: 'energy',
  kinds: [],
  setIds: [],
};

/** Split the mixed kind list back into the two query fields. */
export function poolKindFilters(kinds: readonly string[]) {
  const types = POOL_KINDS.filter((k) => k.kind === 'type' && kinds.includes(k.key)).map(
    (k) => k.key
  );
  const supertypes = POOL_KINDS.filter((k) => k.kind === 'supertype' && kinds.includes(k.key)).map(
    (k) => k.key
  );
  return { types, supertypes };
}

/** Which of the three selects is showing its options. Only ever one. */
type OpenMenu = 'sort' | 'type' | 'set' | null;

interface CardPoolFiltersProps {
  value: PoolFilterState;
  onChange: (next: PoolFilterState) => void;
  /** Shown beside the controls so the effect of a change is visible. */
  resultCount: number;
  placeholder?: string;
  editable?: boolean;
}

export function CardPoolFilters({
  value,
  onChange,
  resultCount,
  placeholder = 'Search cards',
  editable = true,
}: CardPoolFiltersProps) {
  const [menu, setMenu] = useState<OpenMenu>(null);
  const sets = useMemo(() => setFacets(), []);

  /*
   * The code is the label, the name rides along as meta. Three selects share
   * one row, and "Vendetta" truncates where "VEN" does not — but the option
   * list has room to say which set that is, so nobody has to have memorised it.
   */
  const setOptions: DropdownOption<string>[] = useMemo(
    () => sets.map((s) => ({ value: s.setId, label: s.setId, meta: s.label })),
    [sets]
  );
  const kindOptions: DropdownOption<string>[] = POOL_KINDS.map((k) => ({
    value: k.key,
    label: k.label,
  }));

  const filtered = value.kinds.length + value.setIds.length > 0;

  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  return (
    <View style={styles.root}>
      <TextInput
        value={value.search}
        onChangeText={(search) => onChange({ ...value, search })}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        style={styles.search}
        autoCorrect={false}
        editable={editable}
        accessibilityLabel="Search cards"
      />

      <View style={styles.row}>
        <View style={styles.slot}>
          <Dropdown
            label="Sort"
            value={value.sort}
            options={SORTS}
            open={menu === 'sort'}
            onOpenChange={(open) => setMenu(open ? 'sort' : null)}
            onSelect={(sort) => onChange({ ...value, sort })}
          />
        </View>
        <View style={styles.slot}>
          <Dropdown
            multiple
            label="Type"
            values={value.kinds}
            options={kindOptions}
            open={menu === 'type'}
            onOpenChange={(open) => setMenu(open ? 'type' : null)}
            onSelect={(key) => onChange({ ...value, kinds: toggle(value.kinds, key) })}
            onClear={() => onChange({ ...value, kinds: [] })}
          />
        </View>
        <View style={styles.slot}>
          <Dropdown
            multiple
            label="Set"
            values={value.setIds}
            options={setOptions}
            open={menu === 'set'}
            onOpenChange={(open) => setMenu(open ? 'set' : null)}
            onSelect={(id) => onChange({ ...value, setIds: toggle(value.setIds, id) })}
            onClear={() => onChange({ ...value, setIds: [] })}
          />
        </View>
      </View>

      {/*
        Always rendered, even with nothing to clear — this row keeps the header
        a constant height, which is the whole reason the list below stays put.
      */}
      <View style={styles.meta}>
        <Text style={styles.count}>
          {resultCount} {resultCount === 1 ? 'card' : 'cards'}
        </Text>
        {filtered ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ ...value, kinds: [], setIds: [] })}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearLabel}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: space[2] },
  search: {
    ...text.small,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[3],
    minHeight: 40,
    marginBottom: space[2],
  },
  row: { flexDirection: 'row', gap: space[2] },
  slot: { flex: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  count: { ...text.microMeta, color: color.textMuted },
  clear: { justifyContent: 'center', height: 32, paddingLeft: space[3] },
  clearLabel: { ...text.microMeta, color: color.info },
  pressed: { opacity: 0.75 },
});
