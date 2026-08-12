import { create } from 'zustand';

/**
 * The confirmation toast, held above the navigator.
 *
 * It lives in a store rather than in the screen that raises it because the
 * log-match sheet **closes** as part of showing it — a toast owned by the sheet
 * would unmount in the same frame it appeared. Undo has to outlive the surface
 * that needed undoing.
 */

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /**
   * How long it stays up.
   *
   * Two very different jobs share this component. An **undoable** action needs
   * long — the person who mis-tapped a result is usually still shuffling — while
   * a plain **confirmation** like "copied" only has to be seen, and lingering
   * turns it into something to dismiss.
   */
  durationMs?: number;
}

/** Long enough to notice a mis-tap and reach for Undo. */
export const TOAST_UNDOABLE_MS = 7000;
/** Long enough to read four words. */
export const TOAST_CONFIRM_MS = 2600;

interface ToastState {
  message: string | null;
  action: ToastAction | null;
  durationMs: number;
  /** Bumped on every show, so a repeat message still restarts the timer. */
  nonce: number;
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  action: null,
  durationMs: TOAST_UNDOABLE_MS,
  nonce: 0,
  show: (message, options) =>
    set((s) => ({
      message,
      action: options?.action ?? null,
      // An undoable toast defaults long; anything else should ask for short.
      durationMs: options?.durationMs ?? TOAST_UNDOABLE_MS,
      nonce: s.nonce + 1,
    })),
  dismiss: () => set({ message: null, action: null }),
}));
