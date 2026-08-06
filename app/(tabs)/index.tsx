import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function DecksScreen() {
  // M2 replaces this with the deck list; until then the empty state doubles as
  // the app's onboarding surface (docs/DESIGN.md §7).
  return (
    <Screen title="Decks">
      <EmptyState
        title="Track a deck through every change"
        body="Matches stay attached to the exact list that played them, so editing a deck never rewrites its history."
        actions={[
          { label: 'Build a deck', onPress: () => router.push('/deck/new'), primary: true },
          { label: 'Paste a decklist', onPress: () => router.push('/deck/new?import=1') },
        ]}
      />
    </Screen>
  );
}
