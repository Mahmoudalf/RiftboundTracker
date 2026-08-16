import { router } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { countMatchingCards, facetValues, type CardSort } from '@/db/queries/cards';
import { useCardFilters } from '@/features/cards/useCardFilters';
import { useT, type Key } from '@/i18n';
import { localeNumber } from '@/lib/format';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Filter panel.
 *
 * A router modal rather than a gesture sheet: it is a form the user commits to
 * and dismisses, and the native modal gives that for free with correct back
 * behaviour and no animation library in the path. The log-match flow in M4 is
 * the one that genuinely needs a draggable sheet.
 *
 * Selections apply immediately — the result count in the footer updates live,
 * so there is nothing to "apply" and no way to lose a selection by dismissing.
 */

const SORTS = [
  // "Best match" only differs from Name while a search term is active; without
  // one, queryCards treats it as Name.
  { value: 'relevance', label: 'filters.sort.relevance' },
  { value: 'name', label: 'filters.sort.name' },
  { value: 'energy', label: 'filters.sort.cost' },
  { value: 'collector', label: 'filters.sort.collector' },
  { value: 'rarity', label: 'filters.sort.rarity' },
] as const satisfies readonly { value: CardSort; label: Key }[];

const ENERGY_VALUES = [0, 1, 2, 3, 4, 5, 6, 7];

export default function FiltersScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const filters = useCardFilters();

  const types = facetValues('type');
  const rarities = facetValues('rarity');
  const sets = facetValues('set_id');

  const matching = countMatchingCards(filters.toQuery());
  const activeCount = filters.activeCount();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('filters.title')}</Text>
        <View style={styles.headerActions}>
          {activeCount > 0 ? (
            <Pressable
              onPress={filters.clear}
              accessibilityRole="button"
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <Text style={styles.clearLabel}>{t('filters.clearAll')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('filters.close')}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Icon name="close" size={20} color={color.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('filters.domain')}>
          <View style={styles.wrap}>
            {PLAYABLE_DOMAINS.map((domain) => (
              <Chip
                key={domain}
                label={domain}
                glyph={
                  <DomainGlyph
                    domain={domain}
                    size={12}
                    color={filters.domains.includes(domain) ? color.bg : domainColor(domain).base}
                  />
                }
                accent={domainColor(domain).base}
                selected={filters.domains.includes(domain)}
                onPress={() => filters.toggle('domains', domain)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.type')}>
          <View style={styles.wrap}>
            {types.map((type) => (
              <Chip
                key={type}
                label={type}
                selected={filters.types.includes(type)}
                onPress={() => filters.toggle('types', type)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.cost')}>
          <View style={styles.wrap}>
            {ENERGY_VALUES.map((value) => (
              <Chip
                key={value}
                label={value === 7 ? '7+' : String(value)}
                selected={filters.energy.includes(value)}
                onPress={() => filters.toggleEnergy(value)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.rarity')}>
          <View style={styles.wrap}>
            {rarities.map((rarity) => (
              <Chip
                key={rarity}
                label={rarity}
                selected={filters.rarities.includes(rarity)}
                onPress={() => filters.toggle('rarities', rarity)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.set')}>
          <View style={styles.wrap}>
            {sets.map((set) => (
              <Chip
                key={set}
                label={set}
                selected={filters.sets.includes(set)}
                onPress={() => filters.toggle('sets', set)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.sortBy')}>
          <View style={styles.wrap}>
            {SORTS.map((sort) => (
              <Chip
                key={sort.value}
                label={t(sort.label)}
                selected={filters.sort === sort.value}
                onPress={() => filters.setSort(sort.value)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>{t('filters.hideAltArt')}</Text>
            <Text style={styles.switchHint}>{t('filters.hideAltArt.help')}</Text>
          </View>
          <Switch
            value={filters.hideAlternateArt}
            onValueChange={filters.setHideAlternateArt}
            trackColor={{ true: color.text, false: color.border }}
            thumbColor={color.bg}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>
            {matching === 0
              ? t('filters.noCardsMatch')
              : t(matching === 1 ? 'filters.showCards.one' : 'filters.showCards.other', {
                  count: localeNumber(matching),
                })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[4],
  },
  title: { ...text.title, color: color.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  clear: { height: 36, justifyContent: 'center', paddingHorizontal: space[2] },
  clearLabel: { ...text.smallMedium, color: color.textSecondary },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  pressed: { opacity: 0.7 },

  body: { paddingHorizontal: space[4], paddingBottom: space[8], gap: space[6] },
  section: { gap: space[3] },
  sectionTitle: { ...text.meta, color: color.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
    paddingTop: space[2],
  },
  switchCopy: { flex: 1, gap: space[0.5] },
  switchLabel: { ...text.bodyMedium, color: color.text },
  switchHint: { ...text.caption, color: color.textMuted },

  footer: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.raised,
  },
  done: {
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { ...text.bodyMedium, color: color.onAccent },
});
