# Rifthall

A mobile app for tracking and analysing **Riftbound** deck performance across deck revisions.

Existing tools are card databases and deckbuilders. None of them answer the question every serious
player actually has: **"did my change actually make the deck better?"**

Rifthall treats a deck as a living object with a version history. Every game is bound to
the exact decklist that played it, so you can see your deck's total record *and* the record of each
individual version, alongside the concrete card diff that separates them.

> Play 30 games on v1 → swap 4 cards → play 40 more on v2.
> The app shows you 70 games total, both versions side by side, and exactly what changed between them.

---

## Status

**Feature complete, preparing for release.** Every core milestone is built and the app runs as a
signed release build on hardware, verified against a [30-point device checklist](docs/DEVICE-PASS.md).

| | |
| --- | --- |
| Card gallery | All 1,451 cards — browse, search and filter, fully offline |
| Deck building | Legend → Champion → 40/12/3, with live legality that names the exact problem |
| Version history | A version locks on its first game; editing forks, and the diff is shown |
| Game tracking | Two-tap logging, opponent, play/draw, per-game detail, events |
| Analytics | Per-deck and per-version win rate, every figure with its sample size and a Wilson interval |
| Collection, import/export, hand practice | Deck codes, owned-card tracking, opening-hand draws |
| Languages | English, German, French — card text always stays in official English |
| Verification | 766 unit tests · security hardening pass · 30/30 on device |

**What is left before release:** store listing and screenshots, the build pipeline, and migrating
the card catalogue onto Riot's official Riftbound Content API — see below.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full history and what remains.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | React Native via **Expo SDK 57**, TypeScript (strict) |
| Navigation | **expo-router** (file-based, typed routes) |
| Local database | **expo-sqlite** + **Drizzle ORM** (+ FTS5 for card search) |
| Server state | **TanStack Query v5** |
| UI state | **Zustand** |
| Styling | **Nativewind v4** over a design-token layer |
| Lists / images | **FlashList v2**, **expo-image** |
| Motion | **Reanimated 3**, **gesture-handler**, **expo-haptics** |
| Charts | **victory-native XL** (Skia) |
| Backend | **Supabase** (Postgres + Auth + RLS) — optional, for cloud sync |
| Card data | [Riftcodex API](https://riftcodex.com) — free, no auth |
| Testing | **Vitest** (logic), **Maestro** (E2E) |

The app is **local-first**: everything works fully offline with no account. Signing in is optional
and only adds backup and multi-device sync.

---

## Quick start

```bash
npm install
npm run seed          # fetch the card database into assets/seed/cards.json (~1.6 MB, gitignored)
npx expo start        # then scan the QR code with Expo Go
```

`npm run seed` is optional — without it the app downloads the card database on first launch
instead. With it, the first launch is instant and works with no connection at all.

### Testing on a phone

Expo Go supports SDK 57, so no native build is needed:

1. Install **Expo Go** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) ·
   [iOS](https://apps.apple.com/app/expo-go/id982107779))
2. `npx expo start` with the phone on the same Wi-Fi
3. Scan the QR code — Android from inside Expo Go, iOS with the Camera app

If the phone and PC are on different networks (or a corporate/guest Wi-Fi blocks peer traffic), use
`npx expo start --tunnel`.

### Keeping the toolchain aligned

Run `npx expo-doctor` after any dependency change. `babel-preset-expo` in particular must match the
installed SDK — a mismatched one targets a different Hermes and stops transpiling ES6 classes, and
`expo export` then fails with "invalid statement encountered" at the bytecode step.
`npx expo install --fix` realigns everything.

| Script | Purpose |
| --- | --- |
| `npm run seed` | Fetch the full card database into a bundled snapshot |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Vision, scope, core concepts, architecture, decisions |
| [`docs/API.md`](docs/API.md) | Riftcodex API reference — verified endpoints, schemas, measurements |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Database schema, version locking, analytics engine |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system, navigation, key user flows |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones M0–M9 with acceptance criteria |

---

## Disclaimer

Rifthall is an **unofficial fan project**. It is not affiliated with, endorsed by, or
sponsored by Riot Games.

Card **images** are Riot's own files, served unmodified from Riot's content delivery network.
Card **data** currently comes from [Riftcodex](https://riftcodex.com), itself an unofficial fan
project, and **is being migrated to Riot's official Riftbound Content API**. Card text is displayed
verbatim in official English and is never translated.

Rifthall was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot
Games. Riot Games does not endorse or sponsor this project.

League of Legends and Riftbound are trademarks of Riot Games, Inc.
