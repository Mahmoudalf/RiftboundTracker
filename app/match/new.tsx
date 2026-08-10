import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { GameCard } from '@/components/matches/GameCard';
import { MatchupCard, MatchupDivider } from '@/components/matches/MatchupCard';
import { DetailsSheet } from '@/components/ui/DetailsSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChoiceRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Sheet, SheetRow } from '@/components/ui/Sheet';
import { listBattlefields, listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { listDecks, loadDeckList } from '@/db/queries/decks';
import { createEvent, listEvents, type EventSummary } from '@/db/queries/events';
import { saveMatchGames } from '@/db/queries/match-games';
import {
  battlefieldFields,
  deckRecord,
  logMatch,
  opponentBattlefieldFields,
  opponentChampionFields,
  opponentFields,
  recentOpponents,
  undoMatch,
} from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import {
  BEST_OF_OPTIONS,
  EVENT_STYLES,
  MATCH_STYLES,
  type EventStyle,
  type MatchResult,
  type MatchStyle,
} from '@/db/schema/matches';
import { markLogAnother, markLogged, markSheetReady } from '@/features/matches/timing';
import { useToast } from '@/features/matches/useToast';
import { baseName, cardKey } from '@/lib/card-identity';
import { eventStyleLabel, matchStyleLabel } from '@/lib/format';
import { gameScoreLine, gamesToWin, matchProgress, visibleGames } from '@/lib/match-progress';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Log a match, top to bottom.
 *
 * The order is the design: **style → format → your deck → their deck → the
 * games.** It follows the shape of the match itself, so each answer is one you
 * already have by the time you are asked.
 *
 * That is a deliberate trade against the earlier layout, which put WIN and LOSS
 * at the top and everything optional underneath. Two taps was faster; it also
 * meant the fields that make a match *analysable* — who you played, on what,
 * going first or second — were the ones most easily skipped. A logged match
 * with no opponent is a row in a total and nothing else.
 *
 * **The result is never asked for.** It is read off the games, so it cannot
 * disagree with them, and a Bo3 recorded as 2–0 cannot also claim three games
 * were played. Games appear one at a time and stop appearing once the match is
 * settled; see `lib/match-progress`.
 */

/**
 * Styles that describe an organised event, and so can belong to a named one.
 *
 * `casual`, `online` and `testing` are left out: they are things you do, not
 * places you go, and offering to file them under a tournament would be asking a
 * question with no answer.
 */
const ORGANISED: MatchStyle[] = ['tournament'];

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style);
};

