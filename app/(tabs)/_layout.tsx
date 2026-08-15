import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';
import { useT } from '@/i18n';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}
    >
      {/* Groups, not screens: these two tabs own their own stacks so deck
          detail, the editor and a binder push *inside* the tab rather than over
          it, and the bar stays put. */}
      <Tabs.Screen name="(decks)" options={{ title: t('tab.decks') }} />
      <Tabs.Screen name="(collection)" options={{ title: t('tab.collection') }} />
      <Tabs.Screen name="stats" options={{ title: t('tab.stats') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.settings') }} />
    </Tabs>
  );
}
