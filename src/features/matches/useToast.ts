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

interface ToastState {
  message: string | null;
  action: ToastAction | null;
  /** Bumped on every show, so a repeat message still restarts the timer. */
  nonce: number;
  show: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  action: null,
  nonce: 0,
  show: (message, action) =>
    set((s) => ({ message, action: action ?? null, nonce: s.nonce + 1 })),
  dismiss: () => set({ message: null, action: null }),
}));
