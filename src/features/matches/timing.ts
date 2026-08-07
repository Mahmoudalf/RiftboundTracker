/**
 * Stopwatch for the log-match flow.
 *
 * M4's definition of done is a wall-clock number — under ten seconds from tab
 * bar to confirmation — and no unit test can measure it. A hand-held stopwatch
 * can, but only produces one figure: it cannot say whether a slow run was the
 * sheet taking too long to open or the save path stalling, which are opposite
 * fixes.
 *
 * So the flow marks three points and reports the gaps. `__DEV__` only; every
 * call compiles to a no-op in a release bundle.
 *
 * The numbers are wall-clock on the device, which is the only honest measure —
 * they include the bridge, the render, and SQLite. `logMatch` itself measured
 * 0.025 ms in Node, so anything visible here is interaction cost, not storage.
 */

interface Marks {
  /** The `+` was pressed. */
  start?: number;
  /** The sheet rendered and can be tapped. */
  sheetReady?: number;
  /** The row is committed and the toast is up. */
  logged?: number;
}

let marks: Marks = {};

const stamp = () => Date.now();

/** Called from the tab bar, before navigation — the true start of the flow. */
export function markLogStart(): void {
  if (!__DEV__) return;
  marks = { start: stamp() };
}

export function markSheetReady(): void {
  if (!__DEV__ || !marks.start || marks.sheetReady) return;
  marks.sheetReady = stamp();
  console.log(`[timing] + pressed → sheet ready: ${marks.sheetReady - marks.start} ms`);
}

/**
 * Called when the match row exists and the confirmation is showing.
 *
 * Reports the whole flow and its two halves, so a miss points at a cause rather
 * than at a total.
 */
export function markLogged(): void {
  if (!__DEV__ || !marks.start) return;
  marks.logged = stamp();

  const total = marks.logged - marks.start;
  const toSheet = marks.sheetReady ? marks.sheetReady - marks.start : null;
  const inSheet = marks.sheetReady ? marks.logged - marks.sheetReady : null;

  console.log(
    `[timing] TOTAL tab bar → toast: ${total} ms` +
      (toSheet === null ? '' : ` (open ${toSheet} ms · tapping ${inSheet} ms)`) +
      ` — target 10000 ms · ${total <= 10000 ? 'PASS' : 'MISS'}`
  );
  marks = {};
}

/** A "log another" round starts its own stopwatch from the sheet being ready. */
export function markLogAnother(): void {
  if (!__DEV__) return;
  const now = stamp();
  marks = { start: now, sheetReady: now };
}
