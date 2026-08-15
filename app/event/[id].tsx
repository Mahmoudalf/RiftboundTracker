import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameRow } from '@/components/games/GameRow';
import { DetailsSheet } from '@/components/ui/DetailsSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  deleteEvent,
  eventGames,
  getEvent,
  updateEvent,
  type EventSummary,
} from '@/db/queries/events';
import {
  EVENT_STYLES,
  type EventStyle,
  type GameRow as GameRowType,
} from '@/db/schema/games';
import { useT } from '@/i18n';
import { eventStyleLabel, gameDate, recordLine } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One event, and the rounds played at it.
 *
 * Read forwards — round 1 at the top — unlike every other match list in the
 * app. A match list is a history you scan backwards; an event is a day you
 * replay, and "how did it start" is the question people actually ask.
 *
 * Placement is entered here rather than logged with a match, because it is the
 * one fact a tournament produces that no individual round contains.
 */

/** Ordinals only need to reach the top few places to be worth the words. */
function placeLabel(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[place % 10] ?? 'th';
  return `${place}${suffix}`;
}

export default function EventDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [games, setGames] = useState<GameRowType[]>([]);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  /**
   * Null until someone says otherwise.
   *
   * An event named from the log form has no tier — the form does not ask, and
   * migration 17 stopped the column from making one up. This screen is where
   * the question can actually be answered, so it opens on "not set" rather than
   * on a guess that saving would then make true.
   */
  const [style, setStyle] = useState<EventStyle | null>(null);

  const load = useCallback(() => {
    setEvent(getEvent(id));
    setGames(eventGames(id));
  }, [id]);

  useFocusEffect(load);

  const onDelete = () => {
    Alert.alert(
      `Delete ${event?.name}?`,
      games.length > 0
        ? `The ${games.length} ${games.length === 1 ? 'game' : 'games'} played here are kept — they still count towards your deck and overall records. Only the grouping goes.`
        : 'This event has no games logged against it.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(id);
            router.back();
          },
        },
      ]
    );
  };

  if (!event) {
    return (
      <Screen title={t('event.title')}>
        <EmptyState
          title={t('event.notFound')}
          body={t('event.notFound.body')}
          actions={[{ label: t('ui.goBack'), onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={event.name}
      meta={metaLine(
        // Dropped rather than shown as "not recorded": this is a meta line, and
        // `metaLine` already omits what is absent. A tier nobody set is not a
        // gap to announce in the title — it is a detail that has not come up.
        event.eventType ? eventStyleLabel(event.eventType) : null,
        gameDate(event.startedAt),
        event.location
      )}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('event.edit')}
          onPress={() => {
            setStyle(event.eventType);
            setEditing(true);
          }}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>{t('action.edit')}</Text>
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.record}>
            {recordLine(event.wins, event.losses, event.draws) ?? 'No rounds yet'}
          </Text>
          <Text style={styles.meta}>
            {metaLine(
              `${event.total} ${event.total === 1 ? 'round' : 'rounds'} logged`,
              // Only shown once entered — a blank placement is not a result of
              // zero, it is a tournament that has not finished.
              event.finalPlacement ? `Finished ${placeLabel(event.finalPlacement)}` : null,
              event.rounds ? `of ${event.rounds} scheduled` : null
            )}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setPlacing(true)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>
              {event.finalPlacement ? 'Change placement' : 'Record where you placed'}
            </Text>
          </Pressable>
        </View>

        {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}

        {games.length === 0 ? (
          <Text style={styles.hint}>
            No rounds yet. Log a game, choose Tournament, then pick {event.name} as the event.
          </Text>
        ) : (
          <View style={styles.rounds}>
            <Text style={styles.sectionLabel}>{t('event.rounds')}</Text>
            {games.map((game, index) => (
              <View key={game.id} style={styles.round}>
                <Text style={styles.roundNumber}>{index + 1}</Text>
                <View style={styles.roundBody}>
                  <GameRow game={game} onPress={() => router.push(`/game/${game.id}`)} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>{t('event.delete')}</Text>
        </Pressable>
      </ScrollView>

      <DetailsSheet
        visible={editing}
        title={t('event.details')}
        nameLabel="Name"
        namePlaceholder="Nexus Night #4"
        initialName={event.name}
        initialNotes={event.notes ?? ''}
        notesPlaceholder="How did it go? What would you change?"
        onClose={() => setEditing(false)}
        extra={
          <>
            <Text style={styles.sectionLabel}>{t('event.style')}</Text>
            <View style={styles.styleRow}>
              {EVENT_STYLES.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: style === key }}
                  // Re-tapping clears it, so an event whose tier was set by
                  // mistake can go back to having none rather than only to
                  // having a different wrong one.
                  onPress={() => setStyle(style === key ? null : key)}
                  style={({ pressed }) => [
                    styles.styleChip,
                    style === key && styles.styleChipOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.styleLabel, style === key && styles.styleLabelOn]}>
                    {eventStyleLabel(key)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        }
        onSave={(name, notes) => {
          updateEvent(id, { name, notes, eventType: style });
          setEditing(false);
          load();
        }}
      />

      {/*
        Placement reuses the same sheet, with the number in the name field.
        Parsed rather than validated away: anything unreadable clears it, which
        is the honest outcome for "I do not remember".
      */}
      <DetailsSheet
        visible={placing}
        title={t('event.placement')}
        nameLabel="Final placement"
        namePlaceholder="3"
        initialName={event.finalPlacement ? String(event.finalPlacement) : ''}
        nameRequired={false}
        initialNotes={event.rounds ? String(event.rounds) : ''}
        notesPlaceholder="Rounds scheduled, if you know"
        onClose={() => setPlacing(false)}
        onSave={(place, rounds) => {
          const parse = (value: string) => {
            const n = Number.parseInt(value.trim(), 10);
            return Number.isFinite(n) && n > 0 ? n : null;
          };
          updateEvent(id, { finalPlacement: parse(place), rounds: parse(rounds) });
          setPlacing(false);
          load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], paddingBottom: space[12] },
  card: {
    gap: space[2],
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  record: { ...text.numeric, fontSize: 26, color: color.text },
  meta: { ...text.small, color: color.textMuted },
  notes: { ...text.small, color: color.textSecondary },
  hint: { ...text.small, color: color.textMuted },
  sectionLabel: { ...text.meta, color: color.textMuted },
  rounds: { gap: space[2] },
  round: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  roundNumber: { ...text.numeric, fontSize: 13, color: color.textFaint, width: 16 },
  roundBody: { flex: 1 },
  button: {
    marginTop: space[1],
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...text.smallMedium, color: color.text },
  edit: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  editLabel: { ...text.smallMedium, color: color.text },
  delete: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { ...text.smallMedium, color: color.danger },
  styleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  styleChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  styleChipOn: { backgroundColor: color.accent, borderColor: color.text },
  styleLabel: { ...text.microMeta, color: color.textSecondary },
  styleLabelOn: { color: color.onAccent },
  pressed: { opacity: 0.8 },
});
