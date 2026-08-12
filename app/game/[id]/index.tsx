import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { getCard, listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { getDeck, getVersion, versionCardNames } from '@/db/queries/decks';
import { getEvent } from '@/db/queries/events';
import {
  deleteGame,
  getGame,
  opponentChampionFields,
  opponentFields,
  updateGame,
} from '@/db/queries/games';
import { listMatches } from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import {
  BEST_OF_OPTIONS,
  LOGGED_GAME_STYLES,
  type MatchRow,
  type Result,
  type GameStyle,
} from '@/db/schema/games';
import { baseName, cardKey } from '@/lib/card-identity';
import { gameDate, gameStyleLabel, recordLine } from '@/lib/format';
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

const RESULTS: { key: Result; label: string }[] = [
  { key: 'win', label: 'Win' },
  { key: 'loss', label: 'Loss' },
  { key: 'draw', label: 'Draw' },
];

interface Option<T> {
  key: string;
  label: string;
  value: T;
}

/**
 * The options on offer, plus whatever this match already holds.
 *
 * The log form's vocabulary narrowed with the Hi-Fi handoff — Bo5 and Testing
 * are gone from it — and a match logged before that is still a true record of
 * what was entered. Without this, opening such a match would show a control
 * with nothing selected, which reads as *unanswered* and invites correcting a
 * fact that was never wrong. Same rule the event-style split settled on in M6:
 * narrow what can be written, never rewrite what already is.
 */
function withCurrent<T>(offered: Option<T>[], current: T, label: (value: T) => string): Option<T>[] {
  if (offered.some((option) => option.value === current)) return offered;
  return [...offered, { key: `held-${String(current)}`, label: label(current), value: current }];
}

/**
 * One match's recorded detail, as a sentence rather than a form.
 *
 * Everything the `matches` table holds was invisible on this screen until now —
 * the log form has written match rows since M4 and nothing ever read them back,
 * so turn order and both Battlefields were recorded and then unreachable. That
 * is the same "query layer ahead of the screens" gap the roadmap names twice.
 *
 * Reads as prose because it is a record being checked against memory, not a
 * control being operated. Anything unrecorded is simply absent — a row of
 * "Not recorded" repeated four times says nothing except that the screen has
 * fields.
 */
function MatchSummary({
  match,
  cardNames,
}: {
  match: MatchRow;
  cardNames: Map<string, string>;
}) {
  const name = (id: string) => cardNames.get(id) ?? 'a card no longer in the list';

  const outcome = match.result === 'win' ? 'Won' : match.result === 'loss' ? 'Lost' : 'Drew';
  const turnOrder =
    match.onPlay === null ? null : match.onPlay ? 'on the play' : 'on the draw';
  const score =
    match.scoreFor !== null && match.scoreAgainst !== null
      ? `${match.scoreFor}–${match.scoreAgainst}`
      : null;

  const hand = (() => {
    if (match.openingHand === null && match.mulliganed === null) return null;
    const kept = (match.openingHand ?? []).map(name);
    const back = (match.mulliganed ?? []).map(name);
    const parts = [kept.length > 0 ? `Kept ${kept.join(', ')}` : 'Kept nothing'];
    if (back.length > 0) parts.push(`sent back ${back.join(', ')}`);
    return parts.join(', ');
  })();

  return (
    <View style={styles.match}>
      <View style={styles.matchHead}>
        <Text style={styles.matchTitle}>Match {match.matchNumber}</Text>
        <Text style={styles.matchOutcome}>
          {metaLine(outcome, turnOrder, score ? `${score} points` : null)}
        </Text>
      </View>
      {hand ? <Text style={styles.matchLine}>{hand}.</Text> : null}
    </View>
  );
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState(() => getGame(id));
  const [matches, setMatches] = useState<MatchRow[]>(() => listMatches(id));
  const [picker, setPicker] = useState<'legend' | 'champion' | null>(null);
  const [notes, setNotes] = useState(() => getGame(id)?.notes ?? '');

  const reload = useCallback(() => {
    setGame(getGame(id));
    setMatches(listMatches(id));
  }, [id]);

  // The depth screen writes match rows and comes straight back here. Without
  // this, the summaries below would still show what was recorded before it.
  useFocusEffect(reload);

  const patch = (changes: Parameters<typeof updateGame>[1]) => {
    updateGame(id, changes);
    reload();
  };

  if (!game) {
    return (
      <Screen title="Game">
        <EmptyState
          title="Game not found"
          body="It may have been deleted."
          actions={[{ label: 'Back', onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const deck = getDeck(game.deckId);
  const version = getVersion(game.deckVersionId);
  // Read inline like the deck and version above, and re-read on every render
  // for the same reason: deleting the event elsewhere must stop linking to it.
  const event = game.eventId ? getEvent(game.eventId) : null;

  // The Legend the opponent played, if the library still has it. The *name*
  // comes from the game row either way — that is what migration 7 is for.
  const oppLegendCard = game.oppLegendCardId ? getCard(game.oppLegendCardId) : null;

  /*
   * Names for whatever the opening hands hold, read from the deck version
   * rather than the card mirror so a hand keeps rendering after a printing
   * leaves the library. Same argument as `opp_legend_name`, answered by a table
   * that already stores the name instead of by a fourth copy of it.
   */
  const cardNames = versionCardNames(game.deckVersionId);

  /** Whether any of the second-tier fields have been filled in at all. */
  const recordedDepth = matches.some(
    (m) =>
      m.scoreFor !== null ||
      m.scoreAgainst !== null ||
      m.openingHand !== null ||
      m.mulliganed !== null
  );

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
    Alert.alert('Delete this game?', 'It will stop counting towards this deck’s record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteGame(id);
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
      title={game.oppLegendName ? baseName(game.oppLegendName) : 'Match'}
      meta={metaLine(
        deck?.name,
        version ? `v${version.versionNumber}` : null,
        gameDate(game.playedAt)
      )}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Result</Text>
          {chipRow(
            RESULTS.map((r) => ({ key: r.key, label: r.label, value: r.key })),
            game.result,
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
            <Text style={game.oppLegendName ? styles.fieldValue : styles.fieldPlaceholder}>
              {game.oppLegendName ? baseName(game.oppLegendName) : 'Not recorded'}
            </Text>
          </Pressable>
          {game.oppLegendCardId && !oppLegendCard ? (
            <Text style={styles.warning}>
              This Legend is no longer in the card library, so its art cannot be shown. The game
              still knows who you played.
            </Text>
          ) : null}
        </View>

        {game.oppLegendName ? (
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
                style={game.oppChampionName ? styles.fieldValue : styles.fieldPlaceholder}
              >
                {game.oppChampionName ? baseName(game.oppChampionName) : 'Not recorded'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Best of</Text>
          {/*
            `—` survives here and not on the log form.

            The form's job is to record a game being played, where the format
            is always known — the design is explicit that it never defaults to
            unset. This screen's job is to correct the record, and "I do not
            actually know" is a correction someone is entitled to make.
          */}
          {chipRow<number | null>(
            withCurrent<number | null>(
              [
                { key: 'none', label: '—', value: null },
                ...BEST_OF_OPTIONS.map((n) => ({ key: String(n), label: `Bo${n}`, value: n })),
              ],
              game.bestOf,
              (value) => `Bo${value}`
            ),
            game.bestOf,
            (value) => patch({ bestOf: value })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Game style</Text>
          {chipRow<GameStyle>(
            withCurrent<GameStyle>(
              LOGGED_GAME_STYLES.map((key) => ({
                key,
                label: gameStyleLabel(key),
                value: key,
              })),
              game.gameStyle,
              gameStyleLabel
            ),
            game.gameStyle,
            (value) => patch({ gameStyle: value })
          )}
        </View>

        {/*
          The event this round belonged to, if any.
          *
          A link rather than a picker: moving a game between events is a rare
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
          <Text style={styles.sectionLabel}>
            {matches.length === 1 ? 'The game' : 'The matches'}
          </Text>
          {matches.length === 0 ? (
            <Text style={styles.footnote}>
              No matches were recorded for this game. Games logged before per-match detail existed
              have only their overall result, which still counts towards every record.
            </Text>
          ) : (
            <>
              {matches.map((m) => (
                <MatchSummary key={m.id} match={m} cardNames={cardNames} />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add in-depth match detail"
                onPress={() => router.push(`/game/${id}/matches`)}
                style={({ pressed }) => [styles.depth, pressed && styles.pressed]}
              >
                <Text style={styles.depthLabel}>
                  {recordedDepth ? 'Edit match detail' : 'Add match detail'}
                </Text>
                <Text style={styles.depthMeta}>
                  Opening deal · Champion turns · final score
                </Text>
              </Pressable>
            </>
          )}
        </View>

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
            accessibilityLabel="Game note"
          />
        </View>

        <Text style={styles.footnote}>
          Which version played this game cannot be changed. Moving a result onto a list that did
          not play it is what the version history exists to prevent.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>Delete game</Text>
        </Pressable>
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={picker === 'legend' ? 'Opponent’s Legend' : 'Their Chosen Champion'}
        cards={picker === 'legend' ? listLegends() : championChoices()}
        selectedId={
          picker === 'legend' ? game.oppLegendCardId : game.oppChampionCardId
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
  // Two sentences of prose, not a label — `microMeta` would set it in 9.5px
  // uppercase at a value the palette reserves for decoration. Same mistake as
  // the game log's empty Battlefield state.
  footnote: { ...text.caption, color: color.textMuted },
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

  match: {
    gap: space[1],
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
  },
  matchHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  matchTitle: { ...text.smallMedium, color: color.text },
  matchOutcome: { ...text.microMeta, color: color.textMuted, flexShrink: 1, textAlign: 'right' },
  // Prose, so `caption` rather than the uppercase micro face — these are
  // sentences someone reads, not labels they scan.
  matchLine: { ...text.caption, color: color.textMuted },

  depth: {
    gap: 2,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    marginTop: space[2],
  },
  depthLabel: { ...text.bodyMedium, color: color.text },
  depthMeta: { ...text.microMeta, color: color.textMuted },

  pressed: { opacity: 0.75 },
});
