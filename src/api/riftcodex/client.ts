import { z } from 'zod';

import {
  cardSchema,
  indexSchema,
  paginated,
  setSchema,
  type ApiCard,
  type ApiSet,
} from './schemas';

/**
 * Riftcodex REST client.
 *
 * Riftcodex is a small fan-run API with no rate limits documented and no cache
 * headers, so this client is deliberately gentle: modest timeouts, capped
 * retries with backoff, and no concurrency. Callers that page through the whole
 * database do so sequentially — see `sync.ts`.
 */

export const BASE_URL = 'https://api.riftcodex.com';

/** The API caps `size` at 100. */
export const MAX_PAGE_SIZE = 100;

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

export class RiftcodexError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RiftcodexError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal
): Promise<z.infer<T>> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 500);

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);

    // Caller abort and timeout both need to cancel the request.
    const onAbort = () => timeout.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      const res = await fetch(url.toString(), {
        signal: timeout.signal,
        headers: { Accept: 'application/json' },
      });

      // 4xx other than 429 will not improve on retry.
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new RiftcodexError(`${res.status} for ${path}`, res.status);
        }
        lastError = new RiftcodexError(`${res.status} for ${path}`, res.status);
        continue;
      }

      const json: unknown = await res.json();
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        // Schema drift is not retryable; surface it so sync can keep the
        // last-known-good mirror rather than wiping it.
        throw new RiftcodexError(
          `Unexpected response shape for ${path}: ${parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')} ${i.message}`)
            .join('; ')}`,
          res.status,
          parsed.error
        );
      }

      return parsed.data;
    } catch (err) {
      if (err instanceof RiftcodexError && err.status && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (signal?.aborted) throw new RiftcodexError('Request cancelled', undefined, err);
      lastError = err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  throw new RiftcodexError(
    `Request failed after ${MAX_RETRIES} attempts: ${path}`,
    undefined,
    lastError
  );
}

const cardPage = paginated(cardSchema);
const setPage = paginated(setSchema);

export interface CardPageParams {
  page?: number;
  size?: number;
  setId?: string;
  sort?: string;
  dir?: 1 | -1;
  isNew?: boolean;
}

export const riftcodex = {
  /**
   * Paginated card list. The only server-side filters are `set_id` and `new` —
   * everything else (type, domain, rarity, cost) is filtered locally against
   * the SQLite mirror. See docs/API.md §4.
   */
  async cards(params: CardPageParams = {}, signal?: AbortSignal) {
    return request('/cards', cardPage, {
      page: params.page,
      size: params.size,
      set_id: params.setId,
      sort: params.sort,
      dir: params.dir,
      new: params.isNew,
    }, signal);
  },

  async card(id: string, signal?: AbortSignal): Promise<ApiCard> {
    return request(`/cards/${encodeURIComponent(id)}`, cardSchema, undefined, signal);
  },

  /** Full-text search on card text. Used only for deck-code import lookups. */
  async searchCards(query: string, params: CardPageParams = {}, signal?: AbortSignal) {
    return request('/cards/search', cardPage, {
      query,
      page: params.page,
      size: params.size,
    }, signal);
  },

  /** Name lookup — `exact` first, `fuzzy` as a fallback. Powers decklist import. */
  async cardsByName(
    opts: { exact?: string; fuzzy?: string },
    signal?: AbortSignal
  ) {
    return request('/cards/name', cardPage, opts, signal);
  },

  async sets(signal?: AbortSignal): Promise<ApiSet[]> {
    const res = await request('/sets', setPage, { size: MAX_PAGE_SIZE }, signal);
    return res.items;
  },

  /**
   * Filter vocabularies. Note the path is `/index/`, singular.
   *
   * The keyword index contains parser artifacts upstream (`11`, `TEXT`, `ADD`)
   * and near-duplicates, so it must be curated before being shown as filters.
   */
  async index(
    name:
      | 'keywords'
      | 'card-names'
      | 'card-types'
      | 'card-supertypes'
      | 'domains'
      | 'rarities'
      | 'artists'
      | 'energy'
      | 'might'
      | 'power'
      | 'tags',
    signal?: AbortSignal
  ) {
    return request(`/index/${name}`, indexSchema, undefined, signal);
  },
};
