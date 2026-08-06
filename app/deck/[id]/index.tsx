import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  deleteDeck,
  getDeck,
  listVersions,
  loadDeckList,
  missingCardCount,
} from '@/db/queries/decks';
import type { DeckRow, DeckVersionRow } from '@/db/schema/decks';
import { checkLegality, type DeckList, type DeckZone } from '@/lib/legality';
import { deckGradient } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Deck detail.
 *
 * M2 ships Overview and List. Versions, Matches, and Stats arrive with the
 * milestones that give them something to show — a Versions tab against a single
 * version, or a Matches tab before matches exist, is a tab that teaches the user
 * the app is empty.
 */

type Tab = 'overview' | 'list';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'list', label: 'List' },
];

const ZONE_ORDER: { zone: DeckZone; label: string; fixed?: boolean }[] = [
  { zone: 'legend', label: 'Legend', fixed: true },
  { zone: 'champion', label: 'Champion', fixed: true },
  { zone: 'main', label: 'Main deck' },
  { zone: 'rune', label: 'Runes' },
  { zone: 'battlefield', label: 'Battlefields' },
];

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [versions, setVersions] = useState<DeckVersionRow[]>([]);
  const [list, setList] = useState<DeckList>({ slots: [] });
  const [missing, setMissing] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const row = getDeck(id);
      setDeck(row);
      if (!row?.currentVersionId) return;
      setVersions(listVersions(row.id));
      setList(loadDeckList(row.currentVersionId));
      setMissing(missingCardCount(row.currentVersionId));
    }, [id])
  );

  const legality = useMemo(() => checkLegality(list), [list]);
  const current = versions.find((v) => v.id === deck?.currentVersionId) ?? null;

  const onDelete = () => {
    Alert.alert('Delete this deck?', 'Its versions and match history go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteDeck(id);
          router.replace('/');
        },
      },
    ]);
  };

  if (!deck) {
    return (
      <Screen title="Deck">
        <EmptyState
          title="Deck not found"
          body="It may have been deleted."
          actions={[{ label: 'Back to decks', onPress: () => router.replace('/'), primary: true }]}
        />
      </Screen>
    );
  }

  const [from, to] = deckGradient(deck.domains);

  return (
    <Screen
      title={deck.name}
      meta={metaLine(
        current ? `v${current.versionNumber}` : null,
        versions.length > 1 ? `${versions.length} versions` : null,
        legality.legal ? 'Legal' : 'Incomplete'
      )}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit deck"
          onPress={() => router.push(`/deck/${id}/edit`)}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      }
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accent}
      />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {missing > 0 ? (
          <Text style={styles.warning}>
            {missing} {missing === 1 ? 'card is' : 'cards are'} missing from the card library, so
            the counts below are short. Refreshing the library in Settings usually fixes this.
          </Text>
        ) : null}

        {tab === 'overview' ? (
          <View style={styles.overview}>
            <View style={styles.identity}>
              <DomainBadge domains={deck.domains} size="md" showLabel />
            </View>

            <LegalityBar result={legality} />

            {legality.issues.length > 0 ? (
              <View style={styles.issues}>
                {legality.issues.map((issue) => (
                  <Text key={`${issue.code}:${issue.message}`} style={styles.issue}>
                    {issue.message}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.versionBlock}>
              <Text style={styles.sectionLabel}>Versions</Text>
              {versions.map((v) => (
                <View key={v.id} style={styles.versionRow}>
                  <Text style={styles.versionNumber}>v{v.versionNumber}</Text>
                  <Text style={styles.versionMeta}>
                    {metaLine(
                      v.label,
                      `${v.mainCount}/40`,
                      v.lockedAt ? 'Locked' : 'Editable',
                      v.id === deck.currentVersionId ? 'Current' : null
                    )}
                  </Text>
                </View>
              ))}
              <Text style={styles.hint}>
                Editing a version that has matches logged against it creates a new one, so past
                results always stay attached to the list that played them.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onDelete}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLabel}>Delete deck</Text>
            </Pressable>
          </View>
        ) : (
          ZONE_ORDER.map(({ zone, label, fixed }) => {
            const slots = list.slots
              .filter((s) => s.zone === zone)
              .sort((a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99));
            if (slots.length === 0) return null;
            const count = slots.reduce((n, s) => n + s.quantity, 0);

            return (
              <View key={zone} style={styles.zone}>
                <View style={styles.zoneHeader}>
                  <Text style={styles.zoneLabel}>{label}</Text>
                  <Text style={styles.zoneCount}>{count}</Text>
                </View>
                {slots.map((slot) => (
                  <DeckSlotRow
                    key={`${slot.zone}:${slot.card.id}`}
                    slot={slot}
                    fixed={fixed}
                    onAdjust={() => undefined}
                    onPress={() => router.push(`/card/${slot.card.id}`)}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accent: { height: 3, borderRadius: radius.full, marginBottom: space[4] },
  tabs: { flexDirection: 'row', gap: space[1], marginBottom: space[4] },
  tab: {
    paddingHorizontal: space[4],
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: color.raised },
  tabLabel: { ...text.smallMedium, color: color.textMuted },
  tabLabelActive: { color: color.text },
  content: { paddingBottom: space[16], gap: space[5] },
  overview: { gap: space[5] },
  identity: { flexDirection: 'row' },
  issues: { gap: space[1] },
  issue: { ...text.small, color: color.warning },
  warning: { ...text.small, color: color.warning },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  versionBlock: { gap: space[2] },
  versionRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[3] },
  versionNumber: { ...text.numeric, fontSize: 14, color: color.text, minWidth: 28 },
  versionMeta: { ...text.meta, color: color.textMuted, flex: 1 },
  hint: { ...text.small, color: color.textFaint, paddingTop: space[1] },
  zone: { gap: space[1] },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.borderSubtle,
  },
  zoneLabel: { ...text.meta, color: color.textSecondary },
  zoneCount: { ...text.numeric, fontSize: 13, color: color.textMuted },
  edit: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  editLabel: { ...text.smallMedium, color: color.bg },
  delete: { minHeight: 44, justifyContent: 'center' },
  deleteLabel: { ...text.bodyMedium, color: color.danger },
  pressed: { opacity: 0.8 },
});
