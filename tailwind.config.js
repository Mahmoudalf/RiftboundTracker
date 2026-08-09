const { neutral, semantic, domainUtilities, scrim } = require('./src/theme/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  /*
   * Class-based dark mode.
   *
   * NativeWind defaults to `media`, and on web that makes the colour scheme
   * read-only — the app sets it explicitly and the runtime throws. The app is
   * dark-only, so the media query buys nothing; this is only reachable on the
   * web target used for design verification.
   */
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...neutral,
        ...semantic,
        domain: domainUtilities,
        scrim,
      },
      fontFamily: {
        // Display — Space Grotesk. Technical character without reading as a
        // "gamer" face; the odd g and flat terminals give headers personality.
        display: ['SpaceGrotesk_500Medium'],
        'display-bold': ['SpaceGrotesk_700Bold'],
        // Body — Inter. Proven at the small sizes a dense card list demands.
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        // Metadata — the card-footer idiom: small, uppercase, wide tracking.
        meta: ['SpaceGrotesk_500Medium'],
      },
      fontSize: {
        // Tuned for a phone held at arm's length in a noisy tournament hall.
        micro: ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        meta: ['11px', { lineHeight: '15px', letterSpacing: '0.10em' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['15px', { lineHeight: '21px' }],
        lg: ['17px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '26px' }],
        '2xl': ['24px', { lineHeight: '30px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        // Stat readouts — a win rate should be legible across a table.
        stat: ['40px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
        'stat-lg': ['56px', { lineHeight: '58px', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        card: '10px', // matches the printed card corner
      },
    },
  },
  plugins: [],
};
