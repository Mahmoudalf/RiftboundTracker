import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { CardGrid } from '@/components/decks/CardGrid';
import {
  CardPoolFilters,
  EMPTY_POOL_FILTERS,
  poolKindFilters,
  type PoolFilterState,
} from '@/components/decks/CardPoolFilters';
import { DeckPreview } from '@/components/decks/DeckPreview';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  listBattlefields,
  listChampionsForLegend,
  listLegends,
  listRunesForIdentity,
  queryCards,
} from '@/db/queries/cards';
import { createDeck } from '@/db/queries/decks';
import type { CardRow } from '@/db/schema/cards';
import { useDeckEditor } from '@/features/decks/useDeckEditor';
import { useT } from '@/i18n';
import { baseName, cardKey, variantLabel } from '@/lib/card-identity';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  COPY_LIMIT,
  MAIN_DECK_TARGET,
  RUNE_DECK_SIZE,
  type DeckSlot,
  type DeckZone,
} from '@/lib/legality';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Building a deck, as a sequence rather than one screen.
 *
 * Legend → Champion → Main deck → Runes → Battlefields → Overview. Each zone has
 * its own rules and its own pool, and putting them all on one screen means every
 * one of them gets a cramped strip. A step at a time gives the card grid the
 * whole screen, which is what choosing 40 cards out of ~900 actually needs.
 *
 * Nothing is written until the last step. Backing out leaves no trace — under
 * the version model a half-built deck is not a lost draft, it is a wrong deck
 * sitting in the list.
 */

const STEPS = [
  'legend',
  'champion',
  'main',
  'runes',
  'battlefields',
  'sideboard',
  'overview',
] as const;
type Step = (typeof STEPS)[number];

/** Types that live in the main deck. Runes and Battlefields have their own steps. */
const MAIN_DECK_TYPES = ['Unit', 'Spell', 'Gear'];

