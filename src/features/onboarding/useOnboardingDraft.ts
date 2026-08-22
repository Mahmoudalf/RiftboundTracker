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
  /**
   * Opened from Settings rather than met on first launch.
   *
   * It changes exactly one thing — where the flow hands back to — and it lives
   * here rather than in the screen for the same reason everything else does:
   * choosing a language remounts the navigator, and a `useState` flag would be
   * gone by the time the user reached the end.
   */
  replaying: boolean;

  setStep: (step: number) => void;
  setName: (name: string) => void;
  commitName: () => void;
  /**
   * Start a replay from Settings.
   *
   * Seeded with the name the player already has, and marked committed, for two
   * reasons. The obvious one is that retyping a name you set months ago to get
   * past a screen you opened deliberately is busywork. The one that matters is
   * that `finish()` writes the draft's name back — so replaying with a blank
   * draft would **erase** the name, which is the opposite of what reopening a
   * settings flow should do.
   */
  beginReplay: (name: string | null) => void;
  reset: () => void;

  /**
   * What the player chose on the way out, for the Decks tab to act on.
   *
   * **This exists because of a navigation bug worth naming.** `finish()` used to
   * hand over with `router.replace('/deck/import')`, and `replace` swaps the
   * *current* screen — so the import route became the **root** of the Decks
   * stack and the deck list was never in it. Two symptoms, one cause: every
   * later return to the Decks tab landed back on the paste screen, and once
   * `import.tsx` replaced itself with the new deck there was nothing underneath
   * to pop, so the back control did nothing.
   *
   * The fix has to land on the deck list *first* and push from there. Chaining
   * `replace('/')` then `push('/deck/import')` looks equivalent and is not:
   * expo-router queues both and resolves each action's target at drain time
   * (`routingQueue.run`), so the push can be computed against state the replace
   * has not applied yet.
   *
   * Handing the choice to the destination removes the ordering question — the
   * Decks tab is mounted by the time it reads this, which is the guarantee that
   * was missing.
   */
  handoff: DeckHandoff;
  setHandoff: (choice: DeckHandoff) => void;
  /** Read once and clear, so a remount cannot replay the navigation. */
  takeHandoff: () => DeckHandoff;
}

/** Where onboarding sends someone who asked to start with a deck. */
export type DeckHandoff = 'import' | 'new' | null;

const EMPTY = {
  step: 1,
  name: '',
  nameCommitted: false,
  replaying: false,
  /*
   * Cleared by both reset paths on purpose. A handoff left over from an
   * abandoned run would fire the next time the Decks tab mounted, which is the
   * same class of bug as the one it was added to fix — a navigation nobody
   * asked for.
   */
  handoff: null as DeckHandoff,
};

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

export const useOnboardingDraft = create<OnboardingDraft>((set, get) => ({
  ...EMPTY,
  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  // Blank stays uncommitted, so the language rows cannot be revealed by
  // tabbing through an empty field.
  commitName: () => set((s) => ({ nameCommitted: s.name.trim().length > 0 })),
  beginReplay: (name) =>
    set({
      // Reset first, or a replay resumes wherever the last run was abandoned.
      ...EMPTY,
      replaying: true,
      name: name ?? '',
      nameCommitted: (name ?? '').trim().length > 0,
    }),
  /*
   * Called on the way out. The flow is one-shot in production, so this matters
   * only under Fast Refresh and to anyone who reaches it twice in development —
   * both of which are exactly when stale progress is most confusing.
   */
  reset: () => set(EMPTY),

  setHandoff: (handoff) => set({ handoff }),
  // `get()`, not `useOnboardingDraft.getState()` — reaching for the store from
  // inside its own initializer makes the type circular and infers `any`.
  takeHandoff: () => {
    const { handoff } = get();
    if (handoff !== null) set({ handoff: null });
    return handoff;
  },
}));
