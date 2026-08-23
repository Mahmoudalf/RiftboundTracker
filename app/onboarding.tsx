import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { DISPLAY_NAME_MAX, completeOnboarding, setDisplayName } from '@/db/queries/settings';
import { setupRevealed, useOnboardingDraft } from '@/features/onboarding/useOnboardingDraft';
import { useCardSync } from '@/features/sync/useCardSync';
import { LOCALES, useLocale, useT, type Locale } from '@/i18n';
import { localeNumber } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Onboarding — welcome, then one progressive setup screen.
 *
 * Built from `1_Onboarding_Welcome` and `1_Onboarding_Setup` in the Hi-Fi
 * design doc. One thing still differs from the mockup, deliberately:
 *
 * - The design's name-field helper reads "Shown on match history and shared
 *   decks", which would be a promise the app cannot keep: nothing reads a
 *   display name yet, and nothing leaves the device at all. It says what is
 *   actually true instead.
 *
 * Everything is skippable. The flow's job is to say what this is and offer a
 * first step, not to gate the app behind a form — a player who taps past every
 * screen still lands somewhere useful, and `completeOnboarding()` runs on every
 * exit so seeing it once is enough.
 */

/** Both steps, so the progress rail and the copy agree on the count. */
const STEPS = 2;

type DeckChoice = 'import' | 'new';

/** What each language calls itself — never translated. Matches Settings. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

/**
 * The English name under each option, as the design draws it.
 *
 * Deliberately **not** translated, and not a miss: a picker that names every
 * language in the language you are already reading helps nobody who has landed
 * in one they cannot read — which is the situation the picker exists for. Same
 * convention as the endonyms above.
 */
const LANGUAGE_SUBTITLES: Record<Locale, string> = {
  en: 'English',
  de: 'German', // i18n-ignore
  fr: 'French', // i18n-ignore
};

