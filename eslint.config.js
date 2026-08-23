const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'assets/seed/**'],
  },
  {
    rules: {
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      /**
       * React Native's own `Pressable` must not be used directly.
       *
       * NativeWind's JSX interop silently drops a function-valued `style`
       * (`({ pressed }) => ...`). The element then renders with no style at
       * all — and because a primary button loses its background while keeping
       * its foreground colour, the result is a dark label on a dark surface:
       * correctly positioned, fully tappable, and invisible. It shipped that
       * way across 26 call sites and was only caught by measuring a button that
       * reported 21.33 dp tall against a declared `minHeight: 48`.
       *
       * `@/components/ui/Pressable` resolves the function before the style
       * reaches the native component. It is a drop-in with the same signature.
       */
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Pressable'],
              message:
                'Import Pressable from "@/components/ui/Pressable" instead. NativeWind drops function-valued style props on the React Native one, which renders the control invisible. See src/components/ui/Pressable.tsx.',
            },
          ],
        },
      ],
    },
  },
  {
    // The wrapper is the one place that may reach for the real component.
    files: ['src/components/ui/Pressable.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    /**
     * Build-time code, not app code. Expo config plugins and repo scripts run
     * in Node under CommonJS, so `__dirname`, `require` and `module` are real
     * globals here — the app config treats them as undefined because a React
     * Native bundle has no such thing.
     */
    files: ['plugins/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', require: 'readonly', module: 'writable' },
    },
    rules: { 'import/order': 'off' },
  },
];
