import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { getCard, listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { getDeck, getVersion } from '@/db/queries/decks';
import { getEvent } from '@/db/queries/events';
import {
  deleteMatch,
  getMatch,
  opponentChampionFields,
  opponentFields,
  updateMatch,
} from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import {
  BEST_OF_OPTIONS,
  MATCH_STYLES,
  type MatchResult,
  type MatchStyle,
} from '@/db/schema/matches';
import { baseName, cardKey } from '@/lib/card-identity';
import { matchDate, matchStyleLabel, recordLine } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * A logged match, and every field of it editable.
 *
 * Editing is unrestricted in a way deck versions deliberately are not, and the
 * asymmetry is the point: a match is a record of something that happened, so
 * correcting a mis-tapped result is fixing the record. A *decklist* with matches
 * behind it is what those results are evidence about, which is why that one
 * forks instead.
 *
 * The one thing not editable here is which deck version played it. Moving a
 * result onto a list that did not play it is the exact corruption the whole
 * version model exists to prevent, and no amount of "the user asked" makes the
 * resulting statistic true.
 */

const RESULTS: { key: MatchResult; label: string }[] = [
  { key: 'win', label: 'Win' },
  { key: 'loss', label: 'Loss' },
  { key: 'draw', label: 'Draw' },
];

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState(() => getMatch(id));
  const [picker, setPicker] = useState<'legend' | 'champion' | null>(null);
  const [notes, setNotes] = useState(() => getMatch(id)?.notes ?? '');

  const reload = useCallback(() => setMatch(getMatch(id)), [id]);

  const patch = (changes: Parameters<typeof updateMatch>[1]) => {
    updateMatch(id, changes);
    reload();
  };

  if (!match) {
    return (
      <Screen title="Match">
        <EmptyState
          title="Match not found"
          body="It may have been deleted."
          actions={[{ label: 'Back', onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const deck = getDeck(match.deckId);
  const version = getVersion(match.deckVersionId);
  // Read inline like the deck and version above, and re-read on every render
  // for the same reason: deleting the event elsewhere must stop linking to it.
  const event = match.eventId ? getEvent(match.eventId) : null;

  // The Legend the opponent played, if the library still has it. The *name*
  // comes from the match row either way — that is what migration 7 is for.
  const oppLegendCard = match.oppLegendCardId ? getCard(match.oppLegendCardId) : null;

  const championChoices = () => {
    if (!oppLegendCard) return [];
    const seen = new Set<string>();
    return listChampionsForLegend(oppLegendCard).filter((card) => {
      const key = cardKey(card);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const onDelete = () => {
    Alert.alert('Delete this match?', 'It will stop counting towards this deck’s record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMatch(id);
          router.back();
        },
      },
    ]);
  };

  const chipRow = <T,>(
    options: { key: string; label: string; value: T }[],
    current: T,
    onSelect: (value: T) => void
  ) => (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityState={{ selected: current === option.value }}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [
            styles.segment,
            current === option.value && styles.segmentActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.segmentLabel,
              current === option.value && styles.segmentLabelActive,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen
      title={match.oppLegendName ? baseName(match.oppLegendName) : 'Match'}
      meta={metaLine(
        deck?.name,
        version ? `v${version.versionNumber}` : null,
        matchDate(match.playedAt)
      )}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Result</Text>
          {chipRow(
            RESULTS.map((r) => ({ key: r.key, label: r.label, value: r.key })),
            match.result,
            (value) => patch({ result: value })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Opponent&apos;s Legend</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicker('legend')}
            style={({ pressed }) => [styles.field, pressed && styles.pressed]}
          >
            <Text style={match.oppLegendName ? styles.fieldValue : styles.fieldPlaceholder}>
              {match.oppLegendName ? baseName(match.oppLegendName) : 'Not recorded'}
            </Text>
          </Pressable>
          {match.oppLegendCardId && !oppLegendCard ? (
            <Text style={styles.warning}>
              This Legend is no longer in the card library, so its art cannot be shown. The match
              still knows who you played.
            </Text>
          ) : null}
        </View>

        {match.oppLegendName ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Their Chosen Champion</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!oppLegendCard}
              onPress={() => setPicker('champion')}
              style={({ pressed }) => [
                styles.field,
                !oppLegendCard && styles.fieldDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={match.oppChampionName ? styles.fieldValue : styles.fieldPlaceholder}
              >
                {match.oppChampionName ? baseName(match.oppChampionName) : 'Not recorded'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Best of</Text>
          {chipRow<number | null>(
            [
              { key: 'none', label: '—', value: null },
              ...BEST_OF_OPTIONS.map((n) => ({ key: String(n), label: `Bo${n}`, value: n })),
            ],
            match.bestOf,
            (value) => patch({ bestOf: value })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Match style</Text>
          {chipRow<MatchStyle>(
            MATCH_STYLES.map((key) => ({ key, label: matchStyleLabel(key), value: key })),
            match.eventType,
            (value) => patch({ eventType: value })
          )}
        </View>

        {/*
          The event this round belonged to, if any.
          *
          A link rather than a picker: moving a match between events is a rare
          correction, and the useful thing here is the way back to the day it
          was part of.
        */}
        {event ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Event</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${event.name}`}
              onPress={() => router.push(`/event/${event.id}`)}
              style={({ pressed }) => [styles.eventLink, pressed && styles.pressed]}
            >
              <Text style={styles.eventLinkLabel} numberOfLines={1}>
                {event.name}
              </Text>
              <Text style={styles.eventLinkMeta}>
                {recordLine(event.wins, event.losses, event.draws) ?? 'No rounds'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => patch({ notes: notes.trim() || null })}
            placeholder="Anything worth remembering"
            placeholderTextColor={color.textFaint}
            style={styles.notes}
            multiline
            accessibilityLabel="Match note"
          />
        </View>

        <Text style={styles.footnote}>
          Which version played this match cannot be changed. Moving a result onto a list that did
          not play it is what the version history exists to prevent.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>Delete match</Text>
        </Pressable>
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={picker === 'legend' ? 'Opponent’s Legend' : 'Their Chosen Champion'}
        cards={picker === 'legend' ? listLegends() : championChoices()}
        selectedId={
          picker === 'legend' ? match.oppLegendCardId : match.oppChampionCardId
        }
        emptyMessage="Nothing to choose from."
        onSelect={(card: CardRow) => {
          if (picker === 'legend') {
            // Changing the Legend invalidates the Champion — it was chosen from
            // the old Legend's partners.
            patch({ ...opponentFields(card), ...opponentChampionFields(null) });
          } else {
            patch(opponentChampionFields(card));
          }
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[16], gap: space[5] },
  section: { gap: space[2] },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  segment: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  segmentActive: { backgroundColor: color.accent, borderColor: color.text },
  segmentLabel: { ...text.small, color: color.textSecondary },
  segmentLabelActive: { color: color.onAccent },
  field: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldValue: { ...text.small, color: color.text },
  fieldPlaceholder: { ...text.small, color: color.textFaint },
  warning: { ...text.microMeta, color: color.warning },
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
  footnote: { ...text.microMeta, color: color.textFaint },
  delete: { minHeight: 44, justifyContent: 'center' },
  deleteLabel: { ...text.bodyMedium, color: color.danger },
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: 48,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  eventLinkLabel: { ...text.bodyMedium, color: color.text, flexShrink: 1 },
  eventLinkMeta: { ...text.microMeta, color: color.textMuted },
  pressed: { opacity: 0.75 },
});
