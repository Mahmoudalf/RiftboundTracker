const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle ships .sql migration files that Metro must treat as assets.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
