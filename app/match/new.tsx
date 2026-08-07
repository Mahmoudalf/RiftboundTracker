import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { listDecks } from '@/db/queries/decks';
import {
  deckRecord,
  logMatch,
  opponentChampionFields,
  opponentFields,
  recentOpponents,
  undoMatch,
} from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import { BEST_OF_OPTIONS, type EventType, type MatchResult } from '@/db/schema/matches';
import { markLogAnother, markLogged, markSheetReady } from '@/features/matches/timing';
import { useToast } from '@/features/matches/useToast';
import { baseName, cardKey } from '@/lib/card-identity';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Log a match.
 *
 * *The flow that decides whether this app gets used at all.* Everything here is
 * subordinate to one number: under ten seconds from the tab bar to the
 * confirmation, or the flow gets redesigned rather than excused.
 *
 * That budget is why the layout is what it is. The deck is **preselected** to
 * the one you played most recently, so the common case needs no deck tap at
 * all. WIN and LOSS are the largest targets on the screen and sit under the
 * thumb. Draw is deliberately small — it is rare, and giving it equal weight
 * would cost every win and loss a moment of aim.
 *
 * **The result tap saves.** There is no confirm step, because a confirm on a
 * two-tap flow is a third tap. Everything that could go wrong is handled after
 * the fact by Undo, which is why the toast is not decoration.
 */

const RESULTS: { key: MatchResult; label: string }[] = [
  { key: 'win', label: 'WIN' },
  { key: 'loss', label: 'LOSS' },
];

const MATCH_STYLES: { key: EventType; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'skirmish', label: 'Skirmish' },
  { key: 'nexus-night', label: 'Nexus Night' },
  { key: 'locals', label: 'Locals' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'online', label: 'Online' },
  { key: 'testing', label: 'Testing' },
];

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style);
};

