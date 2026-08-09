const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle ships .sql migration files that Metro must treat as assets.
config.resolver.sourceExts.push('sql');

// expo-sqlite ships a WASM build for web; Metro must treat it as an asset or
// the whole bundle fails to resolve. Web is a development aid here — the app
// ships to iOS and Android — but a bundle that cannot build is no aid at all.
config.resolver.assetExts.push('wasm');

/*
 * Cross-origin isolation, for the web target only.
 *
 * expo-sqlite on web is wa-sqlite, which needs SharedArrayBuffer, which the
 * browser only exposes to a cross-origin-isolated page. Without these headers
 * the app throws at the first openDatabaseSync — and since the whole app boots
 * from SQLite, nothing renders at all.
 *
 * "credentialless" rather than "require-corp": card art comes from Riot's CDN
 * without CORP headers, and require-corp would block every image on the very
 * screens this target exists to look at.
 */
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return middleware(req, res, next);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
