import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeckCard } from '@/components/decks/DeckCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listDecks, type DeckSummary } from '@/db/queries/decks';
import { useOnboardingDraft } from '@/features/onboarding/useOnboardingDraft';
import { useT } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

export default function DecksScreen() {
  const t = useT();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [archived, setArchived] = useState<DeckSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const takeHandoff = useOnboardingDraft((s) => s.takeHandoff);

  /*
   * Onboarding's deck choice, opened from here rather than navigated to.
   *
   * The flow used to `replace` itself with `/deck/import`, which made import the
   * root of this stack — so this screen was never underneath it, returning to
   * the tab always showed the paste form, and the imported deck had nothing to
   * go back to. Now onboarding lands here and leaves the choice in the store.
   *
   * `takeHandoff` clears as it reads, which is what makes this safe to run on
   * mount: the navigator remounts whenever the language changes
   * (`<Stack key={locale}>`), and a value that survived would push a screen the
   * player never asked for, months later.
   */
  useEffect(() => {
    const choice = takeHandoff();
    if (choice === 'import') router.push('/deck/import');
    else if (choice === 'new') router.push('/deck/new');
  }, [takeHandoff]);

  // Re-read on focus rather than subscribing: the editor and the create flow
  // both return here after writing, and a deck list is a handful of rows.
  useFocusEffect(
    useCallback(() => {
      const live = listDecks();
      setDecks(live);
      /*
       * Archived decks are fetched whether or not they are shown, because the
       * toggle only earns its space when there is something behind it. Without
       * this, archiving would be a one-way door — the deck leaves the list and
       * nothing in the app admits it still exists.
       */
      const liveIds = new Set(live.map((s) => s.deck.id));
      setArchived(listDecks(true).filter((s) => !liveIds.has(s.deck.id)));
    }, [])
  );

  const visible = showArchived ? [...decks, ...archived] : decks;

  if (decks.length === 0 && archived.length === 0) {
    return (
      <Screen title={t('decks.title')}>
        <EmptyState
          title={t('decks.empty')}
          body={t('decks.empty.body')}
          actions={[
            { label: t('decks.build'), onPress: () => router.push('/deck/new'), primary: true },
            { label: t('decks.import'), onPress: () => router.push('/deck/import') },
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('decks.title')}
      meta={`${visible.length} ${visible.length === 1 ? 'deck' : 'decks'}`}
      action={
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('decks.import')}
            onPress={() => router.push('/deck/import')}
            style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}
          >
            <Text style={styles.importLabel}>{t('action.import')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('decks.build')}
            onPress={() => router.push('/deck/new')}
            style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          >
            <Text style={styles.newLabel}>{t('action.new')}</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {decks.map((summary) => (
          <DeckCard
            key={summary.deck.id}
            summary={summary}
            onPress={() => router.push(`/deck/${summary.deck.id}`)}
          />
        ))}

        {/* The toggle sits *between* the two groups, so when archived decks are
            showing it doubles as the divider. Appended below them instead, an
            archived deck was indistinguishable from a live one. */}
        {archived.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            onPress={() => setShowArchived((s) => !s)}
            style={({ pressed }) => [styles.archiveToggle, pressed && styles.pressed]}
          >
            <Text style={styles.archiveLabel}>
              {showArchived
                ? t('decks.hideArchived')
                : t(
                    archived.length === 1
                      ? 'decks.showArchived.one'
                      : 'decks.showArchived.other',
                    { count: archived.length }
                  )}
            </Text>
          </Pressable>
        ) : null}

        {showArchived
          ? archived.map((summary) => (
              <DeckCard
                key={summary.deck.id}
                summary={summary}
                onPress={() => router.push(`/deck/${summary.deck.id}`)}
              />
            ))
          : null}

        <View style={styles.footer} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2], paddingBottom: space[4] },
  footer: { height: space[8] },
  newButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.accent,
  },
  newLabel: { ...text.smallMedium, color: color.onAccent },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  importButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  importLabel: { ...text.smallMedium, color: color.text },
  archiveToggle: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
  },
  archiveLabel: { ...text.smallMedium, color: color.textMuted },
  pressed: { opacity: 0.8 },
});
