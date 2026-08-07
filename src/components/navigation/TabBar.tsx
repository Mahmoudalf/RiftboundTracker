import * as Haptics from 'expo-haptics';
import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { markLogStart } from '@/features/matches/timing';
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

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Decks', icon: 'decks' },
  { name: 'cards', label: 'Cards', icon: 'cards' },
  { name: 'stats', label: 'Stats', icon: 'stats' },
  { name: 'profile', label: 'You', icon: 'profile' },
];

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const onLogMatch = () => {
    // Before anything else — this is t=0 for the under-ten-second budget, and
    // starting the clock after navigation would hide the part most likely to
    // be slow.
    markLogStart();
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/match/new');
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
        accessibilityLabel={tab.label}
        style={styles.tab}
        onPress={() => {
          const route = state.routes[routeIndex];
          if (!route) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
      >
        <Icon
          name={tab.icon}
          size={23}
          color={focused ? color.text : color.textFaint}
          active={focused}
        />
        <Text
          style={[
            styles.label,
            { color: focused ? color.text : color.textFaint },
          ]}
        >
          {tab.label}
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
          accessibilityLabel="Log a match"
          accessibilityHint="Opens the match log sheet"
          onPress={onLogMatch}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Icon name="plus" size={26} color={color.bg} />
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
    backgroundColor: color.text,
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