export default function NewDeckScreen() {
  const t = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const [filters, setFilters] = useState<PoolFilterState>(EMPTY_POOL_FILTERS);
  const step = STEPS[stepIndex]!;

  const slots = useDeckEditor((s) => s.slots);
  const name = useDeckEditor((s) => s.name);
  const startNew = useDeckEditor((s) => s.startNew);
  const reset = useDeckEditor((s) => s.reset);
  const setLegend = useDeckEditor((s) => s.setLegend);
  const setChampion = useDeckEditor((s) => s.setChampion);
  const setName = useDeckEditor((s) => s.setName);
  const adjust = useDeckEditor((s) => s.adjust);
  const replaceZone = useDeckEditor((s) => s.replaceZone);

  const legend = slots.find((s) => s.zone === 'legend')?.card ?? null;
  const champion = slots.find((s) => s.zone === 'champion')?.card ?? null;
  const list = useMemo(() => ({ slots }), [slots]);
  const legality = useMemo(() => checkLegality(list), [list]);

  /* Not part of legality — no rule counts the sideboard — so it is counted here
     rather than added to `DeckCounts`, which exists to answer "is this legal". */
  const sideboardCount = useMemo(
    () => slots.filter((s) => s.zone === 'sideboard').reduce((n, s) => n + s.quantity, 0),
    [slots]
  );

  // Leaving the flow discards the draft.
  useEffect(() => reset, [reset]);

  const quantityIn = (zone: DeckZone) => (card: CardRow) =>
    slots.find((s) => s.card.id === card.id && s.zone === zone)?.quantity ?? 0;

  /* ----------------------------------------------------------------- pools */

  const legends = useMemo(() => listLegends(), []);
  const champions = useMemo(() => (legend ? listChampionsForLegend(legend) : []), [legend]);
  const runePool = useMemo(
    () => (legend ? listRunesForIdentity(legend.domains) : []),
    [legend]
  );
  const battlefieldPool = useMemo(() => listBattlefields(), []);

  const mainPool = useMemo(() => {
    if (!legend) return [];
    const { types, supertypes } = poolKindFilters(filters.kinds);
    const term = filters.search.trim();

    return queryCards({
      search: term || undefined,
      identity: legend.domains,
      sets: filters.setIds.length ? filters.setIds : undefined,
      // No kind chosen means "everything a main deck can hold", not "nothing".
      types: types.length || supertypes.length ? types : MAIN_DECK_TYPES,
      supertypes: supertypes.length ? supertypes : undefined,
      // Relevance only means something with a term behind it; otherwise the
      // player's chosen sort wins.
      sort: term ? 'relevance' : filters.sort,
    }).filter((c) => MAIN_DECK_TYPES.includes(c.type));
  }, [legend, filters]);

  const filterByName = (cards: CardRow[]) => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((c) => c.cleanName.toLowerCase().includes(term));
  };

  const copiesOf = (card: CardRow, zones: DeckZone[]) =>
    slots
      .filter((s) => zones.includes(s.zone) && cardKey(s.card) === cardKey(card))
      .reduce((n, s) => n + s.quantity, 0);

  /**
   * Seed the rune deck the moment that step opens.
   *
   * Every legal deck runs 12 runes and only one rune card exists per domain, so
   * an even split across the identity is not really a suggestion — it is what
   * nearly every deck does. Starting from a complete 12 means the step arrives
   * already correct, and is touched only to change the split or the art.
   */
  useEffect(() => {
    if (step !== 'runes' || !legend) return;
    if (slots.some((s) => s.zone === 'rune')) return;
    if (runePool.length === 0) return;

    const perDomain = Math.floor(RUNE_DECK_SIZE / legend.domains.length);
    const seeded: DeckSlot[] = [];
    for (const domain of legend.domains) {
      // The standard printing, not whichever art happens to sort first.
      const rune =
        runePool.find((r) => r.domains.includes(domain) && variantLabel(r.name) === null) ??
        runePool.find((r) => r.domains.includes(domain));
      if (rune) seeded.push({ card: rune, quantity: perDomain, zone: 'rune' });
    }
    if (seeded.length > 0) replaceZone('rune', seeded);
  }, [step, legend, slots, runePool, replaceZone]);

  /* --------------------------------------------------------------- actions */

  const onPickLegend = (card: CardRow) => {
    // Re-picking keeps the cards already chosen; anything that falls outside the
    // new identity gets flagged by the legality bar rather than deleted.
    if (slots.length === 0) startNew(card);
    else setLegend(card);
    setFilters(EMPTY_POOL_FILTERS);
    setStepIndex(1);
  };

  const onPickChampion = (card: CardRow) => {
    setChampion(card);
    if (!name) setName(baseName(card.name).split(/[-,]/)[0]!.trim());
    setFilters(EMPTY_POOL_FILTERS);
    setStepIndex(2);
  };

  const onCreate = () => {
    if (!legend) return;
    const { deckId } = createDeck({
      name: name.trim() || baseName(legend.name),
      legend,
      champion,
      slots,
    });
    reset();
    router.replace(`/deck/${deckId}`);
  };

  const go = (delta: number) => {
    setFilters(EMPTY_POOL_FILTERS);
    setStepIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
  };

  /* -------------------------------------------------------- empty library */

  if (legends.length === 0) {
    return (
      <Screen title={t('build.title')}>
        <EmptyState
          title={t('build.noCards')}
          body={t('build.libraryDownloading')}
          actions={[
            { label: t('action.openCollection'), onPress: () => router.replace('/collection'), primary: true },
            { label: t('ui.goBack'), onPress: () => router.back() },
          ]}
        />
      </Screen>
    );
  }

  /* ---------------------------------------------------------------- chrome */

  const HEADINGS: Record<Step, { title: string; meta: string }> = {
    legend: { title: t('build.pickLegend'), meta: 'It sets the deck’s two domains' },
    champion: {
      title: t('build.pickChampion'),
      meta: legend ? `Partners ${baseName(legend.name)}` : '',
    },
    main: { title: t('zone.main'), meta: t('build.mainMeta', { count: legality.counts.main, target: MAIN_DECK_TARGET }) },
    runes: {
      title: t('zone.runes'),
      meta: `${legality.counts.rune}/${RUNE_DECK_SIZE} — split evenly by default`,
    },
    battlefields: {
      title: t('zone.battlefields'),
      meta: `${legality.counts.battlefield}/${BATTLEFIELD_COUNT} — all must be different`,
    },
    /*
     * No rule governs the sideboard, so it has no target and no failure state.
     * It was missing from this flow entirely: the zone is stored, forked,
     * exported and editable everywhere else, so a deck built here started life
     * unable to hold something every other screen would happily show it.
     */
    sideboard: {
      title: t('zone.sideboard'),
      meta:
        sideboardCount > 0
          ? t('build.sideboardMeta', { count: sideboardCount })
          : t('build.sideboardOptional'),
    },
    overview: { title: t('build.review'), meta: 'Name it and save' },
  };

  /*
   * The main deck gets the full control set; the other steps get a plain
   * search box.
   *
   * Legends and Battlefields are short, closed lists — 180 and 64 — where a
   * name is enough. The main deck is ~900 cards, and picking 40 of them by name
   * assumes you already know what you are looking for, which is the one thing a
   * player learning the format does not have.
   */
  const searchField =
    step === 'main' ? (
      <CardPoolFilters
        value={filters}
        onChange={setFilters}
        placeholder={t('build.searchIdentity', { domains: legend?.domains.join(' / ') ?? '' })}
        editable={!!legend}
      />
    ) : step === 'legend' || step === 'battlefields' ? (
      <TextInput
        value={filters.search}
        onChangeText={(search) => setFilters({ ...filters, search })}
        placeholder={step === 'legend' ? t('build.searchLegends') : t('build.searchBattlefields')}
        placeholderTextColor={color.textFaint}
        style={styles.search}
        autoCorrect={false}
        accessibilityLabel={t('build.search')}
      />
    ) : undefined;

  return (
    <Screen title={HEADINGS[step].title} meta={HEADINGS[step].meta}>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[styles.progressSegment, i <= stepIndex && styles.progressSegmentDone]}
          />
        ))}
      </View>

      <View style={styles.body}>
        {step === 'legend' ? (
          <CardGrid
            cards={filterByName(legends)}
            mode="single"
            selectedId={legend?.id}
            onSelect={onPickLegend}
            header={searchField}
            emptyMessage={t('build.noLegendMatch')}
          />
        ) : null}

        {step === 'champion' ? (
          <CardGrid
            cards={champions}
            mode="single"
            selectedId={champion?.id}
            onSelect={onPickChampion}
            emptyMessage={t('build.noChampion')}
          />
        ) : null}

        {step === 'main' ? (
          <CardGrid
            cards={mainPool}
            mode="quantity"
            quantityOf={quantityIn('main')}
            blockedReason={(card) =>
              copiesOf(card, ['main', 'champion']) >= COPY_LIMIT ? `Max ${COPY_LIMIT}` : null
            }
            onAdd={(card) => adjust(card, 'main', 1)}
            onRemove={(card) => adjust(card, 'main', -1)}
            header={searchField}
          />
        ) : null}

        {step === 'sideboard' ? (
          <CardGrid
            cards={mainPool}
            mode="quantity"
            quantityOf={quantityIn('sideboard')}
            blockedReason={(card) =>
              // Copies are counted across main and sideboard together: three is
              // three, wherever they are sitting.
              copiesOf(card, ['main', 'champion', 'sideboard']) >= COPY_LIMIT
                ? `Max ${COPY_LIMIT}`
                : null
            }
            onAdd={(card) => adjust(card, 'sideboard', 1)}
            onRemove={(card) => adjust(card, 'sideboard', -1)}
            header={searchField}
          />
        ) : null}

        {step === 'runes' ? (
          <CardGrid
            cards={runePool}
            mode="quantity"
            quantityOf={quantityIn('rune')}
            onAdd={(card) => adjust(card, 'rune', 1)}
            onRemove={(card) => adjust(card, 'rune', -1)}
            header={
              <Text style={styles.hint}>{t('build.runesHelp')}</Text>
            }
            emptyMessage={t('build.noRunes')}
          />
        ) : null}

        {step === 'battlefields' ? (
          <CardGrid
            cards={filterByName(battlefieldPool)}
            mode="quantity"
            columns={2}
            tileAspect={1 / CARD_ASPECT}
            quantityOf={quantityIn('battlefield')}
            blockedReason={(card) =>
              copiesOf(card, ['battlefield']) === 0 &&
              legality.counts.battlefield >= BATTLEFIELD_COUNT
                ? 'Deck is full'
                : null
            }
            onAdd={(card) => {
              // Rule 103.4.c — the three must be different, so tapping one you
              // already hold does nothing rather than stacking a second copy.
              if (copiesOf(card, ['battlefield']) > 0) return;
              adjust(card, 'battlefield', 1);
            }}
            onRemove={(card) => adjust(card, 'battlefield', -1)}
            header={searchField}
          />
        ) : null}

        {step === 'overview' ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <ScrollView contentContainerStyle={styles.overview} keyboardShouldPersistTaps="handled">
              <View style={styles.identity}>
                <DomainBadge domains={legend?.domains ?? []} size="md" showLabel />
                <Text style={styles.summaryMeta}>
                  {metaLine(
                    legend ? baseName(legend.name) : null,
                    champion ? baseName(champion.name) : null
                  )}
                </Text>
              </View>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('build.name')}
                placeholderTextColor={color.textFaint}
                style={styles.nameInput}
                returnKeyType="done"
                accessibilityLabel={t('build.name')}
              />

              <LegalityBar result={legality} />

              {legality.issues.length > 0 ? (
                <View style={styles.issues}>
                  {legality.issues.map((issue) => (
                    <Text key={`${issue.code}:${issue.message}`} style={styles.issue}>
                      {issue.message}
                    </Text>
                  ))}
                  <Text style={styles.hint}>{t('build.saveAnyway')}</Text>
                </View>
              ) : null}

              {/* The last honest look at the list before it is written. Read-only
                  on purpose — this screen is for checking, not for one more edit. */}
              <DeckPreview slots={slots} />

              <Pressable
                accessibilityRole="button"
                onPress={onCreate}
                style={({ pressed }) => [styles.primary, pressed && styles.pressedButton]}
              >
                <Text style={styles.primaryLabel}>{t('build.save')}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : null}
      </View>

      {step !== 'overview' && step !== 'legend' ? <LegalityBar result={legality} /> : null}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('build.prev')}
          onPress={() => (stepIndex === 0 ? router.back() : go(-1))}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressedButton]}
        >
          <Text style={styles.secondaryLabel}>{stepIndex === 0 ? 'Cancel' : 'Back'}</Text>
        </Pressable>

        {step !== 'overview' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('build.next')}
            disabled={!legend}
            onPress={() => go(1)}
            style={({ pressed }) => [
              styles.primary,
              styles.grow,
              !legend && styles.disabled,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryLabel}>{t('action.next')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1 },
  progress: { flexDirection: 'row', gap: space[1], paddingBottom: space[3] },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: color.border,
  },
  progressSegmentDone: { backgroundColor: color.text },
  search: {
    ...text.body,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[4],
    minHeight: 44,
    marginBottom: space[3],
  },
  hint: { ...text.small, color: color.textMuted, paddingBottom: space[3] },
  overview: { gap: space[4], paddingBottom: space[12] },
  identity: { gap: space[2] },
  summaryMeta: { ...text.meta, color: color.textMuted },
  nameInput: {
    ...text.title,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[4],
    minHeight: 56,
  },
  issues: { gap: space[1] },
  issue: { ...text.small, color: color.warning },
  footer: { flexDirection: 'row', gap: space[2], paddingVertical: space[3] },
  grow: { flex: 1 },
  primary: {
    minHeight: 48,
    paddingHorizontal: space[6],
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent,
  },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
  secondary: {
    minHeight: 48,
    paddingHorizontal: space[5],
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
  },
  secondaryLabel: { ...text.bodyMedium, color: color.text },
  disabled: { opacity: 0.4 },
  pressedButton: { opacity: 0.82 },
});
