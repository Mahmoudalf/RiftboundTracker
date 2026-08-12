/**
 * Wilson score interval.
 *
 * Used instead of the normal approximation because a deck tracker lives in
 * exactly the regime where the normal approximation falls apart: small samples
 * and rates near 0 % or 100 %. At 3–0 the textbook interval is [100 %, 100 %],
 * which is not merely imprecise — it is a claim that three games proved
 * something. Wilson gives [43.9 %, 100 %], which is the honest reading.
 *
 *        p̂ + z²/2n  ±  z·√( p̂(1-p̂)/n + z²/4n² )
 *  CI =  ─────────────────────────────────────────
 *                    1 + z²/n
 */

/** 95 % two-sided. */
export const Z_95 = 1.959963984540054;

export interface Interval {
  low: number;
  high: number;
}

export function wilson(successes: number, trials: number, z: number = Z_95): Interval {
  if (trials <= 0) return { low: 0, high: 1 };

  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;

  /*
   * The endpoints are exact, not clamped.
   *
   * At zero successes p̂ = 0, so the margin reduces to exactly the centre and
   * the lower bound is 0 in real arithmetic — but in floating point it lands on
   * 5.6e-17, which is enough to draw a hairline of "wins" on a bar that should
   * be empty. Same by symmetry at the top. Special-casing the two is provably
   * right, where an epsilon would be a guess about how much error to forgive.
   */
  return {
    low: successes === 0 ? 0 : Math.max(0, centre - margin),
    high: successes === trials ? 1 : Math.min(1, centre + margin),
  };
}

/**
 * How many more games, at the current rate, before the interval is narrower
 * than `targetWidth`.
 *
 * This is what turns "not enough data" into an instruction. Capped, because the
 * honest answer near 50 % can be thousands of games and printing that is not
 * advice, it is discouragement.
 */
export function gamesNeeded(
  successes: number,
  trials: number,
  targetWidth = 0.2,
  cap = 200
): number | null {
  if (trials <= 0) return null;
  const rate = successes / trials;

  for (let extra = 1; extra <= cap; extra++) {
    const n = trials + extra;
    const { low, high } = wilson(Math.round(rate * n), n);
    if (high - low <= targetWidth) return extra;
  }
  return null;
}
