import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listBattlefields, listChampionsForLegend, listLegends } from '@/db/queries/cards';
import { listDecks, loadDeckList } from '@/db/queries/decks';
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
import { BEST_OF_OPTIONS, type EventType, type MatchResult } from '@/db/schema/matches';
import { markLogAnother, markLogged, markSheetReady } from '@/features/matches/timing';
import { useToast } from '@/features/matches/useToast';
import { baseName, cardKey } from '@/lib/card-identity';
import { matchStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Log a match, top to bottom.
 *
 * The order is the design: **style → format → your deck → their deck → who went
 * first → result.** It follows the shape of the match itself, so each answer is
 * one you already have by the time you are asked, and the last tap is the one
 * that saves.
 *
 * That is a deliberate trade against the earlier layout, which put WIN and LOSS
 * at the top and everything optional underneath. Two taps was faster; it also
 * meant the fields that make a match *analysable* — who you played, on what,
 * going first or second — were the ones most easily skipped. A logged match
 * with no opponent is a row in a total and nothing else.
 *
 * Result still saves on tap. There is no confirm step, because a confirm at the
 * bottom of a form is a tap that buys nothing — Undo in the toast covers the
 * mis-tap, as it always has.
 */

const RESULTS: { key: MatchResult; label: string }[] = [
  { key: 'win', label: 'WIN' },
  { key: 'loss', label: 'LOSS' },
];

const MATCH_STYLES: EventType[] = [
  'casual',
  'skirmish',
  'nexus-night',
  'locals',
  'tournament',
  'online',
  'testing',
];

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

type Picker = 'legend' | 'champion' | 'ourField' | 'theirField';

export default function LogMatchScreen() {
  const decks = useMemo(() => listDecks(), []);
  const [deckIndex, setDeckIndex] = useState(0);

  const [eventType, setEventType] = useState<EventType>('casual');
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [ourField, setOurField] = useState<CardRow | null>(null);
  const [opponent, setOpponent] = useState<CardRow | null>(null);
  const [oppChampion, setOppChampion] = useState<CardRow | null>(null);
  const [theirField, setTheirField] = useState<CardRow | null>(null);
  const [onPlay, setOnPlay] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);

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

  const reset = () => {
    // "Log another": you are still at the same event, with the same deck and
    // Battlefields. The opponent is what changes between rounds.
    setOpponent(null);
    setOppChampion(null);
    setTheirField(null);
    setOnPlay(null);
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
      onPlay,
      bestOf,
      eventType,
      notes: notes.trim() || null,
      ...opponentFields(opponent),
      ...opponentChampionFields(oppChampion),
      ...battlefieldFields(ourField),
      ...opponentBattlefieldFields(theirField),
    });

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

  /** A labelled row of chips — the shape almost every step here takes. */
  const chips = <T,>(
    options: { key: string; label: string; value: T }[],
    current: T,
    onSelect: (value: T) => void
  ) => (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = current === option.value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic(Haptics.ImpactFeedbackStyle.Light);
              onSelect(option.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  /** A tappable field that opens a picker. */
  const field = (label: string, value: string | null, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'not recorded'}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        disabled && styles.fieldDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={value ? styles.fieldValue : styles.fieldPlaceholder} numberOfLines={1}>
        {value ?? 'Not recorded'}
      </Text>
    </Pressable>
  );

  const step = (n: number, title: string, children: React.ReactNode) => (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{n}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
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
        {step(
          1,
          'Match style',
          chips(
            MATCH_STYLES.map((key) => ({ key, label: matchStyleLabel(key), value: key })),
            eventType,
            setEventType
          )
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
                    setOurField(null);
                  }
                )
              : (
                <Text style={styles.single}>{selected?.deck.name}</Text>
              )}
            <Text style={styles.fieldLabel}>Battlefield you played</Text>
            {ourFields.length === 0 ? (
              <Text style={styles.hint}>This deck has no Battlefields yet.</Text>
            ) : (
              chips<CardRow | null>(
                [
                  { key: 'none', label: '—', value: null },
                  ...ourFields.map((c) => ({
                    key: c.id,
                    label: baseName(c.name),
                    value: c,
                  })),
                ],
                ourField,
                setOurField
              )
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
              () => setPicker('legend')
            )}

            <Text style={styles.fieldLabel}>Chosen Champion</Text>
            {field(
              'Champion',
              oppChampion ? baseName(oppChampion.name) : null,
              () => setPicker('champion'),
              !opponent
            )}

            <Text style={styles.fieldLabel}>Battlefield they played</Text>
            {field(
              'Their Battlefield',
              theirField ? baseName(theirField.name) : null,
              () => setPicker('theirField')
            )}
          </>
        )}

        {step(
          5,
          'Who went first',
          chips<boolean | null>(
            [
              { key: 'me', label: 'I did', value: true },
              { key: 'them', label: 'They did', value: false },
              { key: 'unsure', label: 'Not sure', value: null },
            ],
            onPlay,
            setOnPlay
          )
        )}

        {step(
          6,
          'Result',
          <>
            <View style={styles.results}>
              {RESULTS.map((r) => (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}, saves the match`}
                  accessibilityHint="Long press to log this and stay here for the next round"
                  onPress={() => save(r.key, false)}
                  onLongPress={() => save(r.key, true)}
                  delayLongPress={400}
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
              Tapping a result saves the match. Hold it to log and stay here for the next round.
            </Text>
          </>
        )}

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
      </ScrollView>

      <CardPickerSheet
        visible={picker !== null}
        title={
          picker === 'legend'
            ? 'Their Legend'
            : picker === 'champion'
              ? 'Their Chosen Champion'
              : 'Battlefield they played'
        }
        subtitle={
          picker === 'champion' && opponent
            ? `Champions that partner ${baseName(opponent.name)}`
            : undefined
        }
        cards={
          picker === 'legend'
            ? dedupe(listLegends())
            : picker === 'champion'
              ? championChoices
              : picker === 'theirField'
                ? dedupe(listBattlefields())
                : []
        }
        selectedId={
          picker === 'legend'
            ? (opponent?.id ?? null)
            : picker === 'champion'
              ? (oppChampion?.id ?? null)
              : (theirField?.id ?? null)
        }
        emptyMessage={
          picker === 'champion'
            ? 'No Champion Unit in the library partners that Legend.'
            : 'The card library has not finished downloading.'
        }
        onSelect={(card) => {
          if (picker === 'legend') {
            setOpponent(card);
            setOppChampion(null);
          } else if (picker === 'champion') {
            setOppChampion(card);
          } else {
            setTheirField(card);
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
  chipActive: { backgroundColor: color.text, borderColor: color.text },
  chipLabel: { ...text.small, color: color.textSecondary },
  chipLabelActive: { color: color.bg },

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
