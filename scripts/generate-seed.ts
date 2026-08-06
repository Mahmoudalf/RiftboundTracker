/**
 * Generate the bundled card snapshot.
 *
 *   npm run seed
 *
 * Writes `assets/seed/cards.json`, which the app loads on first launch so the
 * gallery is complete and offline before any network request is made
 * (docs/API.md §6). The file is gitignored — it is build output, regenerated
 * whenever a new set ships.
 *
 * Runs against plain Node: no Expo, no React Native.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toCardRow } from '../src/api/riftcodex/mapper';
import { cardSchema, paginated } from '../src/api/riftcodex/schemas';

const BASE_URL = 'https://api.riftcodex.com';
const PAGE_SIZE = 100;

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(here, '../assets/seed/cards.json');

const cardPage = paginated(cardSchema);

async function fetchPage(page: number) {
  const url = `${BASE_URL}/cards?page=${page}&size=${PAGE_SIZE}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return cardPage.parse(await res.json());
}

async function main() {
  console.log('Fetching card database from Riftcodex...');

  const first = await fetchPage(1);
  const rows = first.items.map(toCardRow);
  let skipped = 0;

  // Sequential paging — this is a small fan-run API, not a CDN.
  for (let page = 2; page <= first.pages; page++) {
    process.stdout.write(`\r  page ${page}/${first.pages}`);
    const res = await fetchPage(page);
    for (const card of res.items) {
      try {
        rows.push(toCardRow(card));
      } catch (err) {
        // One malformed card must not fail the whole snapshot.
        skipped++;
        console.warn(`\n  skipped ${card.id}: ${String(err)}`);
      }
    }
  }
  process.stdout.write('\n');

  if (rows.length !== first.total) {
    console.warn(`  warning: wrote ${rows.length} rows but the API reported ${first.total} total`);
  }

  const payload = {
    version: new Date().toISOString(),
    apiTotal: first.total,
    count: rows.length,
    cards: rows,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(payload));

  const bytes = Buffer.byteLength(JSON.stringify(payload));
  console.log(
    `Wrote ${rows.length} cards (${(bytes / 1024 / 1024).toFixed(2)} MB) to assets/seed/cards.json` +
      (skipped ? ` — ${skipped} skipped` : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
