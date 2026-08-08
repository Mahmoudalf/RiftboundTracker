import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { baseName } from '@/lib/card-identity';
import type { EncodeResult } from '@/lib/deck-code';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Share a deck as a code.
 *
 * The code is shown in full rather than hidden behind a "copy" button, because
 * a string you cannot see is a string you cannot trust — and this one is going
 * to be pasted into a chat where a truncated copy fails silently.
 *
 * Anything the code could not carry is stated here, before it is shared, not
 * discovered by whoever imports it.
 */

interface DeckCodeSheetProps {
  visible: boolean;
  deckName: string;
  result: EncodeResult | null;
  onClose: () => void;
}

export function DeckCodeSheet({ visible, deckName, result, onClose }: DeckCodeSheetProps) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.code);
    setCopied(true);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!result) return;
    try {
      await Share.share({ message: `${deckName}\n\n${result.code}` });
    } catch {
      // The user dismissed the sheet, or the platform refused. Nothing to say.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={styles.scrim}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          Deck code
        </Text>
        <Text style={styles.subtitle}>
          Works in any Riftbound app that reads deck codes, and offline.
        </Text>

        <ScrollView style={styles.codeBox} contentContainerStyle={styles.codeContent}>
          <Text style={styles.code} selectable>
            {result?.code ?? ''}
          </Text>
        </ScrollView>

        {result && result.reprinted.length > 0 ? (
          <Text style={styles.note}>
            {result.reprinted.length === 1
              ? `${baseName(result.reprinted[0]!.card.name)} is a promo printing, so the code carries the standard version.`
              : `${result.reprinted.length} promo printings are carried as their standard versions.`}{' '}
            The cards are the same; the art is not.
          </Text>
        ) : null}

        {result && result.omitted.length > 0 ? (
          <Text style={styles.warning}>
            {/* Named, never silently dropped — the same rule the wrapper applies
                to tokens, promos and cards the library has lost. */}
            Not in this code: {result.omitted.map((o) => `${o.quantity}× ${baseName(o.name)}`).join(', ')}.
            {result.omitted.some((o) => o.reason === 'not-in-library')
              ? ' Some are missing from the card library — refreshing it in Settings usually fixes that.'
              : ' Deck codes cannot carry tokens.'}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void copy()}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{copied ? 'Copied' : 'Copy code'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void share()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Share…</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: space[5],
    paddingTop: space[2],
    gap: space[3],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.border,
    marginBottom: space[2],
  },
  title: { ...text.title, color: color.text },
  subtitle: { ...text.small, color: color.textMuted },
  codeBox: {
    maxHeight: 140,
    borderRadius: radius.lg,
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.border,
  },
  codeContent: { padding: space[3] },
  code: { ...text.numeric, fontSize: 12, color: color.text, lineHeight: 18 },
  note: { ...text.microMeta, color: color.textMuted },
  warning: { ...text.microMeta, color: color.warning },
  actions: { gap: space[2], paddingTop: space[1] },
  primary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  primaryLabel: { ...text.bodyMedium, color: color.bg },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { ...text.smallMedium, color: color.info },
  closeLabel: { ...text.smallMedium, color: color.textMuted },
  pressed: { opacity: 0.8 },
});
