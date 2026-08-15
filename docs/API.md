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

### Sets (as of 2026-08-06)

| `set_id` | Cards |
| --- | --- |
| `VEN` Vendetta | 358 |
| `OGN` Origins | 352 |
| `SFD` | 288 |
| `UNL` Unleashed | 280 |
| `OPP` Organized Play Promotional | 133 |
| `OGS` | 24 |
| `PR` Promotional | 13 |
| `JDG` Judge Promotional | 3 |

**8 sets, 1,451 cards total.**

> Don't hardcode this list — it changes. An earlier revision of this document
> recorded 6 sets because the query used `size=5` and read the truncated
> `total`. Always page `/sets` properly.

**`sum(card_count)` equals the `/cards` total exactly (1,451 both ways).** That
equality is what the sync's change-detection leans on: if the local mirror holds
at least `sum(card_count)` rows, nothing upstream has been added and the card
pages are skipped. Verified 2026-08-06 — recheck it if sync starts re-downloading
on every launch, because alternate printings could break the identity.

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

Not part of the API. Sourced from the **official Riftbound Core Rules**, rule 101–103 "Deck
Construction" ([PDF](https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/e9ac8e3d33e0f78cef296f5945aba7bc1313b086.pdf),
last updated 2026-07-16, linked from the [Rules Hub](https://playriftbound.com/en-us/rules-hub/)).
Implemented in `src/lib/legality.ts`, which cites the rule number for each check.

| Zone | Requirement | Rule |
| --- | --- | --- |
| **Legend** | Exactly 1 Champion Legend. Dictates the deck's Domain Identity | 103.1 |
| **Champion** | Exactly 1 Champion Unit whose champion **tag** matches a tag on the Legend. Subject to Domain Identity. Signature units are not Champion units and cannot fill this slot | 103.2.a |
| **Main deck** | **At least 40** cards, the Chosen Champion included | 103.2 |
| **Rune deck** | Exactly **12** runes, all within the Domain Identity | 103.3 |
| **Battlefields** | Number set by the Mode of Play (3 for Constructed). All must have **different names** | 103.4 |
| **Copy limit** | Max **3** copies of the same named card across the **Main Deck and sideboard together**, the Chosen Champion's copy included | 103.2.b (sideboard: owner-confirmed) |
| **Sideboard** | Optional. Empty is not "incomplete", and it counts toward no zone total | — |
| **Signature limit** | Max **3** Signature cards total, all carrying the Legend's champion tag | 103.2.d |
| **Domain identity** | A single-domain card is legal in an identity containing that domain; a multi-domain card only in an identity containing **all** of its domains | 103.1.b |

**Domains** pair as opposites: Fury ↔ Calm, Mind ↔ Body, Chaos ↔ Order.

### Rules that are easy to get wrong

The first three were verified against the Core Rules during the M2 audit, after an initial pass had
inferred them from secondary sources and the card data. Each inference was wrong in a way that
changes verdicts.

**1. The Main Deck is a minimum, not a fixed size.** 103.2 says "A Main Deck of *at least* 40 cards".
A 42-card deck is legal. Treating 40 as exact reports it as two cards over.

> **It has to be *written* as a minimum too.** Re-verified against the Core Rules on 2026-08-14 after
> a 41-card deck was reported as a bug. The rule was right; the readout was not. Every screen printed
> `Main 41/40` — the same `x/y` form the exact zones use (`Runes 12/12`, `BF 3/3`) — so the notation
> itself said "one over", sitting directly beside a verdict reading *"Legal — every zone is within
> its limits."* `LegalityBar` went further and coloured the 41 in `danger` red while its own status
> line said "Legal deck". Fixed by exporting `MAIN_DECK_TARGET` (`"40+"`) as the one display form,
> and by teaching `LegalityBar`'s `Count` which thresholds are minima — a minimum can be met but
> never exceeded, so it has no "over" state to warn about.

**2. The copy limit is scoped to the Main Deck — and the sideboard shares its pool.** 103.2.b: "Your
**Main Deck** can include up to 3 copies of the same named card." The Rune Deck (103.3) states no
copy limit at all, and Battlefields have their own rule instead. This matters because there are only
**6 distinct rune cards**, one per domain — a 2-domain identity gives 2 legal runes, and the rune
deck needs 12, so any deck runs 6 copies of each. Scoping by zone gets that right. Exempting
`supertype = 'Basic'` gets the same answer for runes by accident and then lets three copies of one
Battlefield through.

The **sideboard counts against the same three**: 3 + 0, 2 + 1 and 1 + 2 are all legal ways to hold
three copies, and 3 + 1 is four. The sideboard is an extension of the deck rather than a second one —
running 2 in the Main Deck and 1 on the side is how a player swaps the third copy in between games of
a Bo3 or Bo5, taking something else out to stay at 40. Two independent limits would make that
impossible.

> **Provenance.** This one is *not* a rule citation. 103.2.b names only the Main Deck, and the Core
> Rules text checked here says nothing about sideboards at all. It was implemented first as an
> inference (chosen because erring strict flags a deck rather than passing an illegal one) and then
> confirmed by the project owner. Recorded this way so a later reader does not mistake it for 103.2.b.
> `RULES_VERSION` 2 covers it.

**3. Battlefields must all be different.** 103.4.c: "Cannot include more than one of a **Battlefield**
of the same name when there are more than one required for the deck." They are outside the Main
Deck's 3-copy limit and carry this instead. 64 distinct Battlefields exist, so it constrains nothing
in practice — but three copies of Star Spring is not a legal deck, and the count check alone reads
3/3 and passes it.

**4. The Chosen Champion counts toward its own copy limit.** 103.2.b.1, with the rulebook's own
example: a deck may run Volibear, Furious as its Chosen Champion *and* 2 more copies in the Main
Deck. So the champion zone is inside the copy-limit scope, not beside it.

### Traps in the card data

Measured against the full 1,451-card mirror.

**`supertype === 'Signature'` and the `signature` column are disjoint sets.** They describe different
things and share not one card:

| | Count | Contents |
| --- | --- | --- |
| `supertype = 'Signature'` | 61 | 52 Spells, 5 Gear, 4 Units. All dual-domain, all champion-tagged. **These are what rule 103.2.d means** |
| `signature = true` | 36 | Legends and alternate printings. An *art treatment* — the `(Signature)` name suffix |

Reading the column — which the schema's naming invites — enforces the limit against cards that can
never be in a Main Deck, and never against the cards the rule exists for. 103.2.d.3 confirms the
reading: "Signature cards are not Champion units and cannot be placed in the Champion Zone."

**The copy limit counts cards, not printings.** 1,451 printings collapse to **954 cards**. Three
copies of an alternate art plus three of the original is six copies of one card. Keyed on the name
with its trailing printing treatment stripped (`Signature`, `Alternate Art`, `Overnumbered`,
`Metal`, `Ultimate`, `Launch Exclusive`, `GG EZ`, `Starter` — all eight observed treatments are
trailing parentheticals, and nothing else uses one). 103.2.b.2 confirms names are the unit: "Cards
have different names even if they represent the same character" — 3 Yasuo, Remorseful and 3 Yasuo,
Windrider are both legal together.

**Champion matching is on tags, not names.** 103.2.a.2 requires "a champion tag that matches the tag
on your Champion Legend", and the data agrees: names use both `" - "` and `", "` as separators, and
23 Legends carry only a title — "Master of Shadows" is Zed's. Tag intersection was verified against
all 180 Legends: every one has at least one Champion Unit sharing a tag *and* sitting inside its
identity, and none matches through a region tag by accident. It also handles the tribal case for
free — Kennen's Legend is tagged `["Yordle", "Kennen"]`, so it legally partners any Yordle Champion.

### Cached verdicts

`deck_versions` stores `is_legal` and the three zone counts, which are a cache of `checkLegality()`.
A change to these rules invalidates every stored row, so each carries the `RULES_VERSION` that wrote
it and stale rows are recomputed on the next read. See `refreshStaleVersions()` in
`src/db/queries/decks.ts`.

---

## 8. Alternatives considered

| Source | Verdict |
| --- | --- |
| **Riftcodex** | ✅ Chosen. Free, no auth, complete, well-structured, actively maintained |
| [Scrydex](https://scrydex.com/docs/riftbound/cards) | Commercial, requires an API key. Keep as a fallback if Riftcodex goes dark |
| [riftbound-api.com](https://riftbound-api.com/) | Price/inventory focused — relevant only if collection valuation is ever added |
| Scraping Piltover Archive | Rejected. Fragile, and the site returns 403 to non-browser clients |
