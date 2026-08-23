/**
 * Removes permissions Expo's project template hands out and this app does not use.
 *
 * **Where the permission actually comes from, because the obvious answer is wrong.**
 * `SYSTEM_ALERT_WINDOW` — "draw over other apps" — ships in the release APK. Grepping
 * `node_modules` for it finds exactly one `AndroidManifest.xml`, in
 * `react-native/ReactAndroid/src/debug/`, which makes it look like debug material leaking into a
 * release artifact. It is not. AGP's merger blame report
 * (`android/app/build/outputs/logs/manifest-merger-release-report.txt`) names the real contributor:
 *
 *     uses-permission#android.permission.SYSTEM_ALERT_WINDOW
 *     ADDED from .../android/app/src/main/AndroidManifest.xml:4:3-75
 *
 * It comes from **our own generated main manifest**, which `expo prebuild` writes from the
 * bare-minimum template in `@expo/config-plugins`. That template's own comment reads
 * `<!-- OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED -->`. So this is scaffolding doing
 * what it says on the tin, and the reason nobody ever pruned it is that `android/` is regenerated
 * on every prebuild — the instruction is addressed to a project that keeps its native folder.
 *
 * The variant machinery is fine, and was checked rather than assumed: the release and debug merged
 * manifests carry the *same* 7 permissions and 5 components, but debug alone carries
 * `debuggable=true` and `usesCleartextTraffic=true`. Debug-only material is correctly confined to
 * debug; the permissions match because they come from sources common to both.
 *
 * **Only one permission is removed, and the other three questionable ones are kept on purpose.**
 * `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are capped at `maxSdkVersion="32"`, so they
 * are inert on Android 13+. Glide, inside `expo-image`, declares the read one for its local cache
 * path. Removing them risks a subtle image-caching regression on API 24–32 that could only be
 * disproved on an old device nobody here has — low reward, unprovable safety. They also carry
 * `tools:replace="android:maxSdkVersion"` markers from the template, which a removal would have to
 * reason about. Left alone, deliberately.
 *
 * `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE` and the AndroidX-generated
 * `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` are all justified. See
 * `scripts/audit-permissions.ts`, which holds the allowlist and fails on anything new.
 */
const { withAndroidManifest } = require('expo/config-plugins');

/** Removed, with the reason recorded next to it rather than in a commit message. */
const REMOVE = {
  'android.permission.SYSTEM_ALERT_WINDOW':
    'no overlay feature exists, and the dev menu it serves is not in a release build',
};

const TOOLS_NS = 'http://schemas.android.com/tools';

module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    /*
     * The template already declares xmlns:tools, so `tools:node` resolves. Assert it rather than
     * rely on it: without the namespace the attribute is inert, the merger says nothing, and the
     * permission would quietly still ship.
     */
    if (manifest.$?.['xmlns:tools'] !== TOOLS_NS) {
      throw new Error(
        `[withTrimmedPermissions] <manifest> is missing xmlns:tools="${TOOLS_NS}". ` +
          'tools:node="remove" would be ignored silently.'
      );
    }

    const permissions = manifest['uses-permission'];
    if (!Array.isArray(permissions)) {
      throw new Error('[withTrimmedPermissions] no <uses-permission> elements in the manifest.');
    }

    for (const [name, why] of Object.entries(REMOVE)) {
      const entry = permissions.find((p) => p.$?.['android:name'] === name);
      /*
       * Fail loudly when there is nothing to remove.
       *
       * If Expo drops the permission from its template upstream, a silent no-op would leave this
       * plugin looking load-bearing for years while doing nothing. Better to break a prebuild once
       * and delete the entry here than to carry a lie.
       */
      if (!entry) {
        throw new Error(
          `[withTrimmedPermissions] expected ${name} in the generated manifest and it is absent. ` +
            `It was removed because ${why}. Upstream may have stopped declaring it — check the ` +
            'merger blame report, then drop this entry from REMOVE.'
        );
      }
      /*
       * `tools:node="remove"` rather than dropping the element. Deleting it here would only stop
       * *our* manifest contributing it; the marker also strips any contribution merged in from a
       * library, which is what makes the result independent of who declares it.
       */
      entry.$['tools:node'] = 'remove';
    }

    return config;
  });
