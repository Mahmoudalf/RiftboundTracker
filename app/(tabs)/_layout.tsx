import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}
    >
      {/* A group, not a screen: the Decks tab owns its own stack so deck
          detail and the editor push *inside* the tab rather than over it. */}
      <Tabs.Screen name="(decks)" options={{ title: 'Decks' }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}
