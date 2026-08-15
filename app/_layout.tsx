import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { Toast } from '@/components/ui/Toast';
import { useLocale } from '@/i18n';
import { color } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The local SQLite mirror is the source of truth, so nothing here is
      // urgent enough to refetch aggressively. See docs/API.md §6.
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  /**
   * Changing language remounts the tree.
   *
   * Most translated strings are produced by plain functions — `gameStyleLabel`,
   * `gameDate`, the result labels — which call `t()` imperatively and so do not
   * subscribe to the locale. Making every one of them a hook would turn a
   * formatting helper into something only a component can call, and `lib/` would
   * stop being pure.
   *
   * Keying the navigator on the locale buys correctness for one line instead:
   * every screen re-reads every string, once, at the moment the language
   * changes. It is a heavy remount, and it happens on a deliberate settings
   * action a user performs approximately never — the wrong thing to optimise
   * for, against a whole-app subscription rule that would be easy to forget in
   * one place and never notice.
   */
  const locale = useLocale((s) => s.locale);

  useEffect(() => {
    // Hide the splash on error too — a missing font should degrade to the
    // system face, never leave the user staring at a splash screen.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            key={locale}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="game/new"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="card/[id]"
              options={{ presentation: 'modal', animation: 'fade' }}
            />
            <Stack.Screen
              name="cards/filters"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>

          {/* Above the navigator, because the log-match sheet closes as part of
              raising the toast — one owned by that screen would unmount in the
              same frame it appeared, taking Undo with it. */}
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
