import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { Pressable } from '@/components/ui/Pressable';
import { setFacets, type CardSort } from '@/db/queries/cards';
import { useT, type Key } from '@/i18n';
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

const SORT_KEYS = [
  { value: 'energy', label: 'pool.sort.energy' },
  { value: 'name', label: 'pool.sort.name' },
] as const satisfies readonly { value: Extract<CardSort, 'name' | 'energy'>; label: Key }[];

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
  placeholder?: string;
  editable?: boolean;
}

export function CardPoolFilters({
  value,
  onChange,
  placeholder,
  editable = true,
}: CardPoolFiltersProps) {
  const t = useT();
  const [menu, setMenu] = useState<OpenMenu>(null);
  // Translated at render, because `SORT_KEYS` is module scope and would
  // otherwise freeze the language the bundle first started in.
  const sortOptions: DropdownOption<Extract<CardSort, 'name' | 'energy'>>[] = SORT_KEYS.map(
    (s) => ({ value: s.value, label: t(s.label) })
  );
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
        placeholder={placeholder ?? t('pool.search')}
        placeholderTextColor={color.textFaint}
        style={styles.search}
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={t('pool.search')}
      />

      <View style={styles.row}>
        <View style={styles.slot}>
          <Dropdown
            label={t('pool.sort')}
            value={value.sort}
            options={sortOptions}
            open={menu === 'sort'}
            onOpenChange={(open) => setMenu(open ? 'sort' : null)}
            onSelect={(sort) => onChange({ ...value, sort })}
          />
        </View>
        <View style={styles.slot}>
          <Dropdown
            multiple
            label={t('pool.type')}
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
            label={t('pool.set')}
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
        That is now its **only** job, so it must not become conditional.

        It used to lead with "381 cards". That number counts the pool you could
        add from, not anything about the deck you are building, and it changes
        with every keystroke in the search field — a large, restless figure
        answering a question nobody asked. The zone tabs carry the counts that
        matter.
      */}
      <View style={styles.meta}>
        <View style={styles.metaSpacer} />
        {filtered ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ ...value, kinds: [], setIds: [] })}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearLabel}>{t('pool.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * No bottom padding of its own.
   *
   * The `meta` row already reserves 32pt below the selects, so this was 8 more
   * on top of a gap that is empty in every state except "filters applied". Both
   * screens that use this follow it with a card grid and own the spacing before
   * it themselves.
   */
  root: { paddingBottom: 0 },
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
  // Pushes Clear to the right where the count used to end.
  metaSpacer: { flex: 1 },
  clear: { justifyContent: 'center', height: 32, paddingLeft: space[3] },
  clearLabel: { ...text.microMeta, color: color.info },
  pressed: { opacity: 0.75 },
});
