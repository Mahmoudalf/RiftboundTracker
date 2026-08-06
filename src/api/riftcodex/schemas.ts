import { z } from 'zod';

/**
 * Wire schemas for the Riftcodex API.
 *
 * The API describes itself as "an active work in progress" (v0.2.0), so every
 * response is validated at the boundary. Optional-ish fields are modelled
 * permissively on purpose: a new nullable column upstream should never take the
 * app down, and unknown fields are simply ignored.
 *
 * Reference: docs/API.md
 */

export const attributesSchema = z.object({
  energy: z.number().int().nullish(),
  might: z.number().int().nullish(),
  power: z.number().int().nullish(),
});

export const classificationSchema = z.object({
  type: z.string(),
  supertype: z.string().nullish(),
  rarity: z.string(),
  domain: z.array(z.string()).default([]),
});

export const cardTextSchema = z.object({
  rich: z.string().nullish(),
  plain: z.string().nullish(),
  flavour: z.string().nullish(),
});

export const cardSetRefSchema = z.object({
  set_id: z.string(),
  label: z.string(),
});

export const mediaSchema = z.object({
  image_url: z.string().nullish(),
  artist: z.string().nullish(),
  accessibility_text: z.string().nullish(),
});

export const metadataSchema = z.object({
  clean_name: z.string().nullish(),
  updated_on: z.string().nullish(),
  alternate_art: z.boolean().default(false),
  overnumbered: z.boolean().default(false),
  signature: z.boolean().default(false),
});

export const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  riftbound_id: z.string(),
  tcgplayer_id: z.string().nullish(),
  collector_number: z.number().int().nullish(),
  attributes: attributesSchema,
  classification: classificationSchema,
  text: cardTextSchema,
  set: cardSetRefSchema,
  media: mediaSchema,
  tags: z.array(z.string()).default([]),
  orientation: z.string().default('portrait'),
  metadata: metadataSchema,
  new: z.boolean().nullish(),
});

export type ApiCard = z.infer<typeof cardSchema>;

/**
 * `cardmarket_id` is polymorphic upstream — a bare string for Origins but an
 * array for the promo sets. Normalised to an array here so consumers never
 * have to branch on it.
 */
const cardmarketIdSchema = z
  .union([z.string(), z.array(z.string())])
  .nullish()
  .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]));

export const setSchema = z.object({
  id: z.string(),
  name: z.string(),
  set_id: z.string(),
  card_count: z.number().int(),
  tcgplayer_id: z.string().nullish(),
  cardmarket_id: cardmarketIdSchema,
  published_on: z.string().nullish(),
});

export type ApiSet = z.infer<typeof setSchema>;

/** `{ items, total, page, size, pages }` */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    size: z.number().int(),
    pages: z.number().int(),
  });
}

export const indexSchema = z.object({
  total: z.number().int(),
  type: z.string(),
  values: z.array(z.union([z.string(), z.number()])),
});

export type ApiIndex = z.infer<typeof indexSchema>;
