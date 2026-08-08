import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeckCard } from '@/components/decks/DeckCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listDecks, type DeckSummary } from '@/db/queries/decks';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

export default function DecksScreen() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);

  // Re-read on focus rather than subscribing: the editor and the create flow
  // both return here after writing, and a deck list is a handful of rows.
  useFocusEffect(
    useCallback(() => {
      setDecks(listDecks());
    }, [])
  );

  if (decks.length === 0) {
    return (
      <Screen title="Decks">
        <EmptyState
          title="Track a deck through every change"
          body="Matches stay attached to the exact list that played them, so editing a deck never rewrites its history."
          actions={[
            { label: 'Build a deck', onPress: () => router.push('/deck/new'), primary: true },
            { label: 'Import a deck code', onPress: () => router.push('/deck/import') },
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Decks"
      meta={`${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}`}
      action={
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import a deck code"
            onPress={() => router.push('/deck/import')}
            style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}
          >
            <Text style={styles.importLabel}>Import</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Build a deck"
            onPress={() => router.push('/deck/new')}
            style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          >
            <Text style={styles.newLabel}>New</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {decks.map((summary) => (
          <DeckCard
            key={summary.deck.id}
            summary={summary}
            onPress={() => router.push(`/deck/${summary.deck.id}`)}
          />
        ))}
        <View style={styles.footer} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2], paddingBottom: space[4] },
  footer: { height: space[8] },
  newButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  newLabel: { ...text.smallMedium, color: color.bg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  importButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  importLabel: { ...text.smallMedium, color: color.text },
  pressed: { opacity: 0.8 },
});