/** One card per name — art is not a distinction worth making about an opponent. */
function dedupe(cards: CardRow[]): CardRow[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = cardKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Picker = { kind: 'legend' | 'champion' } | { kind: 'theirField'; game: number };

/** One game's answers. Everything optional except, eventually, the result. */
interface GameDraft {
  result: MatchResult | null;
  onPlay: boolean | null;
  ourField: CardRow | null;
  theirField: CardRow | null;
}

const BLANK_GAME: GameDraft = { result: null, onPlay: null, ourField: null, theirField: null };

export default function LogMatchScreen() {
  const decks = useMemo(() => listDecks(), []);
  const [deckIndex, setDeckIndex] = useState(0);

  const [matchStyle, setMatchStyle] = useState<MatchStyle>('casual');
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<CardRow | null>(null);
  const [oppChampion, setOppChampion] = useState<CardRow | null>(null);
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  /* Re-read by bumping a tick rather than setting state in an effect, which
     would cascade a render on every mount. */
  const [eventsTick, setEventsTick] = useState(0);
  const [namingEvent, setNamingEvent] = useState(false);
  /**
   * The games, in order. The match result is never asked for — it falls out of
   * these, so it can never disagree with them.
   *
   * Answers are kept even when a game stops being shown. Correcting game 1 in a
   * 2–0 Bo3 brings game 3 back exactly as it was left, because nothing here
   * tracks "which game am I on" separately from the answers themselves.
   */
  const [games, setGames] = useState<GameDraft[]>([BLANK_GAME]);
  const [reviewing, setReviewing] = useState(false);
  /* The tier of the event being created. Lives here, not in the sheet, which
     only ever owns the two fields it draws itself. */
  const [newEventStyle, setNewEventStyle] = useState<EventStyle>('nexus-night');

  /** A tournament round has to say which tournament. */
  const needsEvent = matchStyle === 'tournament' && !eventId;

  const progress = matchProgress(games, bestOf);
  const shown = visibleGames(games, bestOf);
  const result = progress.result;

  const gameAt = (i: number): GameDraft => games[i] ?? BLANK_GAME;
  const openingField = gameAt(0).ourField;

  const setGame = (i: number, patch: Partial<GameDraft>) => {
    setGames((prev) => {
      // Pad rather than index-assign: a game can be revealed before the array
      // has grown to reach it.
      const next = [...prev];
      while (next.length <= i) next.push(BLANK_GAME);
      next[i] = { ...(next[i] ?? BLANK_GAME), ...patch };
      return next;
    });
  };

  const showToast = useToast((s) => s.show);
  const saving = useRef(false);
  const selected = decks[deckIndex];

  useEffect(() => {
    markSheetReady();
  }, []);

  /**
   * Our Battlefields come from the deck itself — you brought three, so those
   * are the only three you can have played. Theirs is the whole library.
   */
  const ourFields = useMemo(() => {
    const versionId = selected?.deck.currentVersionId;
    if (!versionId) return [];
    return loadDeckList(versionId)
      .slots.filter((s) => s.zone === 'battlefield')
      .map((s) => s.card);
  }, [selected]);

  const championChoices = useMemo(
    () => (opponent ? dedupe(listChampionsForLegend(opponent)) : []),
    [opponent]
  );

  /*
   * Read once on mount, not per render and not after each save.
   *
   * Logging four rounds of an event should not reshuffle the rail underneath
   * you between rounds — the round you just logged would jump to the front and
   * move everything else, and the rail's value is that its contents stay where
   * your thumb last found them.
   */
  const recent = useMemo(() => dedupe(recentOpponents()), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events: EventSummary[] = useMemo(() => listEvents(), [eventsTick]);

  const reset = () => {
    // "Log another": you are still at the same event, with the same deck and
    // Battlefields. The opponent is what changes between rounds.
    setOpponent(null);
    setOppChampion(null);
    setGames([BLANK_GAME]);
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
    /*
     * Only the games that counted.
     *
     * Answers kept behind a correction are still in state — a Bo3 corrected
     * from 2–0 to 1–1 must not save the game 3 that the first version of the
     * match never reached.
     */
    const played = games.slice(0, progress.played);
    const first = played[0];

    const id = logMatch({
      deckId: deck.id,
      deckVersionId: versionId,
      result,
      /*
       * The match-level turn order and Battlefields mirror game 1.
       *
       * These columns predate per-game logging and every analytics split reads
       * them. Game 1 is the one they always described — the opener, before
       * either player had sided — so the existing splits keep meaning what they
       * meant rather than being orphaned.
       */
      onPlay: first?.onPlay ?? null,
      bestOf,
      eventType: matchStyle,
      eventId,
      notes: notes.trim() || null,
      ...opponentFields(opponent),
      ...opponentChampionFields(oppChampion),
      ...battlefieldFields(first?.ourField ?? null),
      ...opponentBattlefieldFields(first?.theirField ?? null),
    });

    saveMatchGames(
      id,
      played.flatMap((game, i) =>
        game.result
          ? [
              {
                gameNumber: i + 1,
                result: game.result,
                onPlay: game.onPlay,
                battlefieldCardId: game.ourField?.id ?? null,
                oppBattlefieldCardId: game.theirField?.id ?? null,
              },
            ]
          : []
      )
    );

    const record = deckRecord(deck.id);
    const rate = record.total > 0 ? Math.round((record.wins / record.total) * 100) : 0;
    const version = selected.version ? ` v${selected.version.versionNumber}` : '';

    showToast(
      `Logged · ${deck.name}${version} now ${record.wins}–${record.losses} (${rate}%)`,
      // Stays up the long default: a mis-tap on a result needs time to notice.
      { action: { label: 'Undo', onPress: () => undoMatch(id) } }
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

  /**
   * The design's shapes, wrapping what the screen already computed.
   *
   * Kept as the same three helpers so the form's structure is untouched — only
   * the vocabulary changes, which is the whole difference between "recoloured"
   * and "redesigned".
   */
  const chips = <T,>(
    options: { key: string; label: string; value: T }[],
    current: T,
    onSelect: (value: T) => void
  ) => <ChoiceRow options={options} value={current} onSelect={onSelect} tall />;

  /**
   * A field that opens a picker.
   *
   * The design expands options in place, and this does for the short lists. The
   * Legend and Battlefield pickers stay modal: an inline accordion of 180
   * Legends is a scroll inside a scroll, and the picker already has search.
   */
  const field = (label: string, value: string | null, onPress: () => void, disabled = false) => (
    <SelectField
      placeholder={label}
      value={value}
      open={false}
      onToggle={onPress}
      disabled={disabled}
    />
  );

  /**
   * A section.
   *
   * The numbered step badges are gone: the design labels each block in the
   * card-footer idiom instead, which reads as a form rather than as a wizard
   * you are being marched through.
   */
  const step = (_n: number, title: string, children: React.ReactNode) => (
    <View style={styles.step}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );

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
        <View style={styles.step}>
          <SectionLabel>The matchup</SectionLabel>
          <MatchupCard
            side="you"
            title={selected?.deck.name ?? 'No deck'}
            subtitle={metaLine(
              selected?.version ? `v${selected.version.versionNumber}` : null,
              // Game 1's, the one the matchup opened on.
              openingField ? baseName(openingField.name) : null
            )}
            imageUrl={selected?.legendImageUrl ?? null}
          />
          <MatchupDivider />
          <MatchupCard
            side="them"
            title={opponent ? baseName(opponent.name) : 'Opponent not recorded'}
            subtitle={
              oppChampion
                ? baseName(oppChampion.name)
                : opponent
                  ? 'Champion not recorded'
                  : 'Skip it and the match still counts'
            }
            imageUrl={opponent?.imageUrl ?? null}
          />
        </View>

        {step(
          1,
          'Match style',
          <>
            {chips(
              MATCH_STYLES.map((key) => ({ key, label: matchStyleLabel(key), value: key })),
              matchStyle,
              (next) => {
                setMatchStyle(next);
                // A casual game is not a round of anything.
                if (!ORGANISED.includes(next)) setEventId(null);
              }
            )}

            {/*
              The event, offered only for styles that have one.
              *
              A style is a category — "a Nexus Night". An event is the instance
              — "*the* Nexus Night on the 9th", with a placement at the end.
              Casual and testing never get asked, so the fast path stays four
              taps; the ten-second budget is not spent on a field that would be
              blank for most matches.
            */}
            {ORGANISED.includes(matchStyle) ? (
              <View style={styles.eventRow}>
                <Text style={styles.fieldLabel}>Event (optional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentRail}
                  keyboardShouldPersistTaps="handled"
                >
                  {events.map((event) => {
                    const active = eventId === event.id;
                    return (
                      <Pressable
                        key={event.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${event.name}, ${event.total} rounds logged`}
                        onPress={() => {
                          haptic(Haptics.ImpactFeedbackStyle.Light);
                          setEventId(active ? null : event.id);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[styles.chipLabel, active && styles.chipLabelActive]}
                          numberOfLines={1}
                        >
                          {event.name}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New event"
                    onPress={() => setNamingEvent(true)}
                    style={({ pressed }) => [styles.chip, styles.chipAdd, pressed && styles.pressed]}
                  >
                    <Text style={styles.chipLabel}>
                      {events.length === 0 ? '+  New event' : '+'}
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}
          </>
        )}

        {step(
          2,
          'Best of',
          chips<number | null>(
            [
              { key: 'none', label: '—', value: null },
              ...BEST_OF_OPTIONS.map((n) => ({ key: String(n), label: `Bo${n}`, value: n })),
            ],
            bestOf,
            setBestOf
          )
        )}

        {step(
          3,
          'Your deck',
          <>
            {decks.length > 1
              ? chips(
                  decks.map((d, i) => ({
                    key: d.deck.id,
                    label: d.deck.name,
                    value: i,
                  })),
                  deckIndex,
                  (i) => {
                    setDeckIndex(i);
                    // The old deck's Battlefields are not in the new one.
                    setGames((prev) => prev.map((g) => ({ ...g, ourField: null })));
                  }
                )
              : (
                <Text style={styles.single}>{selected?.deck.name}</Text>
              )}
          </>
        )}

        {step(
          4,
          'Their deck',
          <>
            <Text style={styles.fieldLabel}>Legend</Text>

            {/*
              The rail exists for one situation: logging a tournament's rounds
              one after another, where the Legend you are about to record is
              usually one you have faced recently. Opening a 180-card picker for
              that is most of the ten-second budget spent on the field least
              likely to be new.

              Above the picker rather than inside it — a shortcut you have to
              open something to reach is not a shortcut.
            */}
            {recent.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentRail}
                keyboardShouldPersistTaps="handled"
              >
                {recent.map((card) => {
                  const active = opponent?.id === card.id;
                  return (
                    <Pressable
                      key={card.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${baseName(card.name)}, recently faced`}
                      onPress={() => {
                        haptic(Haptics.ImpactFeedbackStyle.Light);
                        // Re-tapping clears, so a mis-tap costs one tap rather
                        // than a trip through the picker to undo.
                        setOpponent(active ? null : card);
                        setOppChampion(null);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[styles.chipLabel, active && styles.chipLabelActive]}
                        numberOfLines={1}
                      >
                        {baseName(card.name)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {field(
              'Legend',
              opponent ? baseName(opponent.name) : null,
              () => setPicker({ kind: 'legend' })
            )}

            <Text style={styles.fieldLabel}>Chosen Champion</Text>
            {field(
              'Champion',
              oppChampion ? baseName(oppChampion.name) : null,
              () => setPicker({ kind: 'champion' }),
              !opponent
            )}
          </>
        )}

        {/*
          The games, one card at a time.

          A game appears once the one before it is answered, and stops appearing
          the moment the match can no longer turn on it — a Bo3 at 2–0 has no
          third game, so there is no form to record one. The match result is
          never asked for; it is read off these below.
        */}
        <View style={styles.games}>
          {Array.from({ length: shown }, (_, i) => {
            const game = gameAt(i);
            return (
              <GameCard
                key={i}
                title={(bestOf ?? 1) > 1 ? `Game ${i + 1}` : 'The game'}
                summary={metaLine(
                  game.result === 'win'
                    ? 'W'
                    : game.result === 'loss'
                      ? 'L'
                      : game.result === 'draw'
                        ? 'D'
                        : '—',
                  game.onPlay === null ? 'first player not set' : game.onPlay ? 'I did' : 'They did'
                )}
                onPlay={game.onPlay}
                onChangeOnPlay={(value) => setGame(i, { onPlay: value })}
                ourFields={ourFields}
                ourField={game.ourField}
                onChangeOurField={(value) => setGame(i, { ourField: value })}
                theirField={game.theirField}
                onPickTheirField={() => setPicker({ kind: 'theirField', game: i })}
                result={game.result}
                onChangeResult={(value) => {
                  haptic(Haptics.ImpactFeedbackStyle.Light);
                  setGame(i, { result: value });
                }}
              />
            );
          })}
        </View>

        {/*
          Before the result, not after it.

          Continue is the last thing on the screen because it is the last thing
          you do. With the note below it, the only field you would reach *after*
          the button that leaves is one you would never see.
        */}
        <View style={styles.step}>
          <Text style={styles.fieldLabel}>Note</Text>
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

        {step(
          5,
          'Result',
          <>
            {/*
              A tournament round belongs to a tournament.
              *
              The only place the app stops short of saving, and narrowly: the
              style says this was an organised event, so there is one to name.
              Recoverable in a tap by choosing a different style, which is why
              this is a missing answer rather than a judgement about the deck.
            */}
            {needsEvent ? (
              <Text style={styles.needsEvent}>
                Pick an event above, or change the style to Casual or Online.
              </Text>
            ) : null}

            {/* Read back, not asked. Two places holding the same fact is how
                they come to disagree. */}
            <View style={styles.outcome}>
              <Text style={styles.outcomeValue}>
                {result === 'win'
                  ? 'Win'
                  : result === 'loss'
                    ? 'Loss'
                    : result === 'draw'
                      ? 'Draw'
                      : 'Still playing'}
              </Text>
              <Text style={styles.outcomeMeta}>
                {gameScoreLine(games, bestOf) ?? 'No games logged yet'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to review"
              disabled={!result || needsEvent}
              onPress={() => setReviewing(true)}
              style={({ pressed }) => [
                styles.continue,
                (!result || needsEvent) && styles.continueDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueLabel}>Continue</Text>
            </Pressable>

            <Text style={styles.hint}>
              {result
                ? 'Nothing is saved yet — the next screen reads the match back first.'
                : `Answer each game above. ${gamesToWin(bestOf)} won takes the match.`}
            </Text>
          </>
        )}
      </ScrollView>

      {/*
        Name it and carry on. An event gathers its rounds as you log them, so
        the only thing needed up front is something to call it — rounds played,
        record, and where you placed all arrive later, on the event itself.
      */}
      <DetailsSheet
        visible={namingEvent}
        title="New event"
        nameLabel="Name"
        namePlaceholder="Nexus Night #4"
        initialName=""
        initialNotes=""
        notesPlaceholder="Where is it? Anything worth remembering later."
        onClose={() => setNamingEvent(false)}
        extra={
          <>
            <Text style={styles.fieldLabel}>Event style</Text>
            {chips(
              EVENT_STYLES.map((key) => ({ key, label: eventStyleLabel(key), value: key })),
              newEventStyle,
              setNewEventStyle
            )}
          </>
        }
        onSave={(name, location) => {
          const id = createEvent({ name, eventType: newEventStyle, location });
          setNamingEvent(false);
          setEventId(id);
          setEventsTick((t) => t + 1);
        }}
      />

      {/*
        Read the match back before committing it.
        *
        Everything skipped is named as "not recorded" rather than omitted — the
        difference between a field the user chose to leave blank and one the app
        quietly forgot to ask about.
      */}
      <Sheet
        visible={reviewing}
        title="Review before saving"
        subtitle={'Anything you skipped is stored as "not recorded", never guessed.'}
        onClose={() => setReviewing(false)}
        actions={
          <>
            {matchStyle === 'tournament' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setReviewing(false);
                  if (result) save(result, true);
                }}
                style={({ pressed }) => [styles.sheetSecondary, pressed && styles.pressed]}
              >
                <Text style={styles.sheetSecondaryLabel}>Log next round</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setReviewing(false);
                if (result) save(result, false);
              }}
              style={({ pressed }) => [styles.sheetPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.sheetPrimaryLabel}>Finalize</Text>
            </Pressable>
          </>
        }
      >
        <View style={styles.outcome}>
          <SectionLabel>Match outcome</SectionLabel>
          <Text style={styles.outcomeValue}>
            {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Draw'}
          </Text>
          {/* Derived from the games — never asked for twice. */}
          <Text style={styles.outcomeMeta}>
            {metaLine(gameScoreLine(games, bestOf), 'derived from the games')}
          </Text>
        </View>

        <SheetRow label="Deck" value={selected?.deck.name ?? 'None'} />
        <SheetRow
          label="Opponent"
          value={
            opponent
              ? `${baseName(opponent.name)}${oppChampion ? ` · ${baseName(oppChampion.name)}` : ''}`
              : 'Not recorded'
          }
        />
        <SheetRow
          label="Format"
          value={metaLine(matchStyleLabel(matchStyle), bestOf ? `Bo${bestOf}` : 'Best of not recorded')}
          mono
        />
        {/* Every game gets its own line. A Bo3 read back as one turn order and
            one pair of Battlefields would be describing a game that was only a
            third of the match. */}
        {games.slice(0, progress.played).map((game, i) => (
          <SheetRow
            key={i}
            label={(bestOf ?? 1) > 1 ? `Game ${i + 1}` : 'The game'}
            value={metaLine(
              game.result === 'win' ? 'Won' : game.result === 'loss' ? 'Lost' : 'Drew',
              game.onPlay === null
                ? 'went first not recorded'
                : game.onPlay
                  ? 'you went first'
                  : 'they went first',
              game.ourField ? baseName(game.ourField.name) : 'yours not recorded',
              game.theirField ? baseName(game.theirField.name) : 'theirs not recorded'
            )}
          />
        ))}
        {eventId ? (
          <SheetRow
            label="Event"
            value={events.find((e) => e.id === eventId)?.name ?? 'Event'}
          />
        ) : null}
        {notes.trim() ? <SheetRow label="Note" value={notes.trim()} /> : null}
      </Sheet>

      <CardPickerSheet
        visible={picker !== null}
        title={
          picker?.kind === 'legend'
            ? 'Their Legend'
            : picker?.kind === 'champion'
              ? 'Their Chosen Champion'
              : 'Battlefield they played'
        }
        subtitle={
          picker?.kind === 'champion' && opponent
            ? `Champions that partner ${baseName(opponent.name)}`
            : picker?.kind === 'theirField' && (bestOf ?? 1) > 1
              ? `Game ${picker.game + 1}`
              : undefined
        }
        cards={
          picker?.kind === 'legend'
            ? dedupe(listLegends())
            : picker?.kind === 'champion'
              ? championChoices
              : picker?.kind === 'theirField'
                ? dedupe(listBattlefields())
                : []
        }
        selectedId={
          picker?.kind === 'legend'
            ? (opponent?.id ?? null)
            : picker?.kind === 'champion'
              ? (oppChampion?.id ?? null)
              : picker?.kind === 'theirField'
                ? (gameAt(picker.game).theirField?.id ?? null)
                : null
        }
        emptyMessage={
          picker?.kind === 'champion'
            ? 'No Champion Unit in the library partners that Legend.'
            : 'The card library has not finished downloading.'
        }
        onSelect={(card) => {
          if (picker?.kind === 'legend') {
            setOpponent(card);
            setOppChampion(null);
          } else if (picker?.kind === 'champion') {
            setOppChampion(card);
          } else if (picker?.kind === 'theirField') {
            setGame(picker.game, { theirField: card });
          }
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[16], gap: space[6] },
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.raised,
  },
  closeLabel: { ...text.smallMedium, color: color.text },

  step: { gap: space[2] },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepNumber: {
    ...text.numeric,
    fontSize: 11,
    color: color.bg,
    backgroundColor: color.textMuted,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    textAlign: 'center',
    lineHeight: 18,
  },
  stepTitle: { ...text.meta, color: color.textSecondary },
  fieldLabel: { ...text.microMeta, color: color.textMuted, paddingTop: space[1] },
  single: { ...text.bodyMedium, color: color.text },
  hint: { ...text.microMeta, color: color.textFaint },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // Scrolls rather than wraps: eight Legend names would be three rows tall, and
  // this sits in the middle of a six-step form.
  recentRail: { flexDirection: 'row', gap: space[2], paddingRight: space[4] },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipActive: { backgroundColor: color.accent, borderColor: color.text },
  chipAdd: { borderStyle: 'dashed' },
  eventRow: { gap: space[2], paddingTop: space[1] },
  continue: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[3],
  },
  continueDisabled: { opacity: 0.4 },
  continueLabel: { ...text.bodyMedium, color: color.onAccent },
  outcome: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: space[4],
    marginBottom: space[3],
  },
  outcomeValue: { ...text.title, fontSize: 22, color: color.text },
  outcomeMeta: { ...text.microMeta, color: color.textFaint, paddingTop: space[1] },
  games: { gap: space[3] },
  sheetPrimary: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryLabel: { ...text.bodyMedium, color: color.onAccent },
  sheetSecondary: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryLabel: { ...text.bodyMedium, color: color.textSecondary },
  needsEvent: { ...text.microMeta, color: color.warning, paddingBottom: space[2] },
  resultsBlocked: { opacity: 0.4 },
  chipLabel: { ...text.small, color: color.textSecondary },
  chipLabelActive: { color: color.onAccent },

  field: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  fieldDisabled: { opacity: 0.45 },
  fieldValue: { ...text.small, color: color.text },
  fieldPlaceholder: { ...text.small, color: color.textFaint },

  results: { flexDirection: 'row', gap: space[3] },
  result: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  win: { borderColor: color.win, backgroundColor: color.surface },
  loss: { borderColor: color.loss, backgroundColor: color.surface },
  resultPressed: { opacity: 0.6 },
  resultLabel: { ...text.display, fontSize: 26, color: color.text },
  tertiary: { alignItems: 'center' },
  draw: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space[6] },
  drawLabel: { ...text.small, color: color.textMuted },

  notes: {
    ...text.small,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[3],
    minHeight: 64,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.75 },
});
