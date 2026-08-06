import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function LogMatchScreen() {
  // M4 replaces this with the two-tap log sheet (docs/DESIGN.md §5, Flow 1).
  return (
    <Screen title="Log a match" meta="Coming in M4">
      <EmptyState
        title="Build a deck first"
        body="A match is always attached to a specific deck version, so there needs to be a deck to attach it to."
        actions={[{ label: 'Close', onPress: () => router.back(), primary: true }]}
      />
    </Screen>
  );
}
