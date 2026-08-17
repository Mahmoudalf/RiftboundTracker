import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toast } from '@/components/ui/Toast';
import { onboardingDone } from '@/db/queries/settings';
import { loadStoredLocale, useLocale } from '@/i18n';
import { color } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

void SplashScreen.preventAutoHideAsync();

/*
 * The stored language, applied at module load rather than in an effect.
 *
 * `Stack` below is keyed on the locale, so applying it after the first render
 * would remount the whole navigator — the user would watch the app open in one
 * language and switch to another. Here it lands before anything reads a string.
 *
 * Safe this early because the call opens the database itself: `conn()` requires
 * `client.ts`, which migrates synchronously on load. A first launch with
 * nothing stored is a no-op, and any failure leaves the device locale standing.
 */
loadStoredLocale();

/*
 * Read here for the same reason, and once.
 *
 * Reading it at module load rather than in the component means the answer
 * cannot change under the effect below: `completeOnboarding()` writes the flag
 * *before* navigating away, so a re-render that re-read it would find the flow
 * already finished and race its own redirect.
 */
const NEEDS_ONBOARDING = !onboardingDone();

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
    if (!fontsLoaded && !fontError) return;

    /*
     * Redirect *under* the splash, then hide it.
     *
     * The navigator's initial route is the tab group, so a first launch would
     * otherwise paint the empty Decks tab for a frame before onboarding
     * replaced it. Ordering the two here means the first thing anyone ever
     * sees is the welcome screen rather than a flash of the app behind it.
     */
    if (NEEDS_ONBOARDING) router.replace('/onboarding');
    void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          {/*
            Inside the providers, outside the navigator.

            Inside, so the fallback can use the theme and the safe-area insets —
            a crash screen drawn on a white ground under the notch is its own
            small failure. Outside the navigator, so a screen that throws while
            rendering is caught rather than taking the whole tree down: the
            boundary survives, the route below it does not.

            It does **not** wrap `Toast`, which sits above the navigator for its
            own reasons and has no render of its own to fail.
          */}
          <ErrorBoundary>
            <Stack
              key={locale}
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              {/* No back gesture and no animation in: it is not somewhere you
                  navigated to, it is where the app starts. */}
              <Stack.Screen
                name="onboarding"
                options={{ animation: 'none', gestureEnabled: false }}
              />
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
          </ErrorBoundary>

          {/* Above the navigator, because the log-match sheet closes as part of
              raising the toast — one owned by that screen would unmount in the
              same frame it appeared, taking Undo with it. */}
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
