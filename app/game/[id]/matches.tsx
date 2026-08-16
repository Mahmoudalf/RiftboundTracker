import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { MatchDetailCard, type MatchDetailValue } from '@/components/games/MatchDetailCard';
import {
  applyDealt,
  applyMulligan,
  applyReplacements,
  BLANK_HAND,
  DEAL_SIZE,
  handCounts,
  MAX_RECYCLED,
  OpeningHand,
  type Counts,
  type OpeningHandValue,
} from '@/components/games/OpeningHand';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { getCard } from '@/db/queries/cards';
import { getDeck, loadDeckList } from '@/db/queries/decks';
import { getGame } from '@/db/queries/games';
import { listMatches, saveMatches } from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import type { MatchRow } from '@/db/schema/games';
import { TOAST_CONFIRM_MS, useToast } from '@/features/games/useToast';
import { useT } from '@/i18n';
import { baseName, cardKey } from '@/lib/card-identity';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * In-depth detail for a game already logged.
 *
 * The second way in. The log form's **Advanced** mode records all of this while
 * the game is still in front of you; this screen is for the game logged in
 * Simplified mode and filled in afterwards, and for correcting what was entered
 * at the table.
 *
 * Both write the same rows through the same `OpeningHand` control, deliberately.
 * The deal / mulligan / replacement rules are the part that has to stay right,
 * and two hand editors would be two places for them to drift apart.
 *
 * **This screen adds no matches and removes none.** The set of matches is what
 * was logged, because the number played is a fact about the game and the game
 * result is derived from it (`lib/game-progress`). Letting this screen invent a
 * match 3 would let the detail pass contradict the record it is detail *about*.
 *
 * Saving rewrites every match row in one transaction — `saveMatches` replaces
 * rather than diffs — so the screen holds a full draft and commits it once.
 */

/** A row being edited: which match, and which of its three rows. */
type Picker = { kind: 'dealt' | 'mulligan' | 'replacement'; match: number };

interface Draft {
  score: MatchDetailValue;
  hand: OpeningHandValue;
}

/**
 * `t` is a parameter rather than a module-scope import.
 *
 * This helper sits outside the component, so it cannot call `useT()`; taking
 * the translate function makes the dependency visible at the one call site
 * instead of shadowing the component's own `t` from module scope.
 */
function turnOrderLabel(onPlay: boolean | null, t: ReturnType<typeof useT>): string | null {
  if (onPlay === null) return null;
  return t(onPlay ? 'match.onPlay' : 'match.onDraw');
}

/**
 * Rebuild an editable hand from the stored ids.
 *
 * A card the mirror can no longer resolve comes back as `null`, which renders
 * as an empty slot rather than as the wrong card. That does lose the id on the
 * next save — stated rather than hidden, and the alternative is showing a slot
 * the user can neither identify nor correct.
 */
function draftHand(match: MatchRow): OpeningHandValue {
  if (match.openingHand === null && match.mulliganed === null) return BLANK_HAND;

  const dealt = (match.openingHand ?? []).map((id) => getCard(id));
  // Always at least four slots, and never fewer than were recorded.
  const padded = [...dealt, null, null, null, null].slice(0, Math.max(4, dealt.length));
  const mulliganed = (match.mulliganed ?? [])
    .map((id) => dealt.findIndex((card) => card?.id === id))
    .filter((index) => index >= 0);

  return {
    dealt: padded,
    mulliganed,
    replacements: (match.replacements ?? []).map((id) => getCard(id)),
  };
}

