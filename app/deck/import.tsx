import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { queryCards } from '@/db/queries/cards';
import { createDeck } from '@/db/queries/decks';
import {
  decodeDeckCode,
  DeckCodeError,
  extractDeckCode,
  suggestDeckName,
  type DecodeResult,
} from '@/lib/deck-code';
import { checkLegality, type DeckZone } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Import a deck from a code.
 *
 * Two steps, and the order is the point: **nothing is written until the user
 * has seen what the code resolved to.** A deck code is opaque — you cannot read
 * one — so importing without a preview means finding out what you agreed to
 * only after it is in your deck list.
 *
 * The preview is also where the honest parts live: cards the library cannot
 * resolve are named rather than dropped, and an illegal import is flagged and
 * saved anyway, exactly as the builder treats a half-finished deck.
 */

const ZONE_ORDER: { zone: DeckZone; label: string; fixed?: boolean }[] = [
  { zone: 'legend', label: 'Legend', fixed: true },
  { zone: 'champion', label: 'Champion', fixed: true },
  { zone: 'main', label: 'Main deck' },
  { zone: 'rune', label: 'Runes' },
  { zone: 'battlefield', label: 'Battlefields' },
  { zone: 'sideboard', label: 'Sideboard' },
];

export default function ImportDeckScreen() {
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<DecodeResult | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolve = () => {
    setError(null);
    try {
      const catalogue = queryCards({});
      const code = extractDeckCode(pasted);
      const result = decodeDeckCode(code, catalogue);

      if (result.slots.length === 0) {
        setError('That code resolved to no cards this app knows about.');
        setPreview(null);
        return;
      }

      const legend = result.slots.find((s) => s.zone === 'legend')?.card ?? null;
      setName(suggestDeckName(pasted, legend));
      setPreview(result);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof DeckCodeError ? err.message : 'That code could not be read.'
      );
    }
  };

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip) setPasted(clip);
  };

  const save = () => {
    if (!preview) return;
    const legend = preview.slots.find((s) => s.zone === 'legend')?.card;
    if (!legend) {
      setError('This code has no Legend, so there is no deck to build from it.');
      return;
    }

    const { deckId } = createDeck({
      name: name.trim() || 'Imported deck',
      legend,
      champion: preview.slots.find((s) => s.zone === 'champion')?.card ?? null,
      slots: preview.slots,
    });

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace(`/deck/${deckId}`);
  };

  const legality = preview ? checkLegality({ slots: preview.slots }) : null;

  return (
    <Screen
      title="Import a deck"
      meta={preview ? 'Check it over, then save' : 'Paste a deck code'}
      action={
        preview ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save this deck"
            onPress={save}
            style={({ pressed }) => [styles.save, pressed && styles.pressed]}
          >
            <Text style={styles.saveLabel}>Save</Text>
          </Pressable>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {preview ? null : (
          <>
            <TextInput
              value={pasted}
              onChangeText={setPasted}
              placeholder="Paste a deck code — extra text around it is fine"
              placeholderTextColor={color.textFaint}
              style={styles.input}
              multiline
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Deck code"
            />
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void paste()}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>Paste from clipboard</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={resolve}
              disabled={!pasted.trim()}
              style={({ pressed }) => [
                styles.primary,
                !pasted.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryLabel}>Read code</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {preview ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Deck name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name this deck"
                placeholderTextColor={color.textFaint}
                style={styles.nameInput}
                accessibilityLabel="Deck name"
              />
            </View>

            {preview.unknown.length > 0 ? (
              <Text style={styles.warning}>
                {/* Named, never silently dropped — the rule the whole wrapper
                    follows. These cards are in the code and not in the library. */}
                Not in your card library:{' '}
                {preview.unknown.map((u) => `${u.count}× ${u.cardCode}`).join(', ')}. The deck
                will be short by {preview.unknown.reduce((n, u) => n + u.count, 0)} cards.
                Refreshing the library in Settings usually fixes this.
              </Text>
            ) : null}

            {!preview.hadChosenChampion ? (
              <Text style={styles.note}>
                This code does not name a Chosen Champion — older codes often do not. Pick one in
                the editor after saving.
              </Text>
            ) : null}

            {ZONE_ORDER.map(({ zone, label, fixed }) => {
              const slots = preview.slots
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
            })}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPreview(null);
                setError(null);
              }}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Use a different code</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {legality ? <LegalityBar result={legality} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[12], gap: space[4] },
  input: {
    ...text.small,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[3],
    minHeight: 120,
    textAlignVertical: 'top',
  },
  nameInput: {
    ...text.body,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[3],
    minHeight: 46,
  },
  row: { flexDirection: 'row' },
  primary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  primaryLabel: { ...text.bodyMedium, color: color.bg },
  disabled: { opacity: 0.4 },
  secondary: { minHeight: 44, justifyContent: 'center' },
  secondaryLabel: { ...text.smallMedium, color: color.info },
  save: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  saveLabel: { ...text.smallMedium, color: color.bg },
  section: { gap: space[2] },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  error: { ...text.small, color: color.danger },
  warning: { ...text.small, color: color.warning },
  note: { ...text.small, color: color.textMuted },
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
  pressed: { opacity: 0.75 },
});
