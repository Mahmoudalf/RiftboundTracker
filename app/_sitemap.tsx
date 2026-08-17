import { Redirect } from 'expo-router';

/**
 * Overrides expo-router's built-in `/_sitemap`, which otherwise ships.
 *
 * ## Why this file exists
 *
 * `app.json` declares `scheme: "riftbound"` and there is no linking config, so
 * expo-router's default applies: **every route is reachable as a deep link**.
 * That includes `_sitemap`, a development screen listing every route in the app
 * — and it is not dev-only. Confirmed in the release bundle's source map:
 *
 * ```
 * /node_modules/expo-router/build/views/Sitemap.js
 * /node_modules/expo-router/build/views/useSitemap.js
 * ```
 *
 * So a shipped build answers `riftbound://_sitemap` with a map of itself. Minor
 * information disclosure on its own, and the same class as gap 21, where
 * `version-selfcheck` sat in the production bundle for five milestones behind a
 * `__DEV__` guard that hid the button but not the module.
 *
 * ## Why a route override rather than a config
 *
 * **There is no app-facing configuration for this.** expo-router does have a
 * `sitemap: false` option — `getRoutesCore.js:426` reads `options.sitemap !==
 * false` — but it is passed to `ExpoRoot` through a `config` prop owned by the
 * generated entry point, not surfaced through `app.json`, the config plugin, or
 * any public export.
 *
 * A file here is the supported mechanism: `appendSitemapRoute` only generates
 * the internal route when the app has not provided one —
 * `if (!directory.files.has('_sitemap'))`, `getRoutesCore.js:620`. This is a
 * deliberate override, not an accident.
 *
 * ## Why a redirect rather than an empty screen
 *
 * Rendering `null` leaves anyone who follows the link on a blank screen with no
 * way forward, which is a worse answer than the one they were looking for. A
 * redirect makes the link a no-op: it opens the app, which is exactly what
 * `riftbound://` should ever do.
 *
 * **The development sitemap is given up, and that costs nothing.** The same
 * information — every route, with its parameters — is in
 * `.expo/types/router.d.ts`, regenerated on every `expo start`, which is where
 * a developer would look anyway.
 */
export default function SitemapDisabled() {
  return <Redirect href="/" />;
}
