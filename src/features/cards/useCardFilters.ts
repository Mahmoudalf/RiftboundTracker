import { create } from 'zustand';

import type { CardFilters, CardSort } from '@/db/queries/cards';

/**
 * Gallery filter state.
 *
 * Kept in a store rather than screen state so the filter sheet, the chip rail,
 * and the deck builder's card rail can all read and mutate the same selection
 * without prop-drilling through a virtualised list.
 */

type FacetKey = 'sets' | 'types' | 'domains' | 'rarities';

interface CardFilterState {
  search: string;
  sets: string[];
  types: string[];
  domains: string[];
  rarities: string[];
  energy: number[];
  hideAlternateArt: boolean;
  sort: CardSort;

  setSearch: (value: string) => void;
  toggle: (key: FacetKey, value: string) => void;
  toggleEnergy: (value: number) => void;
  setSort: (sort: CardSort) => void;
  setHideAlternateArt: (hide: boolean) => void;
  clear: () => void;
  /** Number of active facet selections — drives the badge on the Filters button. */
  activeCount: () => number;
  toQuery: () => CardFilters;
}

const EMPTY = {
  search: '',
  sets: [] as string[],
  types: [] as string[],
  domains: [] as string[],
  rarities: [] as string[],
  energy: [] as number[],
  // Alternate printings are duplicates of cards already in the grid, so they
  // are hidden by default; the toggle lives in the filter sheet for collectors.
  hideAlternateArt: true,
  // Defaults to relevance so typing a search ranks by name match. With no
  // search term relevance is meaningless, and `queryCards` falls back to name.
  sort: 'relevance' as CardSort,
};

const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);

export const useCardFilters = create<CardFilterState>((set, get) => ({
  ...EMPTY,

  setSearch: (search) => set({ search }),

  toggle: (key, value) =>
    set((state) => {
      const current = state[key];
      return {
        [key]: current.includes(value) ? without(current, value) : [...current, value],
      } as Pick<CardFilterState, FacetKey>;
    }),

  toggleEnergy: (value) =>
    set((state) => ({
      energy: state.energy.includes(value)
        ? without(state.energy, value)
        : [...state.energy, value],
    })),

  setSort: (sort) => set({ sort }),
  setHideAlternateArt: (hideAlternateArt) => set({ hideAlternateArt }),

  clear: () => set({ ...EMPTY }),

  activeCount: () => {
    const s = get();
    return (
      s.sets.length + s.types.length + s.domains.length + s.rarities.length + s.energy.length
    );
  },

  toQuery: () => {
    const s = get();
    return {
      search: s.search.trim() || undefined,
      sets: s.sets.length ? s.sets : undefined,
      types: s.types.length ? s.types : undefined,
      domains: s.domains.length ? s.domains : undefined,
      rarities: s.rarities.length ? s.rarities : undefined,
      energy: s.energy.length ? s.energy : undefined,
      hideAlternateArt: s.hideAlternateArt,
      sort: s.sort,
    };
  },
}));
