# Riftbound Tracker

A mobile app for tracking and analysing **Riftbound** deck performance across deck revisions.

Existing tools are card databases and deckbuilders. None of them answer the question every serious
player actually has: **"did my change actually make the deck better?"**

Riftbound Tracker treats a deck as a living object with a version history. Every match is bound to
the exact decklist that played it, so you can see your deck's total record *and* the record of each
individual version, alongside the concrete card diff that separates them.

> Play 30 matches on v1 → swap 4 cards → play 40 more on v2.
> The app shows you 70 matches total, both versions side by side, and exactly what changed between them.

---

## Status

🚧 **Pre-alpha — M0 (Foundation).** Documentation and project setup. No app code yet.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for milestones.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | React Native via **Expo SDK 54+**, TypeScript (strict) |
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

> Not yet applicable — the Expo project is scaffolded in M0. These are the intended commands.

```bash
npm install
npm run seed          # generate assets/seed/cards.json from the Riftcodex API
npx expo start        # then scan the QR code with Expo Go
```

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
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones M0–M8 with acceptance criteria |

---

## Disclaimer

Riftbound Tracker is an **unofficial fan project**. It is not affiliated with, endorsed by, or
sponsored by Riot Games.

Card data is provided by [Riftcodex](https://riftcodex.com), itself an unofficial fan project.
Card images, names, and game text are the property of Riot Games and are used under Riot's
["Legal Jibber Jabber"](https://www.riotgames.com/en/legal) policy for non-commercial fan content.

League of Legends and Riftbound are trademarks of Riot Games, Inc.
