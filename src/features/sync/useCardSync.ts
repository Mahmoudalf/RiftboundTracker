import { useEffect } from 'react';
import { create } from 'zustand';

import {
  cardCount,
  loadSeedIfEmpty,
  syncCards,
  type SyncProgress,
  type SyncResult,
} from '@/api/riftcodex/sync';

/**
 * Card mirror state.
 *
 * Deliberately a store rather than per-component `useState`. The hook is called
 * from more than one screen (the gallery and Profile), and component-local
 * state meant each call site kept its own copy: refreshing from Profile left
 * the gallery's card count stale, and a component-local "already started" ref
 * could not stop two screens from syncing at once — which, before the TTL had
 * been written, meant two concurrent 15-page walks of a small fan-run API.
 *
 * The two module-level promises below are what actually enforce "once":
 * `bootstrapPromise` for first-launch seed + sync, `inFlight` for every sync
 * after that. Both are module scope on purpose — a ref inside the hook is
 * per-component and cannot coordinate across screens.
 */

interface CardSyncState {
  cardCount: number;
  progress: SyncProgress | null;
  setProgress: (progress: SyncProgress) => void;
  refreshCount: () => void;
}

const useStore = create<CardSyncState>((set) => ({
  cardCount: cardCount(),
  progress: null,
  setProgress: (progress) => set({ progress }),
  refreshCount: () => set({ cardCount: cardCount() }),
}));

/** Non-null while a sync is running, so concurrent callers join it. */
let inFlight: Promise<SyncResult> | null = null;
/** Non-null once bootstrap has been kicked off, so it happens exactly once. */
let bootstrapPromise: Promise<void> | null = null;

function runSync(force: boolean): Promise<SyncResult> {
  // A second caller gets the first call's promise rather than its own request.
  if (inFlight) return inFlight;

  const { setProgress, refreshCount } = useStore.getState();

  inFlight = syncCards({ force, onProgress: setProgress })
    .then((result) => {
      refreshCount();
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    // The bundled snapshot loads first so the gallery is usable within a frame
    // or two; only then does the network sync run.
    const seeded = await loadSeedIfEmpty();
    if (seeded > 0) useStore.getState().refreshCount();

    // A first launch with no seed has an empty gallery, so that one sync is
    // forced past the TTL guard.
    await runSync(useStore.getState().cardCount === 0);
  })();

  return bootstrapPromise;
}

export function useCardSync() {
  const count = useStore((s) => s.cardCount);
  const progress = useStore((s) => s.progress);

  useEffect(() => {
    void bootstrap();
  }, []);

  const isSyncing =
    progress !== null &&
    progress.phase !== 'done' &&
    progress.phase !== 'skipped' &&
    progress.phase !== 'failed';

  return {
    cardCount: count,
    progress,
    isSyncing,
    isEmpty: count === 0,
    refresh: () => runSync(true),
  };
}

/** Test seam — resets the module-level guards between cases. */
export function __resetCardSync() {
  inFlight = null;
  bootstrapPromise = null;
}
