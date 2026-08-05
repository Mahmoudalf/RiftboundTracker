# Riftcodex API Reference

Working notes on the card-data API. Everything here was **verified against the live API on
2026-08-05** against version `0.2.0`. The API describes itself as "an active work in progress", so
treat this document as a snapshot and re-verify when card sync starts misbehaving.

- **Base URL:** `https://api.riftcodex.com`
- **Docs:** <https://riftcodex.com/docs>
- **OpenAPI spec:** <https://api.riftcodex.com/openapi.json> (~27 KB — generate TS types from it)
- **Authentication:** none required for reads
- **Format:** JSON
- **Hosting:** FastAPI on Railway, behind Cloudflare

> Riftcodex is an unofficial fan project, not affiliated with Riot Games. It is run by a small team
> on modest infrastructure. Sync gently — see §6.

---

## 1. Endpoints

### Cards

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/cards` | Paginated list. Query: `page`, `size`, `set_id`, `new`, `sort`, `dir` |
| `GET` | `/cards/search` | Full-text search on card text. Requires `query` |
| `GET` | `/cards/name` | Name lookup. `exact` or `fuzzy` (both case-insensitive) |
| `GET` | `/cards/{id}` | Single card by Riftcodex ID |
| `GET` | `/cards/riftbound/{id}` | By Riftbound ID (e.g. `ogn-011-298`), supports partial matching |
| `GET` | `/cards/tcgplayer/{tcgplayer_id}` | By TCGPlayer product ID |

**Parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1` | |
| `size` | int 1–100 | `50` | **Hard max 100** — governs sync page count |
| `set_id` | string | — | Case-insensitive, e.g. `ogn`, `unl` |
| `new` | bool | — | Filter to newly added cards |
| `sort` | enum | — | `name`, `collector_number`, `public_code`, `type`, `supertype`, `rarity`, `domain`, `artist`, `set_id`, `set_label`, `energy`, `might`, `power` |
| `dir` | int | `1` | `1` ascending, `-1` descending |

### Sets

| Method | Path |
| --- | --- |
| `GET` | `/sets` (paginated: `page`, `size`) |
| `GET` | `/sets/{id}` |
| `GET` | `/sets/set-id/{set_id}` (case-insensitive) |
| `GET` | `/sets/tcgplayer/{tcgplayer_id}` |
| `GET` | `/sets/cardmarket/{cardmarket_id}` |

### Index (filter vocabularies)

> ⚠️ The path segment is **`/index/`**, singular — not `/indexes/`. `/indexes/...` returns 404.

`/index/keywords` · `/index/card-names` · `/index/card-types` · `/index/card-supertypes` ·
`/index/domains` · `/index/rarities` · `/index/artists` · `/index/energy` · `/index/might` ·
`/index/power` · `/index/tags`

All return `{ "total": int, "type": string, "values": [...] }`.

### Operational

`GET /health` · `GET /metrics`

---

## 2. Response shapes

### Pagination envelope

```jsonc
{ "items": [ /* … */ ], "total": 1451, "page": 1, "size": 100, "pages": 15 }
```

### Card object

Verified against a live response:

```jsonc
{
  "id": "69c4407c9288b1e85d94de8a",          // Riftcodex ID — our stable primary key
  "name": "Vi - Piltover Enforcer (Signature)",
  "riftbound_id": "unl-229*-219",            // note: may contain '*' for alternate printings
  "tcgplayer_id": "685522",
  "collector_number": 229,

  "attributes":     { "energy": null, "might": null, "power": null },      // all nullable
  "classification": { "type": "Legend", "supertype": null,
                      "rarity": "Rare", "domain": ["Fury", "Order"] },
  "text":           { "rich": "<p>When you conquer…</p>",                  // HTML
                      "plain": "When you conquer…",
                      "flavour": null },
  "set":            { "set_id": "UNL", "label": "Unleashed" },
  "media":          { "image_url": "https://cmsassets.rgpub.io/…-744x1039.png?accountingTag=RB",
                      "artist": "Jonathan Santoro",
                      "accessibility_text": "Riftbound Legend: Piltover Enforcer. …" },
  "tags":           ["Vi"],                  // champion names, regions, unit types — mixed semantics
  "orientation":    "portrait",              // "portrait" | "landscape" (battlefields)
  "metadata":       { "clean_name": "Vi Piltover Enforcer Signature",
                      "updated_on": "2026-07-10T22:45:08.861364+00:00",
                      "alternate_art": false, "overnumbered": false, "signature": true },
  "new": false
}
```

