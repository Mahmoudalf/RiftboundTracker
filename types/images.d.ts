/**
 * Static image imports.
 *
 * Metro turns `import Mark from './x.png'` into an entry in React Native's
 * asset registry and hands back its numeric id — the `ImageRequireSource` that
 * `ImageSourcePropType` already accepts. TypeScript has no idea any of that
 * happens, so without this every asset import is `TS2307: cannot find module`.
 *
 * Not covered by `expo-env.d.ts`: that file only references `expo/types`, which
 * declares the framework's own modules and not the bundler's asset handling.
 * It is also generated and gitignored, so anything added to it would vanish on
 * the next `expo start`. This file is checked in for that reason.
 *
 * Picked up through the recursive `.ts` glob in `tsconfig.json` — it needs no
 * `include` entry of its own, which is why it lives at the root rather than
 * beside the code that uses it.
 */

declare module '*.png' {
  const asset: number;
  export default asset;
}

declare module '*.jpg' {
  const asset: number;
  export default asset;
}

declare module '*.svg' {
  const asset: number;
  export default asset;
}
