import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { BinderTile } from '@/components/collection/BinderTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { queryCards, type CardSort } from '@/db/queries/cards';
import {
  adjustCardQuantity,
  binderQuantities,
  deleteBinder,
  listBinders,
  missingFromLibrary,
  ownedFinishes,
  renameBinder,
  setCompletion,
  type FinishCounts,
} from '@/db/queries/collection';
import type { CardRow } from '@/db/schema/cards';
import { useCardFilters } from '@/features/cards/useCardFilters';
import { useCardSync } from '@/features/sync/useCardSync';
import { useT, type Key } from '@/i18n';
import { finishLabel, finishesFor, supportsFinish, type Finish } from '@/lib/finishes';
import { localeNumber } from '@/lib/format';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * A binder, or the library itself.
 *
 * `/binder/gallery` is the whole card library — a reference you skim, with no
 * binder to file into. Every other id is a binder, and the difference is
 * whether a tile has a `− count +` row under it.
 *
 * Ownership lives in binders, never in the library, so the Gallery route is
 * deliberately read-only rather than filing into a hidden default. A number you
 * can change needs somewhere for the change to live.
 */

const COLUMNS = 3;
const GAP = space[4];
const BODY_PAD = space[4];

/**
 * Half the gutter, carried by every cell on both sides.
 *
 * The grid used to give each cell a `paddingRight` on all but the last column
 * and compute the tile width from a *different* formula. The two disagreed:
 * FlashList hands each column `(W − 2·BODY_PAD) / COLUMNS`, the padding took
 * `GAP` off the first two, and the tile was sized `(W − 2·BODY_PAD − 2·GAP) /
 * COLUMNS` — which is `GAP/3` **wider than the box holding it**. Every tile but
 * the last in a row overflowed into the gutter while the last column carried
 * `2·GAP/3` of dead space, so the cards read as slightly too big and squeezed
 * together, which is exactly how it was reported.
 *
 * Uniform half-gutters make every column identical by construction, and the
 * grid's own padding is pulled in by the same half so the outer edges still
 * land on `BODY_PAD`. There is no longer a "last column" case to keep in step
 * with `COLUMNS`.
 */
const HALF_GAP = GAP / 2;

const SORTS = [
  { value: 'name', label: 'binder.sort.name' },
  { value: 'collector', label: 'binder.sort.collector' },
  { value: 'energy', label: 'binder.sort.energy' },
  { value: 'rarity', label: 'binder.sort.rarity' },
] as const satisfies readonly { value: CardSort; label: Key }[];

type Field = 'set' | 'sort' | null;