**Notes for the mirror schema**

- `attributes.*` are nullable — Legends and Battlefields have no energy/might/power.
- `classification.supertype` is nullable; `Signature` also appears as `metadata.signature`.
- `tags` mixes semantics (champion names, regions like `Shadow Isles`, unit types like `Spirit`).
  Don't over-model it — store as JSON, index for search, filter by string match.
- `metadata.updated_on` is the incremental-sync key.
- `id` is the primary key. `riftbound_id` is a useful human-facing fallback but is **not** unique
  across alternate printings.

### Set object

```jsonc
{ "id": "69bc5bf6e195be3e561d1eb1", "name": "Origins", "set_id": "OGN",
  "card_count": 352, "tcgplayer_id": "24344",
  "cardmarket_id": "6286",                    // ⚠️ string OR array of strings
  "published_on": "2025-10-31T00:00:00" }
```

⚠️ `cardmarket_id` is polymorphic — `"6286"` for Origins but `["6322","6483"]` for the promo sets.
Normalize to an array on write.

---

## 3. Vocabularies

Fetched live 2026-08-05. Hardcode as fallbacks, refresh from `/index/` on sync.

| Index | Values |
| --- | --- |
| **Types** (6) | `Battlefield`, `Gear`, `Legend`, `Rune`, `Spell`, `Unit` |
| **Supertypes** (4) | `Basic`, `Champion`, `Signature`, `Token` |
| **Domains** (7) | `Body`, `Calm`, `Chaos`, `Colorless`, `Fury`, `Mind`, `Order` |
| **Rarities** (6) | `Common`, `Uncommon`, `Rare`, `Epic`, `Promo`, `Showcase` |
| **Keywords** (30) | `Accelerate`, `Action`, `Legion`, `Deflect`, `Assault`, `Hidden`, `Reaction`, `Ganking`, `Mighty`, `Shield`, `Tank`, `Vision`, `Deathknell`, `Temporary`, `Equip`, `Quick-Draw`, `ADD`, `Weaponmaster`, `Repeat`, `Unique`, `Hunt`, `Ambush`, `Backline`, `Buff`, `11`, `Stun`, `Empower`, `TEXT`, `Flow`, `Empowered` |

⚠️ The keyword index contains obvious parser artifacts (`11`, `TEXT`, `ADD`) and near-duplicates
(`Empower` / `Empowered`). **Do not** build a keyword filter UI directly from this list — curate it,
and re-check after each set release.

### Sets (as of 2026-08-05)

| `set_id` | Name | Cards | Published |
| --- | --- | --- | --- |
| `OGN` | Origins | 352 | 2025-10-31 |
| `UNL` | Unleashed | — | — |
| `VEN` | Vendetta | 358 | 2026-07-31 |
| `OPP` | Organized Play Promotional | 133 | 2025-10-31 |
| `PR` | Promotional | 13 | 2025-10-31 |
| `JDG` | Judge Promotional | 3 | 2025-12-01 |

**Total cards: 1,451**

---

## 4. ⚠️ Critical limitation: no server-side filtering

`/cards` filters by **`set_id` and `new` only**. There is no way to ask the API for
"all Fury Units costing 3" — no type, domain, rarity, cost, supertype, or tag filter exists.

**Consequence:** a usable card gallery is impossible against the live API. The app *must* mirror the
full card database locally and filter client-side. This is a hard architectural requirement, not a
performance optimization.

Fortunately the mirror is cheap — see below.

---

## 5. Measurements

Taken 2026-08-05.

| Measurement | Value |
| --- | --- |
| Total cards | 1,451 |
| Bytes per 100-card page | **124,832** (~122 KB) |
| Full database as JSON | **~1.8 MB** across 15 requests at `size=100` |
| Original card image (PNG, 744×1039) | **789,857 bytes** (~790 KB) |
| Same image at `?w=200&fm=webp&q=75` | **9,486 bytes** (~9.3 KB) |
| Compression ratio | **83×** |

### Image CDN