export default function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  /*
   * The reveals are the design's one piece of motion, and the one thing a
   * player with vestibular sensitivity would not thank us for. `undefined`
   * entering skips the animation without changing the layout.
   */
  const reduced = useReducedMotion();
  const reveal = reduced ? undefined : FadeInDown.duration(320);
  const revealLate = reduced ? undefined : FadeInDown.duration(320).delay(70);

  /*
   * Progress lives in a store, not in this component.
   *
   * Choosing a language remounts the whole navigator — the root layout keys its
   * `Stack` on the locale — which unmounts this screen. Held in `useState`, the
   * step reset to 1 the instant anyone used the language rows, and the flow
   * became a loop with no exit. See `useOnboardingDraft`.
   */
  const step = useOnboardingDraft((s) => s.step);
  const setStep = useOnboardingDraft((s) => s.setStep);
  const name = useOnboardingDraft((s) => s.name);
  const setName = useOnboardingDraft((s) => s.setName);
  const nameCommitted = useOnboardingDraft((s) => s.nameCommitted);
  const commitName = useOnboardingDraft((s) => s.commitName);
  const replaying = useOnboardingDraft((s) => s.replaying);
  const resetDraft = useOnboardingDraft((s) => s.reset);
  // Set after `reset()`, which clears it — see `finish()`.
  const setHandoff = useOnboardingDraft((s) => s.setHandoff);

  /*
   * The card library, reported rather than hidden behind a spinner.
   *
   * `useCardSync` is a module-scope store, so it needs no draft state of its
   * own — it already survives the locale remount that the step counter does
   * not. Mounting the hook here is also what *starts* the bootstrap on a first
   * launch, which is the moment this screen exists for.
   */
  const { cardCount, isSyncing, progress } = useCardSync();

  const nameField = useRef<TextInput>(null);

  /*
   * Progressive disclosure, on one gate rather than the design's two.
   *
   * The design opens the deck choice only after a language is *chosen*, which
   * dead-ends for anyone the default already suits: English is preselected, so
   * an English speaker has nothing to tap, and the deck options never appear.
   * Both sections open on the name instead — see `setupRevealed`.
   */
  const showSetup = setupRevealed({ name, nameCommitted });

  /*
   * What to say about the library, and whether to draw a bar.
   *
   * Four states, and the distinction that matters is **empty versus seeded**,
   * not syncing versus idle. With cards on the device every message is
   * reassurance; with none, a failure is the one case here worth calling a
   * problem — and even then it does not block the flow.
   */
  const failed = progress?.phase === 'failed';
  const libraryLine =
    cardCount === 0
      ? failed
        ? t('onboarding.library.failedEmpty')
        : progress?.cardsWritten
          ? t('onboarding.library.downloading', { count: localeNumber(progress.cardsWritten) })
          : t('onboarding.library.starting')
      : failed
        ? t('onboarding.library.failed', { count: localeNumber(cardCount) })
        : isSyncing
          ? t('onboarding.library.updating', { count: localeNumber(cardCount) })
          : t('onboarding.library.ready', { count: localeNumber(cardCount) });

  /*
   * A bar only while there is nothing to browse yet and a real fraction to draw.
   *
   * Once the seed has landed the download is genuinely background work, and a
   * progress bar over background work is an invitation to wait for it.
   */
  const libraryBar =
    cardCount === 0 && isSyncing && progress?.progress !== null && progress?.progress !== undefined
      ? Math.round(progress.progress * 100)
      : null;

  /** Every exit runs through here, so the flow can never be seen twice. */
  const finish = (choice: DeckChoice | null) => {
    setDisplayName(name);
    completeOnboarding();
    const wasReplay = replaying;
    resetDraft();

    // A replay was opened *from* somewhere, so it hands back there. Sending
    // someone who tapped a settings row to the Decks tab would read as the app
    // losing their place.
    if (wasReplay && choice === null) {
      router.back();
      return;
    }

    /*
     * Always hand over to the Decks tab, never straight to a sub-route.
     *
     * `replace`, not `push` — onboarding must not be reachable with a back
     * gesture from the app it just handed over to. But `replace` swaps the
     * *current* screen, so replacing onboarding with `/deck/import` made import
     * the **root** of the Decks stack: the deck list was never in it, returning
     * to the tab always landed back on the paste screen, and the deck opened
     * after importing had nothing to go back to.
     *
     * The choice travels in the store instead, and the Decks tab pushes it once
     * it is mounted — which is the ordering guarantee that chaining a `push`
     * behind this `replace` would not give. See `useOnboardingDraft.handoff`.
     */
    if (choice !== null) setHandoff(choice);
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.rail, { paddingTop: insets.top + space[3] }]}>
        {/* Two pills, not "1 / 2" — the design's own progress form, and it
            reads without being counted. The screen-reader gets the words. */}
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.step', { step, total: STEPS })}
          style={styles.pills}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.pill, i === step - 1 && styles.pillOn]} />
          ))}
        </View>
      </View>

      {step === 1 ? (
        <View style={styles.welcome}>
          {/*
            Badge, title, body and the notice are **one** centred group.

            The notice used to sit between this block and the button, outside
            the `flex: 1` that does the centring — so the hero was centred in
            whatever space the notice left rather than on the screen, and sat
            about a tenth of the screen high. The disclaimer is part of what
            this screen has to say, so it belongs inside the thing being said.
          */}
          <View style={styles.intro}>
            {/*
              The mark itself, not a monogram of it.

              This was a 64pt tile reading "RT" — the initials of a name the
              project no longer has. `logo.png` carries a real alpha channel
              (`scripts/make-logo-assets.js`), so it sits on whatever is behind
              it and does not care that this screen happens to be `color.bg`.
            */}
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.mark}
              contentFit="contain"
              accessible={false}
            />
            <Text style={styles.title}>{t('onboarding.welcome')}</Text>
            <Text style={styles.body}>{t('onboarding.welcome.body')}</Text>

            {/*
              The development disclaimer — on the first screen a user ever
              sees, rather than buried in About where nobody looks before using
              the thing. Bordered in the accent so it reads as a notice rather
              than as more body copy, and it names the one consequence a user
              can act on: the data is local, so there is no backup but theirs.
            */}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>{t('onboarding.wip')}</Text>
              <Text style={styles.noticeBody}>{t('onboarding.wip.body')}</Text>
            </View>
          </View>

          {/* The design's 28pt bottom padding, plus whatever the home
              indicator needs. Without the inset the button sat under it. */}
          <View style={{ paddingBottom: insets.bottom + space[6] }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(2)}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaLabel}>{t('onboarding.start')}</Text>
            </Pressable>

            {/*
              The card library, stated under the button rather than in front of it.

              A first launch downloads ~1,451 cards, and the honest thing to say
              about that is that it is happening and nothing is waiting on it —
              the bundled seed means the gallery and the deckbuilder already
              work. A modal spinner would make a background task look like a
              gate, which is the failure this line exists to avoid; it sits
              below the CTA precisely so it cannot read as a reason to wait.
            */}
            <View style={styles.library}>
              {libraryBar !== null ? (
                <View style={styles.libraryTrack}>
                  <View style={[styles.libraryFill, { width: `${libraryBar}%` }]} />
                </View>
              ) : null}
              <Text style={styles.libraryText}>{libraryLine}</Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.setup}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.setupTitle}>{t('onboarding.setup')}</Text>
            <Text style={styles.setupBody}>{t('onboarding.setup.body')}</Text>

            <View style={styles.section}>
              <Text style={styles.label}>{t('onboarding.name')}</Text>
              <TextInput
                ref={nameField}
                value={name}
                onChangeText={setName}
                onBlur={commitName}
                onSubmitEditing={commitName}
                maxLength={DISPLAY_NAME_MAX}
                placeholder={t('onboarding.name.placeholder')}
                placeholderTextColor={color.textFaint}
                style={styles.input}
                returnKeyType="done"
                autoCapitalize="words"
                accessibilityLabel={t('onboarding.name')}
              />
              <Text style={styles.help}>{t('onboarding.name.help')}</Text>

              {/* An explicit way forward for anyone who never dismisses the
                  keyboard — `onBlur` alone leaves the flow looking stuck. */}
              {!showSetup && name.trim().length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    nameField.current?.blur();
                    commitName();
                  }}
                  style={({ pressed }) => [styles.inlineNext, pressed && styles.pressed]}
                >
                  <Text style={styles.inlineNextLabel}>{t('onboarding.name.next')}</Text>
                </Pressable>
              ) : null}
            </View>

            {showSetup ? (
              <Animated.View entering={reveal} style={styles.section}>
                <Text style={styles.label}>{t('onboarding.language')}</Text>
                {LOCALES.map((option) => {
                  const on = option === locale;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setLocale(option)}
                      style={({ pressed }) => [
                        styles.langRow,
                        on && styles.langRowOn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.langText}>
                        <Text style={[styles.langName, on && styles.langNameOn]}>
                          {LANGUAGE_NAMES[option]}
                        </Text>
                        {/* Only under the selected row, as the design has it —
                            the others carry the subtitle at zero opacity. */}
                        {on ? (
                          <Text style={styles.langSub}>
                            {option === 'en'
                              ? t('onboarding.language.default')
                              : LANGUAGE_SUBTITLES[option]}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.check, on && styles.checkOn]}>
                        {/* Was a text `✓`, which no bundled font has. */}
                        {on ? <Icon name="check" size={11} color={color.onAccent} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            ) : null}

            {showSetup ? (
              // Staggered a beat behind the language rows. Both arrive on the
              // same gate, but landing together reads as one slab appearing.
              <Animated.View entering={revealLate} style={styles.section}>
                <Text style={styles.label}>{t('onboarding.firstDeck')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => finish('import')}
                  style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}
                >
                  <Icon name="import" size={22} color={color.text} />
                  <Text style={styles.deckTitle}>{t('onboarding.import')}</Text>
                  <Text style={styles.deckBody}>{t('onboarding.import.body')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => finish('new')}
                  style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}
                >
                  <Icon name="plus" size={22} color={color.text} />
                  <Text style={styles.deckTitle}>{t('onboarding.new')}</Text>
                  <Text style={styles.deckBody}>{t('onboarding.new.body')}</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </ScrollView>

          {/*
            Always offered, not only once the deck section is open.

            The design fades this in with the deck choice, which leaves the
            first thirty seconds of the app with no way out of a form the user
            never asked for. Skipping is the point of an optional flow.
          */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + space[6] }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => finish(null)}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={styles.skipLabel}>{t('onboarding.skip')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },

  rail: { alignItems: 'center' },
  pills: { flexDirection: 'row', gap: space[1.5] },
  // 22×4 at radius 2 — the design's `bar` radius, same as a win-rate bar.
  pill: { width: 22, height: 4, borderRadius: radius.bar, backgroundColor: color.borderControl },
  pillOn: { backgroundColor: color.accent },

  // 20 — the inset the design gives the button. The text block adds its own.
  welcome: { flex: 1, paddingHorizontal: space[5] },
  /*
   * A further 20, for 40 total: the design insets the centred text twice as far
   * as the button beneath it, which is what keeps two centred lines reading as
   * a column rather than as full-width paragraphs that happen to be centred.
   */
  intro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
  },
  /*
   * 96, where the design draws a 64pt tinted tile around a monogram.
   *
   * The tile existed to give two letters a shape; a mark that already has one
   * does not need it, and its accent hairline would now be a second border
   * competing with the notice below. Larger because this is artwork rather
   * than a label — the hexagon's internal detail is what makes it
   * recognisable, and the point of showing it here is that the player meets
   * the same thing they will tap on their home screen.
   */
  mark: { width: 96, height: 96 },
  // The design's 24px/1.3 at -.02em, spelled out rather than inherited: `display`
  // is tuned for a 30px screen title and its tracking does not scale down.
  title: {
    ...text.display,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.48,
    color: color.text,
    textAlign: 'center',
  },
  body: { ...text.small, lineHeight: 21, color: color.textMuted, textAlign: 'center' },

  notice: {
    // Stretches to the text column's full width — without it the notice
    // shrink-wraps its longest line under `intro`'s `alignItems: 'center'`.
    alignSelf: 'stretch',
    gap: space[1.5],
    padding: space[4],
    // A little more air above than the group's 16 gap, so the notice reads as
    // a footnote to the welcome rather than a fourth line of it.
    marginTop: space[2],
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,75,75,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.35)',
  },
  noticeTitle: { ...text.microMeta, color: color.accent },
  noticeBody: { ...text.caption, lineHeight: 19, color: color.textSecondary },

  library: { gap: space[2], paddingTop: space[4], alignItems: 'center' },
  libraryTrack: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: radius.bar,
    backgroundColor: color.border,
    overflow: 'hidden',
  },
  libraryFill: { height: 3, borderRadius: radius.bar, backgroundColor: color.accent },
  // `caption`, not `microMeta`: this is a sentence, and the 9.5px uppercase
  // face is for labels. Muted, because it is a status and not an instruction.
  libraryText: { ...text.caption, lineHeight: 17, color: color.textFaint, textAlign: 'center' },

  cta: {
    height: 52,
    borderRadius: radius.card,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { ...text.bodyMedium, color: color.onAccent },

  setup: { paddingHorizontal: space[6], paddingTop: space[10], paddingBottom: space[6] },
  setupTitle: {
    ...text.display,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.44,
    color: color.text,
  },
  setupBody: { ...text.caption, lineHeight: 20, color: color.textMuted, marginTop: space[2.5] },

  section: { gap: space[2.5], paddingTop: space[6] },
  label: { ...text.microMeta, color: color.textFaint },
  input: {
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: color.borderControl,
    ...text.bodyMedium,
    color: color.text,
  },
  help: { ...text.caption, color: color.textFaint },
  inlineNext: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  inlineNextLabel: { ...text.smallMedium, color: color.onAccent },

  // 56 selected against 40 collapsed, as the design draws it — the chosen row
  // is physically the largest thing in the group.
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  langRowOn: { height: 56, backgroundColor: 'rgba(255,75,75,0.12)', borderColor: 'rgba(255,75,75,0.5)' },
  langText: { gap: 2 },
  langName: { ...text.bodyMedium, color: color.textMuted },
  langNameOn: { color: color.text },
  langSub: { ...text.microMeta, textTransform: 'none', color: color.textFaint },
  check: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: color.accent, borderColor: color.accent },

  deckCard: {
    alignItems: 'center',
    gap: space[1.5],
    // The design draws 14; the 4pt scale has 12 and 16 and no 14. 16 rather
    // than inventing a step for one card.
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deckTitle: { ...text.bodyMedium, color: color.text },
  deckBody: { ...text.caption, color: color.textMuted, textAlign: 'center' },

  footer: { paddingHorizontal: space[5], paddingTop: space[4] },
  skip: {
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: { ...text.bodyMedium, color: color.textSecondary },

  pressed: { opacity: 0.75 },
});
