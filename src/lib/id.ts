/**
 * Row IDs.
 *
 * IDs are generated in JS rather than by SQLite so a row can be referenced
 * before it is written — a deck and its first version reference each other, and
 * one of the two has to exist first.
 *
 * **Hermes ships no Web Crypto global.** `globalThis.crypto.randomUUID()` is
 * not available in React Native and nothing in the bundle polyfills it, so that
 * call throws on the very first deck a user creates. `expo-crypto` provides a
 * real RFC 4122 v4 generator and is bundled in Expo Go.
 *
 * It is reached through a lazy `require` rather than a top-level import because
 * `expo-crypto` pulls in `expo-modules-core`, which cannot load outside a React
 * Native runtime — importing it at the top of this module makes every deck
 * query untestable in Node. Node 19+ has the Web Crypto global natively, so
 * tests take the first branch and never touch the native module.
 */
export function newId(): string {
  const webCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('expo-crypto') as typeof import('expo-crypto')).randomUUID();
}