export default function BinderScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  /* 'gallery' is the whole library rather than a binder, so the list can link
     to it without inventing a row in the database for it. */
  const binderId = id === 'gallery' ? null : (id ?? null);

  const { width } = useWindowDimensions();
  const { cardCount, isSyncing } = useCardSync();
  const filters = useCardFilters();

  const [held, setHeld] = useState<Map<string, FinishCounts>>(new Map());
  const [owned, setOwned] = useState<Map<string, FinishCounts>>(new Map());
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState<Field>(null);
  /**
   * Whether the filter block is showing.
   *
   * Closed by default: the grid is what this screen is for, and three rows of
   * controls above it were costing a card and a half of the fold.
   */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<CardRow | null>(null);
  /*
   * `name` is edited in place — there is no separate draft.
   *
   * There was one, because `name` fed the header title and typing into it would
   * have rewritten the title under the user's finger. The header no longer shows
   * the name; the field below does. So the reason for a draft went with it, and
   * keeping one only left two states that could disagree — which they did: the
   * draft was seeded when the old Edit button opened its sheet, and with that
   * button gone nothing seeded it, so the field showed its placeholder over a
   * binder that had a perfectly good name.
   *
   * `load()` re-reads this from the database, and only ever runs on focus or
   * after a card is filed. Both require leaving the field first, so the blur
   * write has already landed by the time it reads.
   */
  /** So tapping anywhere in the name field — including the pencil — focuses it. */
  const nameField = useRef<TextInput>(null);

  const load = useCallback(() => {
    setOwned(ownedFinishes());
    if (binderId) {
      setHeld(binderQuantities(binderId));
      setName(listBinders().find((b) => b.id === binderId)?.name ?? null);
    }
  }, [binderId]);

  useFocusEffect(load);

  // cardCount is the resync signal, not a value read here: a new set arrives
  // with new cards and nothing else tells this it changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sets = useMemo(() => setCompletion(), [cardCount]);

  const query = useMemo(
    () => filters.toQuery(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.search,
      filters.sets,
      filters.types,
      filters.domains,
      filters.rarities,
      filters.energy,
      filters.hideAlternateArt,
      filters.sort,
      cardCount,
    ]
  );

  const cards = useMemo(() => queryCards(query), [query]);

  /**
   * Cards filed here that the library can no longer draw.
   *
   * `cardCount` is the resync signal, not a value this reads: a sync brings new
   * cards in, and some of what was missing stops being missing. Nothing else
   * tells this that the library changed — hence the disable, which sits on the
   * dependency array it is about rather than on the declaration above it.
   */
  const missing = useMemo(
    () => (binderId ? missingFromLibrary(binderId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [binderId, cardCount]
  );

  // The column FlashList actually hands out, less this cell's own gutters —
  // one derivation, so the tile cannot be wider than the box holding it.
  const cellWidth = (width - (BODY_PAD - HALF_GAP) * 2) / COLUMNS - GAP;

  const adjust = (card: CardRow, delta: number, finish: Finish = 'standard') => {
    if (!binderId) return;
    // A foil-only printing takes its foil row instead — a plus that silently
    // did nothing would read as a broken button.
    const target = supportsFinish(card, finish) ? finish : finishesFor(card)[0]!;
    adjustCardQuantity(binderId, card, delta, target);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  /**
   * Write the name, on blur.
   *
   * The comparison is against what is **stored**, not against `name` — the
   * field owns `name` now, so `trimmed !== name` would be comparing the value
   * to itself and never writing. Reading the row back is one indexed lookup and
   * is the only thing that can answer "did this actually change".
   *
   * `renameBinder` already falls back to "Binder" on a blank name, so an emptied
   * field cannot leave a nameless row — but leaving without a change should not
   * spend a write either.
   */
  const onRename = () => {
    if (!binderId) return;
    const trimmed = (name ?? '').trim();
    const stored = listBinders().find((b) => b.id === binderId)?.name ?? null;
    if (trimmed && trimmed !== stored) renameBinder(binderId, trimmed);
    load();
  };

  const onDelete = () => {
    if (!binderId) return;
    const copies = [...held.values()].reduce((sum, counts) => sum + counts.total, 0);

    Alert.alert(
      t('binder.deleteTitle', { name: name ?? t('binder.deleteThis') }),
      copies === 0
        ? t('binder.deleteEmpty')
        : copies === 1
          ? t('binder.deleteBodyOne')
          : t('binder.deleteBody', { count: copies }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteBinder(binderId);
            router.back();
          },
        },
      ]
    );
  };

  const setLabel =
    filters.sets.length === 0
      ? t('binder.setAll')
      : filters.sets.length === 1
        ? (sets.find((s) => s.setId === filters.sets[0])?.label ?? filters.sets[0]!)
        : t('binder.nSets', { count: filters.sets.length });

  const sortKey = SORTS.find((s) => s.value === filters.sort)?.label ?? SORTS[0]!.label;
  /**
   * How many filters are narrowing the grid right now.
   *
   * Search is deliberately **not** counted: it is the one filter still visible
   * when the block is closed, so badging it would be reporting a thing the user
   * can already read. Sort is not counted either — it reorders, it does not hide.
   */
  const activeFilters = filters.sets.length + filters.domains.length;

  const detailCounts = detail ? held.get(detail.id) : undefined;

  return (
    <Screen
      title={binderId ? t('binder.fallbackName') : t('collection.gallery')}
      meta={metaLine(
        t('binder.shown', { count: localeNumber(cards.length) }),
        binderId ? null : t('binder.inLibrary', { count: localeNumber(cardCount) }),
        isSyncing ? t('binder.syncing') : null
      )}
    >
      <View style={styles.controls}>
        {/*
          The name, as a field, where the deck editor puts its own.

          It was a header title plus an **Edit** button that opened a sheet to
          change one line of text — three taps and a modal to rename a thing
          whose name was already on screen. Typing into it directly is one.

          **Inside `controls`**, so the horizontal inset comes from one place.
          Sitting outside, it took the `Screen`'s 16pt body padding while
          everything below took that *plus* this row's own 16 — so the name field
          ran 16pt wider on each side than the search box under it.

          Only a real binder has one. `/binder/gallery` is the card library
          rendered through this screen: there is no row behind it to rename and
          nothing to delete, and `binderId` is null for exactly that reason.
          Gating on it rather than on a separate flag means the guard cannot
          drift from the thing it guards — every write below already refuses when
          it is null.
        */}
        {binderId ? (
          <Pressable
            accessibilityRole="none"
            onPress={() => nameField.current?.focus()}
            style={styles.nameField}
          >
            <TextInput
              ref={nameField}
              value={name ?? ''}
              onChangeText={setName}
              // Written on blur, not per keystroke: the same arrangement the
              // game screen's note field uses, so a rename costs one write
              // rather than one per character.
              onBlur={onRename}
              placeholder={t('binder.namePlaceholder')}
              placeholderTextColor={color.textFaint}
              style={styles.nameInput}
              returnKeyType="done"
              accessibilityLabel={t('binder.rename.a11y')}
            />
            <Icon name="pencil" size={15} color={color.textMuted} />
          </Pressable>
        ) : null}

        {/*
          Search, with the filters folded into it.

          Set, Sort and the six domains used to sit permanently under the search
          box — three rows of controls above a grid whose whole job is showing
          cards. They are now behind the toggle on the right of the field.

          **The toggle counts what is on.** A filter you cannot see is a filter
          you forget, and a silently shortened list reads as a missing card
          rather than as a filter doing its job. Collapsed with two filters
          active the icon is coral and says `2`, so the grid is never quietly
          narrowed by something off screen.
        */}
        <View style={styles.search}>
          {/* Was `⌕` (U+2315), which no bundled font contains — the OS drew it
              from whatever it had. The icon set has always had a search glyph. */}
          <Icon name="search" size={15} color={color.textFaint} />
          <TextInput
            value={filters.search}
            onChangeText={filters.setSearch}
            placeholder={t('binder.search')}
            placeholderTextColor={color.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('binder.searchLibrary')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersOpen }}
            accessibilityLabel={t('filters.title')}
            accessibilityHint={
              activeFilters > 0
                ? t('binder.filtersActive', { count: activeFilters })
                : undefined
            }
            onPress={() => setFiltersOpen((open) => !open)}
            style={({ pressed }) => [
              styles.filterToggle,
              (filtersOpen || activeFilters > 0) && styles.filterToggleOn,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="filter"
              size={16}
              color={filtersOpen || activeFilters > 0 ? color.accent : color.textMuted}
            />
            {activeFilters > 0 ? <Text style={styles.filterCount}>{activeFilters}</Text> : null}
          </Pressable>
        </View>

        {filtersOpen ? (
          <>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <SelectField
                  compact
                  placeholder={t('binder.set')}
                  value={t('binder.setValue', { value: setLabel })}
                  open={open === 'set'}
                  onToggle={() => setOpen((f) => (f === 'set' ? null : 'set'))}
                >
                  <OptionRow
                    label={t('binder.allSets')}
                    selected={filters.sets.length === 0}
                    onPress={() => {
                      // Clearing is a toggle of everything currently on, so the
                      // store stays the single source of what is filtered.
                      filters.sets.forEach((s) => filters.toggle('sets', s));
                      setOpen(null);
                    }}
                  />
                  {sets.map((set) => (
                    <OptionRow
                      key={set.setId}
                      label={set.label}
                      meta={`${set.total}`}
                      selected={filters.sets.includes(set.setId)}
                      onPress={() => filters.toggle('sets', set.setId)}
                    />
                  ))}
                </SelectField>
              </View>

              <View style={styles.field}>
                <SelectField
                  compact
                  placeholder={t('binder.sort')}
                  value={t('binder.sortValue', { value: t(sortKey) })}
                  open={open === 'sort'}
                  onToggle={() => setOpen((f) => (f === 'sort' ? null : 'sort'))}
                >
                  {SORTS.map((sort) => (
                    <OptionRow
                      key={sort.value}
                      label={t(sort.label)}
                      selected={filters.sort === sort.value}
                      onPress={() => {
                        filters.setSort(sort.value);
                        setOpen(null);
                      }}
                    />
                  ))}
                </SelectField>
              </View>
            </View>

            <View style={styles.domains}>
              {PLAYABLE_DOMAINS.map((domain) => {
                const on = filters.domains.includes(domain);
                return (
                  <Pressable
                    key={domain}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={domain}
                    onPress={() => filters.toggle('domains', domain)}
                    style={({ pressed }) => [
                      styles.domain,
                      on && {
                        backgroundColor: domainColor(domain).base,
                        borderColor: domainColor(domain).base,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    {/*
                  The mark, not the word.

                  These were seven name chips wrapping onto two rows — `Fury`,
                  `Calm`, `Mind`… — a lot of width spent on a vocabulary the
                  cards themselves state with a symbol. Now that the real domain
                  marks are in the app, the filter can show the same thing the
                  player is looking at on the card.

                  The domain name stays as the accessibility label, and colour
                  still never carries meaning alone: a selected chip fills *and*
                  inverts its glyph, so the state survives greyscale.
                */}
                    <DomainGlyph
                      domain={domain}
                      size={18}
                      color={on ? color.bg : domainColor(domain).base}
                    />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.hint} numberOfLines={2}>
          {binderId ? t('binder.hint') : t('binder.hintGallery')}
        </Text>
      </View>

      <FlashList
        data={cards}
        numColumns={COLUMNS}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title={isSyncing ? t('binder.stillDownloading') : t('binder.nothingMatches')}
            body={
              isSyncing ? t('binder.stillDownloading.body') : t('binder.nothingMatches.body')
            }
          />
        }
        ListFooterComponent={
          <>
            {missing.length > 0 ? (
              <View style={styles.missing}>
                <SectionLabel>{t('binder.notInLibrary')}</SectionLabel>
                {/* Owned, counted, and unrenderable — named so the copy count
                    above cannot look wrong. */}
                {missing.map((row) => (
                  <Text key={row.name} style={styles.missingRow}>
                    {row.quantity}× {row.name}
                  </Text>
                ))}
              </View>
            ) : null}

            {/*
              Deleting a binder, at the end of the scroll.

              It lived in the sheet the **Edit** button opened, and that button
              is gone — the name it existed to change is now a field at the top
              of the screen. Delete had to go somewhere rather than with it: a
              binder you can create and never remove is a one-way door.

              The end of the list is where the deck screen puts its own destroy
              action, and it is the right distance from everything else — you
              arrive here by scrolling past every card you filed, which is the
              review this decision deserves.
            */}
            {binderId ? (
              <View style={styles.dangerZone}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onDelete}
                  style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                >
                  <Text style={styles.deleteLabel}>{t('binder.delete')}</Text>
                </Pressable>
                <Text style={styles.deleteHint}>{t('binder.delete.body')}</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          // In a binder, what is filed here. In the Gallery, what you own
          // anywhere — the same question asked of a different scope.
          const counts = binderId ? held.get(item.id) : owned.get(item.id);
          return (
            <View style={styles.cell}>
              <BinderTile
                card={item}
                width={cellWidth}
                count={counts?.total ?? 0}
                foiled={(counts?.foil ?? 0) > 0}
                /*
                 * Dimmed only while filing.
                 *
                 * Browsing the library is a reference you skim, and greying out
                 * most of 1,451 cards makes it harder to read — which is why
                 * the dimming was removed. Filing is the opposite job: "what is
                 * still at zero" is the whole question, and a count badge that
                 * is simply absent is not a signal you can scan a page for.
                 * So the treatment comes back, scoped to the binder.
                 */
                dimmed={binderId !== null && (counts?.total ?? 0) === 0}
                onOpen={(card) =>
                  binderId ? setDetail(card) : router.push(`/card/${card.id}`)
                }
              />
            </View>
          );
        }}
      />

      {/*
        The split, where the two numbers can be told apart.
        *
        The tile shows one total because that is what "how many do I have" means
        at a glance. Which of them are foil is a different question, and it gets
        its own surface rather than a toggle that silently changes what every
        plus on the screen does.
      */}
      <Sheet
        visible={detail !== null}
        title={detail?.name ?? ''}
        subtitle={
          detail
            ? metaLine(
                detail.setId,
                detail.rarity,
                t('binder.inThisBinder', { count: detailCounts?.total ?? 0 })
              )
            : undefined
        }
        onClose={() => setDetail(null)}
        actions={
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetail(null)}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneLabel}>{t('action.done')}</Text>
          </Pressable>
        }
      >
        {detail
          ? (['standard', 'foil'] as Finish[]).map((finish) => {
              const printed = supportsFinish(detail, finish);
              const n = detailCounts?.[finish] ?? 0;
              return (
                <View key={finish} style={styles.finishRow}>
                  <View style={styles.finishText}>
                    <Text style={styles.finishName}>{finishLabel(finish)}</Text>
                    <Text style={styles.finishNote}>
                      {printed
                        ? finish === 'foil'
                          ? t('binder.finish.sameTotal')
                          : t('binder.finish.regular')
                        : t('binder.finish.notPrinted')}
                    </Text>
                  </View>

                  <View style={styles.finishStepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('binder.finish.remove', {
                        finish: finishLabel(finish),
                      })}
                      disabled={!printed || n === 0}
                      onPress={() => adjust(detail, -1, finish)}
                      style={({ pressed }) => [
                        styles.finishStep,
                        (!printed || n === 0) && styles.finishStepOff,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.stepGlyph}>−</Text>
                    </Pressable>
                    <Text style={styles.finishCount}>{printed ? n : '—'}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('binder.finish.add', {
                        finish: finishLabel(finish),
                      })}
                      disabled={!printed}
                      onPress={() => adjust(detail, 1, finish)}
                      style={({ pressed }) => [
                        styles.finishStep,
                        !printed && styles.finishStepOff,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.stepGlyph}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          : null}
      </Sheet>

      {/*
        The rename-and-delete sheet lived here.

        A binder is a name and nothing else, so a modal to change one line of
        text was three taps and a scrim for a single field. The name is a field
        at the top of the screen now, written on blur; delete moved to the end
        of the list, where the deck screen puts its own.
      */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /**
   * The binder's name, as a field.
   *
   * `SelectField`'s geometry — 52 high, `radius.lg`, 6 % fill, 14 % border —
   * the same shape the deck editor's name field uses, so the two screens ask
   * for a name the same way.
   */
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    // 4 on top of the row's own 8 gap, so the name reads as its own thing
    // rather than as the first filter.
    marginBottom: space[1],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  /** Sits at the end of the grid, well past everything else. */
  dangerZone: { paddingTop: space[8], gap: space[1] },

  /**
   * Bare text. The **field** draws the box.
   *
   * This style was the old rename sheet's, where the input *was* the control and
   * carried its own height, padding, radius, fill and border. Reused inside
   * `nameField` — which has all five — it drew a second box inside the first,
   * so the name sat in a rounded well inside a rounded well.
   */
  nameInput: { ...text.body, color: color.text, flex: 1, padding: 0 },
  delete: { minHeight: 44, justifyContent: 'center', marginTop: space[5] },
  deleteLabel: { ...text.bodyMedium, color: color.danger },
  // Prose, so `caption` — not the 9.5px uppercase micro face the palette
  // reserves for decoration. The same mistake the empty Battlefield state made.
  deleteHint: { ...text.caption, color: color.textMuted, paddingTop: space[1] },

  controls: { paddingHorizontal: BODY_PAD, paddingBottom: space[3], gap: space[2] },

  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: space[3],
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { ...text.small, color: color.text, flex: 1, padding: 0 },
  /** The filter toggle, inside the search field's own box. */
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  filterToggleOn: { backgroundColor: color.accentSoft },
  filterCount: { ...text.numeric, fontSize: 11, color: color.accent },

  fieldRow: { flexDirection: 'row', gap: space[2], zIndex: 2 },
  field: { flex: 1 },

  domains: { flexDirection: 'row', gap: 4 },
  domain: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pressed: { opacity: 0.7 },

  hint: { ...text.microMeta, fontSize: 10.5, color: color.textFaint },

  grid: { paddingHorizontal: BODY_PAD - HALF_GAP, paddingBottom: space[16] },
  cell: { paddingHorizontal: HALF_GAP, paddingBottom: space[4] },

  missing: { gap: space[1], paddingTop: space[4] },
  missingRow: { ...text.microMeta, color: color.textMuted },

  finishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  finishText: { flex: 1 },
  finishName: { ...text.smallMedium, color: color.text },
  finishNote: { ...text.caption, fontSize: 10.5, color: color.textFaint },
  finishStepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  finishStep: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  finishStepOff: { opacity: 0.35 },
  stepGlyph: { ...text.body, fontSize: 18, color: color.text },
  finishCount: {
    ...text.numeric,
    fontSize: 14,
    color: color.text,
    width: 26,
    textAlign: 'center',
  },

  done: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { ...text.bodyMedium, color: color.onAccent },
});
