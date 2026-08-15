import * as Haptics from 'expo-haptics';
import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { markLogStart } from '@/features/games/timing';
import { useT, type Key } from '@/i18n';
import { color, elevation, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Custom tab bar.
 *
 * The center action is the most important control in the app — logging a match
 * has a sub-10-second budget (docs/DESIGN.md §5) — so it gets the largest target
 * and the only accent fill on the bar. It is not a tab: it opens the log sheet
 * as a modal over whatever screen you were on, and it is context-aware, because
 * the sheet reads the deck you came from.
 */

/**
 * Derived from expo-router's own `Tabs` rather than imported from
 * `@react-navigation/bottom-tabs`.
 *
 * expo-router v6 vendors its own copy of the bottom-tabs types. Importing the
 * standalone package instead gives you a second, subtly different definition
 * (its `tintColor` is `string` where expo-router's is `ColorValue`), and the two
 * do not unify — so `tabBar={...}` fails to typecheck. It also made
 * `@react-navigation/bottom-tabs` a phantom dependency: undeclared, and
 * resolving only because npm happened to hoist it out of expo-router's tree.
 *
 * Deriving the type from the component that consumes it means there is exactly
 * one definition, and it cannot drift when expo-router updates.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Keys, translated at render — a module-scope constant evaluates once and
// would otherwise freeze whatever language the bundle first started in.
const TABS: { name: string; label: Key; icon: IconName }[] = [
  { name: '(decks)', label: 'tab.decks', icon: 'decks' },
  // Parenthesised: the tab is a route *group* owning its own stack, so the
  // navigator knows it by the group's name, not by the screen inside it.
  { name: '(collection)', label: 'tab.collection', icon: 'cards' },
  { name: 'stats', label: 'tab.stats', icon: 'stats' },
  { name: 'profile', label: 'tab.settings', icon: 'profile' },
];

export function TabBar({ state, navigation }: TabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();

  const onLogMatch = () => {
    // Before anything else — this is t=0 for the under-ten-second budget, and
    // starting the clock after navigation would hide the part most likely to
    // be slow.
    markLogStart();
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/game/new');
  };

  // Split the tabs either side of the center action.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = (tab: (typeof TABS)[number]) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    const focused = state.index === routeIndex;

    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={t(tab.label)}
        style={styles.tab}
        onPress={() => {
          const route = state.routes[routeIndex];
          if (!route) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (event.defaultPrevented) return;

          if (!focused) {
            navigation.navigate(route.name);
            return;
          }

          /*
           * Pressing the tab you are already on returns it to its root.
           *
           * This only started mattering when the Decks tab gained its own
           * stack: without it, opening a deck and then reaching for the Decks
           * tab to get back to the list does nothing at all, because the tab is
           * already focused. Every phone user expects the second press to pop.
           *
           * The action is written out rather than imported from
           * `@react-navigation/native`, which is not a declared dependency —
           * importing it is the phantom-dependency bug recorded in M0, and it
           * resolves only while npm happens to hoist expo-router's copy.
           */
          const nested = route.state as { index?: number; key?: string } | undefined;
          if (nested?.key && (nested.index ?? 0) > 0) {
            navigation.dispatch({ type: 'POP_TO_TOP', target: nested.key });
          }
        }}
      >
        <Icon
          name={tab.icon}
          size={23}
          color={focused ? color.accent : color.textFaint}
          active={focused}
        />
        {/* One line, always. A label too wide for its cell used to wrap, and
            since the bar has no fixed height it grew the whole bar rather than
            just that tab. Truncating is the smaller failure. */}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? color.accent : color.textFaint },
          ]}
        >
          {t(tab.label)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, space[2]) },
      ]}
    >
      <View style={styles.row}>
        {left.map(renderTab)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ui.logGame')}
          accessibilityHint={t('tab.logGame.hint')}
          onPress={onLogMatch}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Icon name="plus" size={26} color={color.onAccent} />
        </Pressable>

        {right.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.raised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    minHeight: 48,
  },
  label: {
    ...text.microMeta,
  },
  action: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    marginHorizontal: space[1],
    borderWidth: 4,
    borderColor: color.raised,
    ...elevation.card,
  },
  actionPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
});