export default function GameMatchesScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useToast((s) => s.show);

  const game = useMemo(() => getGame(id), [id]);
  const matches = useMemo(() => (game ? listMatches(id) : []), [id, game]);

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    matches.map((match) => ({
      score: { scoreFor: match.scoreFor, scoreAgainst: match.scoreAgainst },
      hand: draftHand(match),
    }))
  );
  const [picker, setPicker] = useState<Picker | null>(null);

  /**
   * Main deck **and the Chosen Champion**, which is not the same as `main`.
   *
   * `DeckList` keeps the designated Champion in its own zone, but the rules put
   * its copy in the Main Deck (103.2.b.1) — which is why the 3-copy limit
   * counts it. It can be dealt, so it has to be pickable.
   */
  const deckPool = useMemo<CardRow[]>(() => {
    if (!game) return [];
    const seen = new Set<string>();
    return loadDeckList(game.deckVersionId)
      .slots.filter((slot) => slot.zone === 'main' || slot.zone === 'champion')
      .map((slot) => slot.card)
      .filter((card) => {
        const key = cardKey(card);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => baseName(a.name).localeCompare(baseName(b.name)));
  }, [game]);

  if (!game) {
    return (
      <Screen title={t('detail.title')}>
        <EmptyState
          title={t('game.notFound.title')}
          body={t('game.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const deck = getDeck(game.deckId);

  if (matches.length === 0) {
    return (
      <Screen title={t('detail.title')} meta={deck?.name}>
        <EmptyState
          title={t('detail.noMatches')}
          body={t('detail.noMatches.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const draftAt = (i: number): Draft =>
    drafts[i] ?? { score: { scoreFor: null, scoreAgainst: null }, hand: BLANK_HAND };

  const patch = (i: number, next: Partial<Draft>) => {
    setDrafts((current) => current.map((d, n) => (n === i ? { ...d, ...next } : d)));
  };

  const setHand = (i: number, next: OpeningHandValue) => {
    patch(i, { hand: next });
  };

  /*
   * The rules live in `OpeningHand`'s helpers, not here.
   *
   * The log form drives the identical three, and a second copy of "a mulligan
   * is a subset of the deal" is a second place for it to stop being true.
   */
  const dealtCards = (match: number): CardRow[] =>
    draftAt(match).hand.dealt.filter((card): card is CardRow => card !== null);

  const onCounts = (counts: Counts) => {
    if (!picker) return;
    const hand = draftAt(picker.match).hand;
    const next =
      picker.kind === 'dealt'
        ? applyDealt(hand, counts, deckPool)
        : picker.kind === 'mulligan'
          ? applyMulligan(hand, counts)
          : applyReplacements(hand, counts, deckPool);
    setHand(picker.match, next);
  };

  const onSave = () => {
    saveMatches(
      id,
      matches.map((match, i) => {
        const draft = draftAt(i);
        const dealt = draft.hand.dealt.filter((card): card is CardRow => card !== null);
        const recorded = dealt.length > 0;

        return {
          matchNumber: match.matchNumber,
          result: match.result,
          // Carried through untouched. This screen does not ask them, and
          // `saveMatches` replaces the whole row — anything not passed back is
          // deleted rather than left alone.
          onPlay: match.onPlay,
          battlefieldCardId: match.battlefieldCardId,
          oppBattlefieldCardId: match.oppBattlefieldCardId,
          notes: match.notes,
          scoreFor: draft.score.scoreFor,
          scoreAgainst: draft.score.scoreAgainst,
          // Null, not `[]`, when nothing was filled in — `handCoverage` counts
          // on the difference between "not recorded" and "recorded as empty".
          openingHand: recorded ? dealt.map((card) => card.id) : null,
          mulliganed: recorded
            ? draft.hand.mulliganed
                .map((index) => draft.hand.dealt[index]?.id)
                .filter((cardId): cardId is string => Boolean(cardId))
            : null,
          replacements: recorded
            ? draft.hand.replacements
                .filter((card): card is CardRow => card !== null)
                .map((card) => card.id)
            : null,
        };
      })
    );

    // A confirmation, not an undoable action — the edit is still on the screen
    // behind it and nothing was destroyed.
    showToast(t('match.detailSaved'), { durationMs: TOAST_CONFIRM_MS });
    router.back();
  };

  const pickerCards =
    picker?.kind === 'mulligan'
      ? dealtCards(picker.match).filter(
          (card, i, all) => all.findIndex((c) => c.id === card.id) === i
        )
      : deckPool;

  return (
    <Screen
      title={t('detail.title')}
      meta={metaLine(deck?.name, `${matches.length} match${matches.length === 1 ? '' : 'es'}`)}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('detail.help')}</Text>

        {matches.map((match, i) => (
          <MatchDetailCard
            key={match.id}
            title={t('game.matchNumber', { number: match.matchNumber })}
            result={match.result}
            summary={
              metaLine(
                t(
                  match.result === 'win'
                    ? 'match.won'
                    : match.result === 'loss'
                      ? 'match.lost'
                      : 'match.drew'
                ),
                turnOrderLabel(match.onPlay, t)
              ) || ''
            }
            value={draftAt(i).score}
            onChange={(changes) => patch(i, { score: { ...draftAt(i).score, ...changes } })}
            hand={
              <OpeningHand
                value={draftAt(i).hand}
                onPickRow={(row) => setPicker({ kind: row, match: i })}
              />
            }
          />
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>{t('detail.save')}</Text>
        </Pressable>

        <Text style={styles.footnote}>{t('detail.notEditable')}</Text>
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={
          picker?.kind === 'dealt'
            ? t('match.pick.hand')
            : picker?.kind === 'mulligan'
              ? t('match.pick.whichBack')
              : t('match.pick.drewBack')
        }
        subtitle={
          picker?.kind === 'mulligan' ? t('match.pick.onlyDealt') : (deck?.name ?? undefined)
        }
        cards={pickerCards}
        emptyMessage={
          picker?.kind === 'mulligan'
            ? t('match.pick.mulliganFirst')
            : t('match.pick.noMainDeck')
        }
        multi={
          picker
            ? {
                counts:
                  picker.kind === 'dealt'
                    ? handCounts.dealt(draftAt(picker.match).hand)
                    : picker.kind === 'mulligan'
                      ? handCounts.mulliganed(draftAt(picker.match).hand)
                      : handCounts.replacements(draftAt(picker.match).hand),
                limit: picker.kind === 'dealt' ? DEAL_SIZE : MAX_RECYCLED,
                // A card can be sent back only as often as it was dealt.
                maxPerCard: (card) =>
                  picker.kind === 'mulligan'
                    ? dealtCards(picker.match).filter((c) => c.id === card.id).length
                    : MAX_RECYCLED,
                onChange: onCounts,
              }
            : undefined
        }
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[16], gap: space[4] },
  intro: { ...text.small, color: color.textMuted },
  save: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  saveLabel: { ...text.bodyMedium, color: color.onAccent },
  footnote: { ...text.caption, color: color.textMuted },
  pressed: { opacity: 0.75 },
});
