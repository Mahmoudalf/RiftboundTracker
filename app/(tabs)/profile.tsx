import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChoiceRow, SectionLabel } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { DISPLAY_NAME_MAX, displayName, setDisplayName } from '@/db/queries/settings';
import { useOnboardingDraft } from '@/features/onboarding/useOnboardingDraft';
import { useCardSync } from '@/features/sync/useCardSync';
import { LOCALES, useLocale, useT, type RuntimeLocale } from '@/i18n';
import { localeNumber } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Settings.
 *
 * Four things a player can change or read about the app, and nothing else. It
 * was "You" — a name that promised an account the app does not have — and the
 * screen has never been about a person. It is where the app is configured.
 *
 * Order is by how often it is wanted: the name and the language are settings,
 * the card library is a maintenance action, and the last two cards are about
 * the app rather than the player's use of it.
 */

/** What each language calls itself — never translated. */
const LANGUAGE_NAMES: Record<RuntimeLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  pseudo: 'Pseudo',
};

/**
 * The version, read rather than typed.
 *
 * The About card carried a hand-written `v0.1.0`, which is the same shape of
 * mistake as the `M1` label that sat there for five milestones: a fact about
 * the build, written by hand, with nothing keeping it true. `app.json` is the
 * one place a version is actually set.
 */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export default function SettingsScreen() {
  const { cardCount, isSyncing, progress, refresh } = useCardSync();
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const beginReplay = useOnboardingDraft((s) => s.beginReplay);

  const [name, setName] = useState<string | null>(null);

  /** So tapping anywhere in the name field — including the pencil — focuses it. */
  const nameField = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      setName(displayName());
    }, [])
  );

  /*
   * The pseudo-locale is offered only in development.
   *
   * It is not a language — it is English lengthened and accented to find the
   * places a translation will break the layout. Shipping it in a picker would
   * offer a player a broken app as a choice.
   */
  const options: RuntimeLocale[] = __DEV__ ? [...LOCALES, 'pseudo'] : [...LOCALES];

  /*
   * No milestone number in the header, for the same reason the About card below
   * carries none. "Sync arrives in M7" told a player nothing except that the
   * developer has a numbering scheme — and it went stale the moment Localization
   * entered as M7 and pushed Cloud to M8. What the line has to say is that
   * nothing leaves the phone yet, which stays true until it isn't.
   */
  return (
    <Screen
      title={t('profile.title')}
      meta={metaLine(t('profile.localOnly'), t('profile.nothingLeaves'))}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/*
          The name, first.

          Not because it is the most useful — it does nothing yet — but because
          it is the one field on this screen that is *about* the player, and
          burying a personal field under maintenance actions reads as an
          afterthought.
        */}
        <View style={styles.card}>
          <SectionLabel>{t('profile.name')}</SectionLabel>
          <Pressable
            accessibilityRole="none"
            onPress={() => nameField.current?.focus()}
            style={styles.nameField}
          >
            <TextInput
              ref={nameField}
              value={name ?? ''}
              onChangeText={setName}
              // Written on blur rather than per keystroke, as everywhere else a
              // name is edited: one write per rename instead of one per letter.
              onBlur={() => {
                setDisplayName(name);
                // Read back rather than trusting the draft — the store trims and
                // caps, and the field should show what was actually kept.
                setName(displayName());
              }}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={color.textFaint}
              style={styles.nameInput}
              returnKeyType="done"
              accessibilityLabel={t('profile.name.a11y')}
            />
            <Icon name="pencil" size={15} color={color.textMuted} />
          </Pressable>
          <Text style={styles.cardBody}>{t('profile.nameHelp')}</Text>
        </View>

        {/*
          Language, above everything that is only prose.

          A player who opened this screen to find their language should not have
          to read past English paragraphs to reach it.
        */}
        <View style={styles.card}>
          <SectionLabel>{t('profile.language')}</SectionLabel>
          <ChoiceRow<RuntimeLocale>
            options={options.map((l) => ({ key: l, label: LANGUAGE_NAMES[l], value: l }))}
            value={locale}
            onSelect={setLocale}
          />
          <Text style={styles.cardBody}>{t('profile.languageHelp')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.library')}</Text>
          <Text style={styles.cardBody}>
            {/* These four strings have had German and French since the
                translation pass; the screen was still rendering the English
                literals it was written with. */}
            {cardCount > 0
              ? t('profile.library.stored', { count: localeNumber(cardCount) })
              : t('profile.library.empty')}
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
              {isSyncing
                ? (progress?.message ?? t('profile.library.refreshing'))
                : t('profile.library.refresh')}
            </Text>
          </Pressable>
        </View>

        {/*
          The feedback card stood here — a category picker, a text field, and a
          button that copied to the clipboard because there was nowhere to send.

          **Removed 2026-08-19, on the owner's call.** The test group is small
          enough to reach the owner directly, and a form whose whole function is
          "copy this, then find me yourself" was a control pretending to be a
          feature. A real one comes with the backend, where a report can
          actually go somewhere. The decision and the four routes weighed are in
          `docs/ROADMAP.md`; the constraint that survives is that whatever
          replaces it attaches nothing about the device.
        */}

        {/*
          The welcome flow, reopenable.

          It seeds the draft with the name already stored and marks it
          committed. That is not a convenience: `finish()` writes the draft's
          name back, so replaying from a blank draft would **erase** a name the
          player set months ago — a settings screen that quietly deletes a
          setting when you look at it. The language needs no such care; the
          picker reads the live store and only writes when tapped.
        */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.replay')}</Text>
          <Text style={styles.cardBody}>{t('profile.replay.body')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              beginReplay(displayName());
              router.push('/onboarding');
            }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>{t('profile.replay')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.about')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.unofficial')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.attribution')}</Text>
          {/*
            Riot's required notices, verbatim and in English in every language.
            They sit *below* the two strings above rather than replacing them:
            the plain-language pair is what a player reads and understands, and
            these are the compliance artefact — Riot specifies the notice as
            wording, so a paraphrase does not satisfy it. Set faint and small
            because that is what a legal notice looks like, not because it is
            being hidden; both policies ask only that it be conspicuous, and a
            legible line on the About card is the conventional place. See
            `docs/STORE.md` §5 for the policy text and why both are carried.
          */}
          <Text style={styles.legal}>{t('profile.about.riotFan')}</Text>
          <Text style={styles.legal}>{t('profile.about.riotDev')}</Text>
          {/* No milestone here. It read "M1" for five milestones because a
              hand-written stage label has nothing keeping it true. */}
          <Text style={styles.footerMeta}>
            {metaLine('Riftbound Tracker', `v${APP_VERSION}`)}
          </Text>
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

  /*
   * `SelectField`'s geometry — 52 high, `radius.lg`, 6 % fill, 14 % border — so
   * the name is asked for here exactly as it is in the deck editor and in a
   * binder. The **field** draws the box; `nameInput` is bare text inside it.
   */
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  nameInput: { ...text.body, color: color.text, flex: 1, padding: 0 },

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
  /*
   * Riot's required notices.
   *
   * `caption`, not `microMeta`: the meta face is uppercase mono at 9.5 drawn
   * for two-word labels, and three lines of tracked capitals at that size stop
   * being readable about where the sentence gets interesting. These are the one
   * thing on the card that must survive being read.
   *
   * Faint, but not disabled. Both policies use the word *conspicuous*, which
   * rules out hiding it and does not require it to outrank the plain-language
   * copy above.
   */
  legal: { ...text.caption, color: color.textFaint, paddingTop: space[2] },
});
