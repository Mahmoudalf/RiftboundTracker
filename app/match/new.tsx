import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { GameCard } from '@/components/matches/GameCard';
import { MatchupCard, MatchupDivider } from '@/components/matches/MatchupCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChoiceRow, OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Sheet, SheetRow } from '@/components/ui/Sheet';
import { listBattlefields, listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { listDecks, loadDeckList } from '@/db/queries/decks';
import { eventForName } from '@/db/queries/events';
import { saveMatchGames } from '@/db/queries/match-games';
import {
  battlefieldFields,
  deckRecord,
  logMatch,
  opponentBattlefieldFields,
  opponentChampionFields,
  opponentFields,
  undoMatch,
} from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import {
  BEST_OF_OPTIONS,
  DEFAULT_BEST_OF,
  LOGGED_MATCH_STYLES,
  type MatchResult,
  type MatchStyle,
} from '@/db/schema/matches';
import { markLogAnother, markLogged, markSheetReady } from '@/features/matches/timing';
import { useToast } from '@/features/matches/useToast';
import { baseName, cardKey } from '@/lib/card-identity';
import { matchStyleLabel } from '@/lib/format';
import { gameScoreLine, gamesToWin, matchProgress, visibleGames } from '@/lib/match-progress';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Log a match, top to bottom.
 *
 * The order is the design's: **the matchup → how it was played → your deck →
 * their deck → the games → what came of it.** It follows the shape of the match
 * itself, so each answer is one you already have by the time you are asked.
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
 *
 * ---
 *
 * Built to the Hi-Fi design's `1_Current ML` screen and the three changes in
 * its `design_handoff_match_log_form` note. What those changes removed:
 *
 * - **The event picker.** Was a rail of chips over existing events plus a "+"
 *   that opened a naming sheet. Now one free-text field: type the tournament's
 *   name and every round typed under the same name groups itself (see
 *   `eventForName`). Optional, so a tournament round no longer blocks on it.
 * - **Bo5 and "not recorded".** Riftbound is Bo1 or Bo3, and a match with no
 *   format recorded could not say how many games it took. Always one of the two
 *   now, defaulting to Bo1.
 * - **The recent-opponent rail.** A row of chips above the Legend field. The
 *   design leaves only the field.
 */

/**
 * Styles that describe an organised event, and so can belong to a named one.
 *
 * `casual` and `online` are left out: they are things you do, not places you
 * go, and offering to file them under a tournament would be asking a question
 * with no answer.
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
  const [bestOf, setBestOf] = useState<number>(DEFAULT_BEST_OF);
  const [opponent, setOpponent] = useState<CardRow | null>(null);
  const [oppChampion, setOppChampion] = useState<CardRow | null>(null);
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  /**
   * The tournament's name, as typed.
   *
   * A name, not an id: the design's field creates or matches an event by what
   * you call it, and resolving that to a row at save time means the name you
   * are looking at is always the one being written. Holding an id here instead
   * would let the field show one tournament while the match joined another.
   */
  const [eventName, setEventName] = useState('');
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
  const [deckOpen, setDeckOpen] = useState(false);

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

    /*
     * Resolve the typed name to an event, here rather than as you type.
     *
     * Creating one per keystroke would leave a trail of half-typed tournaments
     * behind every abandoned log. Only a match that is actually being saved is
     * evidence that its event exists. Styles that are not organised play never
     * carry one, however the field was left.
     */
    const eventId = ORGANISED.includes(matchStyle) ? eventForName(eventName) : null;

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
      <Screen title="Log a match" back={false} compact>
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
      compact
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
        <View style={styles.block}>
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

        <View style={styles.block}>
          <SectionLabel>Match style</SectionLabel>
          <ChoiceRow<MatchStyle>
            options={LOGGED_MATCH_STYLES.map((key) => ({
              key,
              label: matchStyleLabel(key),
              value: key,
            }))}
            value={matchStyle}
            onSelect={(next) => {
              haptic(Haptics.ImpactFeedbackStyle.Light);
              setMatchStyle(next);
            }}
            tall
          />

          {/*
            The event, offered only for styles that have one.

            Free text rather than a picker: an event is created by naming it,
            and every round typed under the same name joins the same one. That
            is the whole mechanism — there is nothing to pick from before the
            first round of a tournament has been logged, which is exactly when
            the old picker was emptiest.

            Optional, which is a change of rule as well as of control: a
            tournament round used to refuse to save without an event. It saves
            now, and simply records no event, because "which tournament" is a
            detail about a match that certainly happened.
          */}
          {ORGANISED.includes(matchStyle) ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Event (optional)</Text>
              <TextInput
                value={eventName}
                onChangeText={setEventName}
                placeholder="Nexus Night #4"
                placeholderTextColor={color.textMuted}
                style={styles.input}
                autoCapitalize="words"
                accessibilityLabel="Event name"
              />
              <Text style={styles.helper}>
                Name this tournament — every round and game logged under it will be grouped
                together.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <SectionLabel>Best of</SectionLabel>
          <ChoiceRow<number>
            options={BEST_OF_OPTIONS.map((n) => ({ key: String(n), label: `Bo${n}`, value: n }))}
            value={bestOf}
            onSelect={(next) => {
              haptic(Haptics.ImpactFeedbackStyle.Light);
              setBestOf(next);
            }}
            tall
          />
        </View>

        <View style={styles.block}>
          <SectionLabel>Your deck</SectionLabel>
          {/*
            One deck is a statement, several are a question.

            The design draws the single-deck case, which is a name and nothing
            else. With more than one there has to be a way to say which played,
            and the field the design already uses for exactly that — a 52px row
            that opens its options in place — is the one borrowed here.
          */}
          {decks.length > 1 ? (
            <SelectField
              placeholder="Choose a deck"
              value={selected ? selected.deck.name : null}
              open={deckOpen}
              onToggle={() => setDeckOpen((o) => !o)}
            >
              {decks.map((d, i) => (
                <OptionRow
                  key={d.deck.id}
                  label={d.deck.name}
                  meta={d.version ? `v${d.version.versionNumber}` : null}
                  selected={i === deckIndex}
                  onPress={() => {
                    setDeckIndex(i);
                    setDeckOpen(false);
                    // The old deck's Battlefields are not in the new one.
                    setGames((prev) => prev.map((g) => ({ ...g, ourField: null })));
                  }}
                />
              ))}
            </SelectField>
          ) : (
            <Text style={styles.single}>{selected?.deck.name}</Text>
          )}
        </View>

        {/*
          Their Legend and Champion, each labelled and nothing above them.

          The quick-select rail of recently-faced Legends is gone with the
          design's third change. It was a real shortcut for logging a
          tournament's rounds back to back, and it cost a row of chips in the
          middle of the form to buy it.
        */}
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Legend</Text>
            <SelectField
              placeholder="Choose a Legend"
              value={opponent ? baseName(opponent.name) : null}
              open={false}
              onToggle={() => setPicker({ kind: 'legend' })}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Chosen Champion</Text>
            <SelectField
              placeholder={opponent ? 'Choose a Champion' : 'Pick a Legend first'}
              value={oppChampion ? baseName(oppChampion.name) : null}
              open={false}
              onToggle={() => setPicker({ kind: 'champion' })}
              disabled={!opponent}
            />
          </View>
        </View>

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
                title={bestOf > 1 ? `Game ${i + 1}` : 'The game'}
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
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering"
            placeholderTextColor={color.textMuted}
            style={styles.notes}
            multiline
            accessibilityLabel="Match note"
          />
        </View>

        {/* Read back, not asked. Two places holding the same fact is how they
            come to disagree. */}
        <View>
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
              {result
                ? metaLine(gameScoreLine(games, bestOf), 'derived from the games')
                : 'No games logged yet'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to review"
            disabled={!result}
            onPress={() => setReviewing(true)}
            style={({ pressed }) => [
              styles.continue,
              !result && styles.continueDisabled,
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
        </View>
      </ScrollView>

      {/*
        Read the match back before committing it.

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
            {/* Only an organised style has a next round to log. */}
            {ORGANISED.includes(matchStyle) ? (
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
        <View style={styles.sheetOutcome}>
          <SectionLabel>Match outcome</SectionLabel>
          <Text style={styles.sheetOutcomeValue}>
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
          value={metaLine(matchStyleLabel(matchStyle), `Bo${bestOf}`)}
          mono
        />
        {/* Every game gets its own line. A Bo3 read back as one turn order and
            one pair of Battlefields would be describing a game that was only a
            third of the match. */}
        {games.slice(0, progress.played).map((game, i) => (
          <SheetRow
            key={i}
            label={bestOf > 1 ? `Game ${i + 1}` : 'The game'}
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
        {ORGANISED.includes(matchStyle) ? (
          <SheetRow label="Event" value={eventName.trim() || 'Not recorded'} />
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
            : picker?.kind === 'theirField' && bestOf > 1
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
  body: { paddingBottom: space[16], gap: space[5] },

  // 36px pill, per the design's header.
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.raised,
  },
  closeLabel: {
    ...text.caption,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: color.textSecondary,
  },

  /** A titled section — `THE MATCHUP`, `BEST OF`. */
  block: { gap: space[2] },
  /** One labelled control. Between them the design leaves 18px. */
  fields: { gap: 18 },
  field: { gap: space[2] },
  fieldLabel: { ...text.fieldLabel, color: color.textFaint },
  /** The sentence under a field explaining what it does. */
  helper: { ...text.caption, fontSize: 10.5, lineHeight: 15, color: color.textHint },
  single: { ...text.bodyMedium, color: color.text },
  hint: {
    ...text.caption,
    fontSize: 11,
    lineHeight: 16,
    color: color.textHint,
    paddingTop: 10,
    paddingBottom: space[1],
  },

  /** 52px, matching `SelectField` — the design's one field height. */
  input: {
    ...text.body,
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: color.text,
  },

  games: { gap: space[3] },

  outcome: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: space[4],
  },
  outcomeValue: { ...text.title, fontSize: 22, color: color.text },
  outcomeMeta: {
    ...text.caption,
    fontSize: 11,
    lineHeight: 15,
    color: color.textMuted,
    paddingTop: space[1],
  },
  sheetOutcome: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    marginBottom: space[3],
  },
  // 17px in the sheet against 22px on the form: in the sheet it is one row of a
  // read-back, on the form it is the answer the whole screen was building to.
  sheetOutcomeValue: {
    ...text.subtitle,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: color.text,
    paddingTop: space[1.5],
  },

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

  notes: {
    ...text.small,
    lineHeight: 19.5,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: space[3],
    minHeight: 64,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.75 },
});
