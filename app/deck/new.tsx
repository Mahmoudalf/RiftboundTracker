import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

/**
 * Placeholder for the deck creation flow (M2: Legend → Champion → build).
 *
 * It exists now because the Decks empty state links here; without the route,
 * both of its buttons dropped the user on expo-router's "unmatched route"
 * screen.
 */
export default function NewDeckScreen() {
  const { import: isImport } = useLocalSearchParams<{ import?: string }>();

  return (
    <Screen title={isImport ? 'Paste a decklist' : 'Build a deck'} meta="Coming in M2">
      <EmptyState
        title="Not built yet"
        body={
          isImport
            ? 'Decklist import will match pasted card names against the card library and build the deck for you.'
            : 'The builder will walk you through picking a Legend, then a matching Champion, then the 40-card main deck — checking the rules as you go.'
        }
        actions={[
          { label: 'Browse cards instead', onPress: () => router.replace('/cards'), primary: true },
          { label: 'Go back', onPress: () => router.back() },
        ]}
      />
    </Screen>
  );
}
