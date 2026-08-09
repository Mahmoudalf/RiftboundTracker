import { Stack } from 'expo-router';

import { color } from '@/theme/tokens';

/**
 * The Decks tab is a stack, not a screen.
 *
 * Deck detail, the editor and the build flow used to be pushed onto the *root*
 * stack, which sits above the tab bar — so opening a deck hid every other tab
 * and getting to Cards or Stats meant unwinding the stack first. Nested here,
 * they push inside the tab, the bar stays put, and any tab is one tap away from
 * anywhere in the deck tree.
 *
 * The group is parenthesised, so none of this changes a single URL: `/deck/123`
 * is still `/deck/123`, and every `router.push` in the app is untouched.
 *
 * What stays on the root stack is what should genuinely cover everything —
 * logging a match, a full-bleed card, the filter sheet. Those are modals you
 * finish or dismiss, not places you browse.
 */
export default function DecksLayout() {
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
