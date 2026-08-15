import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { MatchReadback } from '@/components/games/MatchReadback';
import { MatchupCard, MatchupDivider } from '@/components/games/MatchupCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChoiceRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  cardsByIds,
  getCard,
  listChampionsForLegend,
  listLegends,
} from '@/db/queries/cards';
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
import { useT, type Key } from '@/i18n';
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

/*
 * Result → catalogue key, not result → English.
 *
 * These three sit in a `ChoiceRow`: equal thirds of the screen, one line, no
 * wrap. It is the tightest container in the app and the first place a
 * translation breaks — natural German for "Draw" is `Unentschieden`, which does
 * not fit and is deliberately shortened in `de.ts`.
 */
const RESULTS = [
  { key: 'win', label: 'game.result.win' },
  { key: 'loss', label: 'game.result.loss' },
  { key: 'draw', label: 'game.result.draw' },
] as const satisfies readonly { key: Result; label: Key }[];

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

/*
 * `MatchSummary` lived here — one match rendered as a sentence.
 *
 * It was written when this screen was the only thing reading the `matches`
 * table back, and prose was the argument: a record being checked against
 * memory, not a control being operated. Replaced by `MatchReadback` because
 * the sentence turned out to be wrong three times over, not merely plain:
 *
 * - It printed `openingHand` under the word **"Kept"**. That column stopped
 *   meaning "the cards kept" and started meaning the whole deal, so every card
 *   sent back was listed as kept *and* as sent back, in one sentence.
 * - It joined names with `, ` — and Riftbound names are `Name, Epithet`. A hand
 *   holding two "Kayle, Justified" read as four separate items.
 * - It never showed `replacements` at all.
 *
 * The replacement shows the same facts as tiles, in the order and the visual
 * language the log form uses to capture them.
 */