export default function LogMatchScreen() {
  // Read once. `listDecks` orders by `updated_at` and `logMatch` touches it, so
  // the head of this list is the deck you last played.
  const decks = useMemo(() => listDecks(), []);
  const [deckIndex, setDeckIndex] = useState(0);
  const [opponent, setOpponent] = useState<CardRow | null>(null);
  const [oppChampion, setOppChampion] = useState<CardRow | null>(null);
  const [picker, setPicker] = useState<'legend' | 'champion' | null>(null);

  // Every optional field starts null. An unanswered question must stay
  // unanswered in the database rather than become a confident wrong value.
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [eventType, setEventType] = useState<EventType>('casual');
  const [notes, setNotes] = useState('');

  const opponents = useMemo(() => recentOpponents(), []);

  /**
   * Champions that could partner the opponent's Legend.
   *
   * Deduped to one entry per card: choosing an opponent's Champion is recording
   * *who they played*, not which art they owned, and twenty printings of Vi
   * would be twenty ways to say the same thing.
   */
  const championChoices = useMemo(() => {
    if (!opponent) return [];
    const seen = new Set<string>();
    return listChampionsForLegend(opponent).filter((card) => {
      const key = cardKey(card);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [opponent]);
  const showToast = useToast((s) => s.show);
  const saving = useRef(false);

  const selected = decks[deckIndex];

  useEffect(() => {
    markSheetReady();
  }, []);

  const reset = () => {
    // "Log another" keeps the deck, the match style and the format — you are
    // still at the same event, in the same bracket — and clears the opponent,
    // which is the thing that changes every round.
    setOpponent(null);
    setOppChampion(null);
    setNotes('');
    saving.current = false;
  };

  const save = (result: MatchResult, andAnother: boolean) => {
    const versionId = selected?.deck.currentVersionId;
    if (!selected || !versionId || saving.current) return;
    saving.current = true;

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(
        result === 'win'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    }

    const deck = selected.deck;
    const id = logMatch({
      deckId: deck.id,
      deckVersionId: versionId,
      result,
      bestOf,
      eventType,
      notes: notes.trim() || null,
      ...opponentFields(opponent),
      ...opponentChampionFields(oppChampion),
    });

    // Read back rather than computing from the draft — the toast quotes the
    // database, so a number that is wrong here is a number that is wrong.
    const record = deckRecord(deck.id);
    const rate = record.total > 0 ? Math.round((record.wins / record.total) * 100) : 0;
    const version = selected.version ? ` v${selected.version.versionNumber}` : '';

    showToast(
      `Logged · ${deck.name}${version} now ${record.wins}–${record.losses} (${rate}%)`,
      { label: 'Undo', onPress: () => undoMatch(id) }
    );
    markLogged();

    if (andAnother) {
      reset();
      markLogAnother();
    } else {
      router.back();
    }
  };

  if (decks.length === 0) {
    return (
      <Screen title="Log a match" back={false}>
        <EmptyState
          title="No decks yet"
          body="A match is attached to the exact deck version that played it, so there needs to be a deck first."
          actions={[
            { label: 'Build a deck', onPress: () => router.replace('/deck/new'), primary: true },
            { label: 'Close', onPress: () => router.back() },
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Log a match"
      back={false}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Deck — preselected, and only a chooser when there is a choice. */}
        {decks.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.deckRail}
          >
            {decks.map((summary, index) => (
              <Pressable
                key={summary.deck.id}
                accessibilityRole="button"
                accessibilityState={{ selected: index === deckIndex }}
                onPress={() => {
                  haptic(Haptics.ImpactFeedbackStyle.Light);
                  setDeckIndex(index);
                }}
                style={({ pressed }) => [
                  styles.deckChip,
                  index === deckIndex && styles.deckChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.deckName, index === deckIndex && styles.deckNameActive]}
                  numberOfLines={1}
                >
                  {summary.deck.name}
                </Text>
                {summary.version ? (
                  <Text
                    style={[styles.deckVersion, index === deckIndex && styles.deckNameActive]}
                  >
                    v{summary.version.versionNumber}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.singleDeck}>
            {metaLine(
              selected?.deck.name,
              selected?.version ? `v${selected.version.versionNumber}` : null
            )}
          </Text>
        )}

        {/* The two taps. */}
        <View style={styles.results}>
          {RESULTS.map((r) => (
            <Pressable
              key={r.key}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}${selected ? ` with ${selected.deck.name}` : ''}`}
              onPress={() => save(r.key, false)}
              onLongPress={() => save(r.key, true)}
              delayLongPress={400}
              accessibilityHint="Long press to log this and stay open for the next round"
              style={({ pressed }) => [
                styles.result,
                r.key === 'win' ? styles.win : styles.loss,
                pressed && styles.resultPressed,
              ]}
            >
              <Text style={styles.resultLabel}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tertiary}>
          <Pressable
            accessibilityRole="button"
            onPress={() => save('draw', false)}
            hitSlop={12}
            style={({ pressed }) => [styles.draw, pressed && styles.pressed]}
          >
            <Text style={styles.drawLabel}>· draw ·</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Hold WIN or LOSS to log it and stay here for the next round.
        </Text>

        {/* Opponent's Legend. Everything below is optional — the fast path
            taps a result and never reaches it. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Opponent&apos;s Legend</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.oppRail}
          >
            {opponents.map((card) => {
              const active = opponent?.id === card.id;
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={baseName(card.name)}
                  onPress={() => {
                    haptic(Haptics.ImpactFeedbackStyle.Light);
                    setOpponent(active ? null : card);
                    setOppChampion(null);
                  }}
                  style={({ pressed }) => [
                    styles.oppChip,
                    active && styles.oppChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <DomainBadge domains={card.domains} />
                  <Text
                    style={[styles.oppName, active && styles.oppNameActive]}
                    numberOfLines={1}
                  >
                    {baseName(card.name)}
                  </Text>
                </Pressable>
              );
            })}

            {/* The rail only knows Legends you have already faced, so it is
                empty on the first match and can never be the only way in. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose from all Legends"
              onPress={() => setPicker('legend')}
              style={({ pressed }) => [styles.oppChip, pressed && styles.pressed]}
            >
              <Text style={styles.searchLabel}>
                {opponents.length === 0 ? 'Choose a Legend' : 'All Legends'}
              </Text>
            </Pressable>
          </ScrollView>

          {opponent && !opponents.some((c) => c.id === opponent.id) ? (
            <Text style={styles.chosen}>{baseName(opponent.name)}</Text>
          ) : null}
        </View>

        {/* Their Chosen Champion — only askable once a Legend is known, since
            the candidates are derived from it. */}
        {opponent ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Their Chosen Champion</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose the opponent's Champion"
              onPress={() => setPicker('champion')}
              style={({ pressed }) => [styles.field, pressed && styles.pressed]}
            >
              <Text style={oppChampion ? styles.fieldValue : styles.fieldPlaceholder}>
                {oppChampion ? baseName(oppChampion.name) : 'Not recorded'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Best of</Text>
          <View style={styles.segmented}>
            {BEST_OF_OPTIONS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: bestOf === value }}
                accessibilityLabel={`Best of ${value}`}
                // Tapping the chosen one again clears it, so "I did not record
                // this" stays reachable after a mis-tap.
                onPress={() => setBestOf(bestOf === value ? null : value)}
                style={({ pressed }) => [
                  styles.segment,
                  bestOf === value && styles.segmentActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.segmentLabel, bestOf === value && styles.segmentLabelActive]}
                >
                  Bo{value}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Match style</Text>
          <View style={styles.segmented}>
            {MATCH_STYLES.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: eventType === option.key }}
                onPress={() => setEventType(option.key)}
                style={({ pressed }) => [
                  styles.segment,
                  eventType === option.key && styles.segmentActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    eventType === option.key && styles.segmentLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering"
            placeholderTextColor={color.textFaint}
            style={styles.notes}
            multiline
            accessibilityLabel="Match note"
          />
        </View>
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={picker === 'legend' ? 'Opponent’s Legend' : 'Their Chosen Champion'}
        subtitle={
          picker === 'champion' && opponent
            ? `Champions that partner ${baseName(opponent.name)}`
            : undefined
        }
        cards={picker === 'legend' ? listLegends() : championChoices}
        selectedId={picker === 'legend' ? (opponent?.id ?? null) : (oppChampion?.id ?? null)}
        emptyMessage={
          picker === 'champion'
            ? 'No Champion Unit in the library partners that Legend.'
            : 'The card library has not finished downloading.'
        }
        onSelect={(card) => {
          if (picker === 'legend') {
            setOpponent(card);
            setOppChampion(null);
          } else {
            setOppChampion(card);
          }
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[12], gap: space[4] },
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.raised,
  },
  closeLabel: { ...text.smallMedium, color: color.text },

  deckRail: { gap: space[2], paddingRight: space[4] },
  deckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    maxWidth: 240,
  },
  deckChipActive: { backgroundColor: color.text, borderColor: color.text },
  deckName: { ...text.smallMedium, color: color.textSecondary, flexShrink: 1 },
  deckNameActive: { color: color.bg },
  deckVersion: { ...text.numeric, fontSize: 12, color: color.textMuted },
  singleDeck: { ...text.meta, color: color.textMuted },

  results: { flexDirection: 'row', gap: space[3] },
  result: {
    flex: 1,
    // Deliberately large. This is tapped under time pressure, often without
    // looking, and every millimetre of target is a millisecond of aim saved.
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  win: { borderColor: color.win, backgroundColor: color.surface },
  loss: { borderColor: color.loss, backgroundColor: color.surface },
  resultPressed: { opacity: 0.6 },
  resultLabel: { ...text.display, fontSize: 28, color: color.text },

  tertiary: { alignItems: 'center' },
  draw: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space[6] },
  drawLabel: { ...text.small, color: color.textMuted },
  hint: { ...text.microMeta, color: color.textFaint, textAlign: 'center' },

  section: { gap: space[2] },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  empty: { ...text.small, color: color.textFaint },

  oppRail: { gap: space[2], paddingRight: space[4] },
  oppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    maxWidth: 200,
  },
  oppChipActive: { borderColor: color.text, backgroundColor: color.raised },
  oppName: { ...text.small, color: color.textSecondary, flexShrink: 1 },
  oppNameActive: { color: color.text },
  searchLabel: { ...text.smallMedium, color: color.info },
  chosen: { ...text.small, color: color.text },

  field: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  fieldValue: { ...text.small, color: color.text },
  fieldPlaceholder: { ...text.small, color: color.textFaint },

  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  segment: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  segmentActive: { backgroundColor: color.text, borderColor: color.text },
  segmentLabel: { ...text.small, color: color.textSecondary },
  segmentLabelActive: { color: color.bg },

  notes: {
    ...text.small,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[3],
    minHeight: 72,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.75 },
});
