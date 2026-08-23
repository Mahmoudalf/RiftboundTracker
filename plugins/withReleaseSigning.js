const fs = require('fs');
const path = require('path');
const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release signing for Android, applied at prebuild time.
 *
 * `android/` is generated and gitignored, so the signing config cannot live in
 * `android/app/build.gradle` — `expo prebuild` would delete it. It lives here
 * and is re-injected on every regeneration.
 *
 * The property this exists to buy is **a release build never falls back to the
 * debug key.** Expo's template ships `buildTypes.release { signingConfig
 * signingConfigs.debug }`, which produces a release APK that builds fine, looks
 * fine, and can never be updated on a store listing. Adding a `release` signing
 * config without removing that line changes nothing. So this plugin replaces it,
 * and fails the build loudly if the keystore or its passwords are missing.
 *
 * Three ways this refuses to fail silently:
 *
 *   1. Every anchor below is asserted. If a future Expo template renames or
 *      reformats one, `prebuild` throws instead of quietly leaving debug
 *      signing in place.
 *   2. Gradle throws a `GradleException` naming exactly what is missing, but
 *      only when the task graph actually contains a release packaging task —
 *      debug builds and IDE syncs stay unaffected.
 *   3. The block is marked and detected, so a prebuild without `--clean` cannot
 *      double-inject it.
 *
 * Credentials come from `credentials/keystore.properties` (untracked, see
 * `.gitignore`), or from environment variables of the same names for CI, which
 * has no such file. Neither the keystore nor the passwords are ever read by
 * this file — it only writes the Gradle that reads them at build time.
 */

const MARKER = 'rifthall-release-signing';

// The Groovy lives in its own file rather than a template literal in here.
// It contains both `$` and `\n`, and passing those through a JS string is a
// layer of escaping that silently produced a broken build file once already —
// the escapes resolved before Groovy ever saw them. A .gradle file has no such
// layer, and an editor will syntax-highlight it.
const CREDENTIALS_BLOCK = fs.readFileSync(path.join(__dirname, 'release-signing.gradle'), 'utf8');

const SIGNING_CONFIG = `        release {
            // Populated only when the keystore is present. When it is absent the
            // task-graph check above has already failed the build, so an empty
            // config here can never reach the packager.
            if (rifthallStoreFile != null && rifthallStoreFile.exists()) {
                storeFile rifthallStoreFile
                storePassword rifthallSetting('RELEASE_STORE_PASSWORD')
                keyAlias rifthallSetting('RELEASE_KEY_ALIAS')
                keyPassword rifthallSetting('RELEASE_KEY_PASSWORD')
            }
        }
`;

function inject(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const assert = (anchor, label) => {
    if (!contents.includes(anchor)) {
      throw new Error(
        `withReleaseSigning: could not find ${label} in android/app/build.gradle. ` +
          `The Expo template changed. Refusing to prebuild rather than leave the release ` +
          `build signed with the Android debug key.`
      );
    }
    if (contents.split(anchor).length > 2) {
      throw new Error(`withReleaseSigning: ${label} appears more than once in android/app/build.gradle.`);
    }
  };

  const androidBlock = '\nandroid {';
  const signingConfigs = '    signingConfigs {\n        debug {';
  const debugRelease =
    '            // Caution! In production, you need to generate your own keystore file.\n' +
    '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
    '            signingConfig signingConfigs.debug\n';

  assert(androidBlock, 'the `android {` block');
  assert(signingConfigs, 'the `signingConfigs { debug {` block');
  assert(debugRelease, 'the release build type\'s debug-key signingConfig');

  return contents
    .replace(androidBlock, `\n${CREDENTIALS_BLOCK}\nandroid {`)
    .replace(signingConfigs, `    signingConfigs {\n${SIGNING_CONFIG}        debug {`)
    .replace(debugRelease, '            signingConfig signingConfigs.release\n');
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withReleaseSigning: expected a Groovy build.gradle, got ${cfg.modResults.language}.`
      );
    }
    cfg.modResults.contents = inject(cfg.modResults.contents);
    return cfg;
  });

module.exports = withReleaseSigning;