export default function GameDetailScreen() {
  const t = useT();
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
      <Screen title={t('game.title')}>
        <EmptyState
          title={t('game.notFound.title')}
          body={t('game.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const deck = getDeck(game.deckId);
  const version = getVersion(game.deckVersionId);
  /*
   * The Legend's art, for our side of the matchup.
   *
   * Read from the deck's Legend rather than stored on the game: the deck is
   * what played, and a game that outlives a printing leaving the library should
   * lose the picture, not the record. Null simply draws the plate.
   */
  const ourLegend = deck?.legendCardId ? getCard(deck.legendCardId) : null;
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

  /*
   * Every printing any recorded hand refers to, in one query.
   *
   * `mulliganed` is included even though it is meant to be a subset of
   * `openingHand`: rows written before that redefinition hold the two as
   * disjoint sets, and `HandReadback` reconstructs the deal from both — so the
   * ids it may need to draw are the union, not the deal alone.
   */
  const handCards = cardsByIds(
    matches.flatMap((m) => [
      ...(m.openingHand ?? []),
      ...(m.mulliganed ?? []),
      ...(m.replacements ?? []),
    ])
  );

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
    Alert.alert(t('game.deleteTitle'), t('game.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteGame(id);
          router.back();
        },
      },
    ]);
  };

  /*
   * `chipRow` lived here — the screen's own segmented control.
   *
   * Deleted in favour of `ChoiceRow`, the design's. The local one sized each
   * chip to its label, so a row's cells came out at three different widths and
   * stopped short of the screen: measured on this screen at 120/137/142 for
   * Win-Loss-Draw, 93/119/126 for the Best-of row, and 166/160/**256** for the
   * game styles, all against a 945px screen they left a third of empty. The
   * design's control is `flex: 1` at a fixed height, so every option in a row is
   * the same target whatever it is called — and the log form has been using it
   * since the retheme, which is why the two screens stopped looking related.
   */

  return (
    /*
     * The header names the *screen*, not the opponent.
     *
     * It used to set the opponent's Legend in the 30px display face — so a game
     * against "Draven - Glorious Executioner" spent two wrapped lines saying
     * something the `OPPONENT'S LEGEND` field twenty points below said again,
     * and the deck that actually played was demoted to metadata. The matchup
     * belongs in the two cards under it, where both sides get equal weight and
     * the art that makes either recognisable.
     */
    <Screen
      title={t('game.title')}
      meta={metaLine(
        deck?.name,
        version ? `v${version.versionNumber}` : null,
        gameDate(game.playedAt)
      )}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/*
          Who played whom, before anything is asked about it — the same pair of
          cards the log form opens with, so the game is read back in the shape
          it was entered.
        */}
        <View style={styles.section}>
          <SectionLabel>{t('game.section.matchup')}</SectionLabel>
          <MatchupCard
            side="you"
            title={deck?.name ?? t('game.deckDeleted')}
            subtitle={metaLine(
              version ? `v${version.versionNumber}` : null,
              game.battlefieldName ? baseName(game.battlefieldName) : null
            )}
            imageUrl={ourLegend?.imageUrl ?? null}
          />
          <MatchupDivider />
          <MatchupCard
            side="them"
            title={
              game.oppLegendName ? baseName(game.oppLegendName) : t('game.opponentNotRecorded')
            }
            subtitle={
              game.oppChampionName
                ? baseName(game.oppChampionName)
                : game.oppLegendName
                  ? t('game.championNotRecorded')
                  : t('game.countsWithoutOpponent')
            }
            imageUrl={oppLegendCard?.imageUrl ?? null}
          />
        </View>

        <View style={styles.section}>
          <SectionLabel>{t('game.section.result')}</SectionLabel>
          <ChoiceRow<Result>
            options={RESULTS.map((r) => ({ key: r.key, label: t(r.label), value: r.key }))}
            value={game.result}
            onSelect={(value) => patch({ result: value })}
            tall
          />
        </View>

        <View style={styles.section}>
          <SectionLabel>{t('game.section.oppLegend')}</SectionLabel>
          <SelectField
            placeholder={t('common.notRecorded')}
            value={game.oppLegendName ? baseName(game.oppLegendName) : null}
            open={false}
            onToggle={() => setPicker('legend')}
          />
          {game.oppLegendCardId && !oppLegendCard ? (
            <Text style={styles.warning}>{t('game.legendGone')}</Text>
          ) : null}
        </View>

        {game.oppLegendName ? (
          <View style={styles.section}>
            <SectionLabel>{t('game.section.oppChampion')}</SectionLabel>
            <SelectField
              placeholder={
                oppLegendCard ? t('common.notRecorded') : t('game.legendNotInLibrary')
              }
              value={game.oppChampionName ? baseName(game.oppChampionName) : null}
              open={false}
              onToggle={() => setPicker('champion')}
              disabled={!oppLegendCard}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>{t('game.section.bestOf')}</SectionLabel>
          {/*
            `—` survives here and not on the log form.

            The form's job is to record a game being played, where the format
            is always known — the design is explicit that it never defaults to
            unset. This screen's job is to correct the record, and "I do not
            actually know" is a correction someone is entitled to make.
          */}
          <ChoiceRow<number | null>
            options={withCurrent<number | null>(
              [
                { key: 'none', label: '—', value: null },
                ...BEST_OF_OPTIONS.map((n) => ({ key: String(n), label: `Bo${n}`, value: n })),
              ],
              game.bestOf,
              (value) => `Bo${value}`
            )}
            value={game.bestOf}
            onSelect={(value) => patch({ bestOf: value })}
            tall
          />
        </View>

        <View style={styles.section}>
          <SectionLabel>{t('game.section.gameStyle')}</SectionLabel>
          <ChoiceRow<GameStyle>
            options={withCurrent<GameStyle>(
              LOGGED_GAME_STYLES.map((key) => ({
                key,
                label: gameStyleLabel(key),
                value: key,
              })),
              game.gameStyle,
              gameStyleLabel
            )}
            value={game.gameStyle}
            onSelect={(value) => patch({ gameStyle: value })}
            tall
          />
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
            <SectionLabel>{t('game.section.event')}</SectionLabel>
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
                {recordLine(event.wins, event.losses, event.draws) ?? t('game.noRounds')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>
            {matches.length === 1 ? t('game.section.theGame') : t('game.section.theMatches')}
          </SectionLabel>
          {matches.length === 0 ? (
            <Text style={styles.footnote}>{t('game.noMatches')}</Text>
          ) : (
            <View style={styles.matches}>
              {matches.map((m) => (
                <MatchReadback
                  key={m.id}
                  match={m}
                  title={
                    matches.length === 1
                      ? t('game.section.theGame')
                      : t('game.matchNumber', { number: m.matchNumber })
                  }
                  cards={handCards}
                  names={cardNames}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('game.depth.a11y')}
                onPress={() => router.push(`/game/${id}/matches`)}
                style={({ pressed }) => [styles.depth, pressed && styles.pressed]}
              >
                <Text style={styles.depthLabel}>
                  {recordedDepth ? t('game.depth.edit') : t('game.depth.add')}
                </Text>
                {/*
                  "Champion turns" was listed here until now. That field went
                  with migration 19 — the column was dropped — so the button
                  advertised a thing the screen behind it cannot record.
                */}
                <Text style={styles.depthMeta}>{t('game.depth.meta')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>{t('game.section.note')}</SectionLabel>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => patch({ notes: notes.trim() || null })}
            placeholder={t('game.notePlaceholder')}
            placeholderTextColor={color.textFaint}
            style={styles.notes}
            multiline
            accessibilityLabel={t('game.note.a11y')}
          />
        </View>

        <Text style={styles.footnote}>{t('game.versionLocked')}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>{t('game.delete')}</Text>
        </Pressable>
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={
          picker === 'legend' ? t('game.section.oppLegend') : t('game.section.oppChampion')
        }
        cards={picker === 'legend' ? listLegends() : championChoices()}
        selectedId={
          picker === 'legend' ? game.oppLegendCardId : game.oppChampionCardId
        }
        emptyMessage={t('game.nothingToChoose')}
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
  matches: { gap: space[3] },
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
