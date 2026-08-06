import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function StatsScreen() {
  return (
    <Screen title="Stats">
      <EmptyState
        title="Nothing to measure yet"
        body="Log a few matches and this becomes your record across every deck — matchups, play/draw splits, and how each version performed."
      />
    </Screen>
  );
}