Images are served from `cmsassets.rgpub.io`, a **Sanity image CDN**, which supports on-the-fly
transform parameters. This is the single most important performance lever in the app: a 3-column
grid of 1,451 cards is unusable at 790 KB each and trivial at 9 KB each.

| Parameter | Use |
| --- | --- |
| `w`, `h` | Target dimensions |
| `fm=webp` | Format — much smaller than the source PNG |
| `q=1..100` | Quality (75 is a good default) |
| `fit=` | `clip`, `crop`, `max`, `fill` |

Recommended presets (implement in `src/lib/cdn.ts` — **all image URLs go through this one module**,
so the CDN can be swapped for a proxy later without touching UI code):

| Preset | Params | Use |
| --- | --- | --- |
| `thumb` | `w=240&fm=webp&q=70` | Gallery grid, deck list rows |
| `card` | `w=480&fm=webp&q=80` | Deck builder rail, medium cards |
| `full` | `w=744&fm=webp&q=90` | Card detail view, pinch-zoom |

The source URL already carries `?accountingTag=RB` — append parameters, don't replace the query string.

---

## 6. Sync strategy

No `ETag`, no `Last-Modified`, `cf-cache-status: DYNAMIC`, no documented rate limits. Small hobby
infrastructure. Be a good citizen.

1. **Bundled seed.** `scripts/generate-seed.ts` fetches the full database at build time into
   `assets/seed/cards.json` (gitignored). First launch loads from the bundle — instant, offline,
   zero API calls.
2. **Change detection.** `GET /sets` and compare each `set_id` / `card_count` against `sync_meta`.
   Cheap (one small request) and catches new sets and card additions.
3. **Incremental refresh.** If something changed, page `GET /cards?size=100` **sequentially** with
   backoff, and upsert by `id` where `metadata.updated_on` is newer than the stored value.
4. **TTL guard.** Never auto-sync more than once per 24 h. A manual "Refresh cards" lives in Profile.
5. **Validate at the boundary.** Every response passes through Zod. On schema drift, keep the
   last-known-good mirror and surface a quiet notice — never crash, never wipe the mirror.

### Error handling

| Case | Behaviour |
| --- | --- |
| Network unavailable | Silent no-op. The mirror is already complete; the app is fully usable offline |
| 5xx / timeout | Exponential backoff, abandon after 3 attempts, retry on next launch |
| Zod validation failure | Log, skip the offending record, keep the rest, flag in Profile |
| Set removed upstream | Keep local cards — never delete cards a user's deck may reference |

**Referential safety:** deck cards store both `card_id` and `riftbound_id`. If a card ever vanishes
from the API, the deck still renders with its name and a "card data unavailable" placeholder rather
than breaking.

---

## 7. Deck construction rules

Not part of the API — sourced from the official rules. Implemented in `src/lib/legality.ts`.

A legal Constructed deck is **57 cards + 3 battlefields**:

| Zone | Requirement |
| --- | --- |
| **Legend** | Exactly 1. Defines the deck's two domains |
| **Champion** | Exactly 1 Champion Unit, matching the Legend's name **and** one of its domains |
| **Main deck** | Exactly **40** cards, including the Champion |
| **Rune deck** | Exactly **12** runes |
| **Battlefields** | Exactly **3**. Colorless, so any battlefield is legal |
| **Copy limit** | Max **3** copies of any single card |
| **Signature limit** | Max **3** Signature cards total, all sharing the Legend's Champion tag |
| **Domain identity** | Every main/rune card must fall within the Legend's two domains. A dual-symbol card needs **both** symbols inside the identity |

**Domains** pair as opposites: Fury ↔ Calm, Mind ↔ Body, Chaos ↔ Order.

---

## 8. Alternatives considered

| Source | Verdict |
| --- | --- |
| **Riftcodex** | ✅ Chosen. Free, no auth, complete, well-structured, actively maintained |
| [Scrydex](https://scrydex.com/docs/riftbound/cards) | Commercial, requires an API key. Keep as a fallback if Riftcodex goes dark |
| [riftbound-api.com](https://riftbound-api.com/) | Price/inventory focused — relevant only if collection valuation is ever added |
| Scraping Piltover Archive | Rejected. Fragile, and the site returns 403 to non-browser clients |
