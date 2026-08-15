import { create } from 'zustand';

/**
 * Onboarding's in-flight progress, held outside the component.
 *
 * This exists for one reason, and it is not preference: **choosing a language
 * remounts the navigator.** The root layout keys its `Stack` on the locale so
 * that every screen re-reads every string at once (see the comment there), and
 * a keyed remount unmounts whatever is on screen — including the onboarding
 * screen, taking `useState` with it.
 *
 * With the step in component state that produced a loop with no way out: pick a
 * language on step 2, the tree remounts, the screen comes back at step 1, and
 * the only way to reach the language rows again is to walk forward and trip the
 * same wire. The one control the flow exists to offer was the one that reset it.
 *
 * Module scope survives the remount, so the screen comes back exactly where it
 * was, now speaking the language just chosen.
 *
 * Deliberately **not** persisted to the database. This is the state of a form
 * someone is halfway through, not a setting — the name is written on finish,
 * and a flow abandoned by force-quitting the app should start clean.
 */

interface OnboardingDraft {
  /** 1-based, matching the progress rail. */
  step: number;
  name: string;
  /** The name field has been left with something in it — opens the rest. */
  nameCommitted: boolean;

  setStep: (step: number) => void;
  setName: (name: string) => void;
  commitName: () => void;
  reset: () => void;
}

const EMPTY = { step: 1, name: '', nameCommitted: false };

/**
 * Whether the language rows and the deck choice are shown.
 *
 * **One gate, not two.** The design reveals the deck choice only after a
 * language is *chosen*, which works on paper and dead-ends in practice: English
 * is selected by default, so an English speaker has nothing to choose. Tapping
 * the row they are already on is not an action anyone takes, and the flow ended
 * there with the deck options never appearing.
 *
 * Both sections now open together on the name. A default that is already
 * correct must never require confirming.
 */
export function setupRevealed(draft: Pick<OnboardingDraft, 'name' | 'nameCommitted'>): boolean {
  return draft.nameCommitted && draft.name.trim().length > 0;
}

export const useOnboardingDraft = create<OnboardingDraft>((set) => ({
  ...EMPTY,
  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  // Blank stays uncommitted, so the language rows cannot be revealed by
  // tabbing through an empty field.
  commitName: () => set((s) => ({ nameCommitted: s.name.trim().length > 0 })),
  /*
   * Called on the way out. The flow is one-shot in production, so this matters
   * only under Fast Refresh and to anyone who reaches it twice in development —
   * both of which are exactly when stale progress is most confusing.
   */
  reset: () => set(EMPTY),
}));
