/**
 * Stopwatch for opening the deck editor.
 *
 * Reported from a device as "about half a second", and the roadmap deliberately
 * refused to guess at the cause — the data reads were already measured at
 * 4.18 ms for a query across the whole library and 0.79 ms for hydration, so
 * the five small reads the editor performs cannot account for it.
 *
 * Two candidates were left, and they want opposite fixes: the **first render**
 * (the list view mounted every candidate before it could draw) or the
 * **navigation transition** (a stack push animates for ~300 ms, which is not a
 * delay before the screen arrives so much as the screen arriving slowly).
 *
 * One number cannot tell them apart, so this marks three points:
 *
 *   tap → mounted    navigation and module work
 *   mounted → loaded the queries, which should be single-digit
 *   loaded → painted the render, which is where a 385-row list would show
 *
 * Modelled on `features/games/timing.ts`, which did the same job for the
 * ten-second logging budget. `__DEV__` only — every call is a no-op in release.
 */

interface Marks {
  /** Edit was pressed on deck detail, before navigation. */
  start?: number;
  /** The editor component ran its first render. */
  mounted?: number;
  /** The deck and the candidate pool are in hand. */
  loaded?: number;
}

let marks: Marks = {};

const stamp = () => Date.now();

/** Called from the Edit control, before `router.push` — the true start. */
export function markEditTap(): void {
  if (!__DEV__) return;
  marks = { start: stamp() };
}

export function markEditorMounted(): void {
  if (!__DEV__ || !marks.start || marks.mounted) return;
  marks.mounted = stamp();
}

export function markEditorLoaded(): void {
  if (!__DEV__ || !marks.start || marks.loaded) return;
  marks.loaded = stamp();
}

/**
 * Called after the first frame that includes the candidate list.
 *
 * Reports the whole open and its three parts, so a slow run points at a cause
 * rather than at a total.
 */
export function markEditorPainted(rows: number): void {
  if (!__DEV__ || !marks.start) return;

  const painted = stamp();
  const total = painted - marks.start;
  const toMount = marks.mounted ? marks.mounted - marks.start : null;
  const toLoad = marks.mounted && marks.loaded ? marks.loaded - marks.mounted : null;
  const toPaint = marks.loaded ? painted - marks.loaded : null;

  console.log(
    `[timing] Edit pressed → editor painted: ${total} ms ` +
      `(nav ${toMount ?? '?'} ms · queries ${toLoad ?? '?'} ms · render ${toPaint ?? '?'} ms) ` +
      `— ${rows} candidate rows`
  );
  marks = {};
}
