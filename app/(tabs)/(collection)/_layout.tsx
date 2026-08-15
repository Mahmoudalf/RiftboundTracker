import { Stack } from 'expo-router';

import { color } from '@/theme/tokens';

/**
 * The Collection tab is a stack, not a screen.
 *
 * Opening a binder pushed onto the *root* stack, which sits above the tab bar —
 * so the bar vanished the moment you tapped a binder, and getting to Decks or
 * Stats meant backing out of the binder first. The Decks tab had the same
 * problem and this is the same fix: nested here, a binder pushes inside the tab,
 * the bar stays put, and every tab is one tap away from anywhere in the
 * collection tree.
 *
 * The group is parenthesised, so **no URL changes**: `/collection` is still
 * `/collection` and `/binder/123` is still `/binder/123`. Every `router.push` in
 * the app is untouched — which matters, because the Gallery row, the Profile
 * card and the deck editor all link into this tree.
 *
 * `collection.tsx` keeps its filename rather than becoming `index.tsx`. Two
 * groups both resolving to `/` is a route collision — `(decks)/index.tsx`
 * already owns the app root.
 */
export default function CollectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
