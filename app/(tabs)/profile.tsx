import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { useCardSync } from '@/features/sync/useCardSync';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

export default function ProfileScreen() {
  const { cardCount, isSyncing, progress, refresh } = useCardSync();

  return (
    <Screen title="You" meta={metaLine('Local only', 'Sync arrives in M7')}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Card library</Text>
          <Text style={styles.cardBody}>
            {cardCount > 0
              ? `${cardCount.toLocaleString()} cards stored on this device. Browsing, searching, and deckbuilding all work without a connection.`
              : 'No cards stored yet.'}
          </Text>
          {progress?.phase === 'failed' && progress.message ? (
            <Text style={styles.error}>{progress.message}</Text>
          ) : null}
          <Pressable
            onPress={() => void refresh()}
            disabled={isSyncing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
              isSyncing && styles.disabled,
            ]}
          >
            <Text style={styles.buttonLabel}>
              {isSyncing ? (progress?.message ?? 'Refreshing…') : 'Refresh card library'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardBody}>
            Riftbound Tracker is an unofficial fan project. It is not affiliated with, endorsed by,
            or sponsored by Riot Games.
          </Text>
          <Text style={styles.cardBody}>
            Card data comes from Riftcodex. Card images, names, and game text are the property of
            Riot Games, used under Riot&apos;s Legal Jibber Jabber policy for non-commercial fan
            content.
          </Text>
          <Text style={styles.footerMeta}>{metaLine('Riftbound Tracker', 'v0.1.0', 'M1')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[3], paddingBottom: space[8] },
  card: {
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    gap: space[2],
  },
  cardTitle: { ...text.meta, color: color.textMuted },
  cardBody: { ...text.small, color: color.textSecondary },
  error: { ...text.caption, color: color.danger },
  button: {
    marginTop: space[2],
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...text.smallMedium, color: color.text },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  footerMeta: { ...text.microMeta, color: color.textFaint, paddingTop: space[2] },
});
