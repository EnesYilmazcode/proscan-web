// Drives the extension's real run engine and sync module from its checkout:
// scraped pages go into the engine (IndexedDB via fake-indexeddb), and
// sync.js drains the outbox into Firestore under this repo's rules. Used by
// the sync rules test and the e2e seed, so neither writes hand-made data.
//
// sync.js takes its Firestore functions as a dependency, so it is handed
// this repo's firebase copy and writes through the caller's `db`.

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  doc,
  getDoc,
  writeBatch,
  Timestamp,
  arrayUnion,
  deleteField,
  FieldPath,
} from 'firebase/firestore';

const FIRESTORE = { doc, getDoc, writeBatch, Timestamp, arrayUnion, deleteField, FieldPath };
const quiet = { log() {}, warn() {}, error() {} };

/** Loads the engine, db, sync and schema modules from an extension checkout. */
export async function loadExtension(extDir) {
  const require = createRequire(resolve(extDir, 'package.json'));
  await import(pathToFileURL(require.resolve('fake-indexeddb/auto')).href);
  const DB = require(resolve(extDir, 'scripts/background/db.js'));
  const { createEngine } = require(resolve(extDir, 'scripts/background/engine.js'));
  const { createSync } = await import(pathToFileURL(resolve(extDir, 'scripts/background/sync.js')).href);
  return { DB, createEngine, createSync };
}

function memoryArea(init = {}) {
  let data = JSON.parse(JSON.stringify(init));
  return {
    async get(keys) {
      const list = keys == null ? Object.keys(data) : [].concat(keys);
      return Object.fromEntries(list.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
    },
    async set(items) {
      Object.assign(data, JSON.parse(JSON.stringify(items)));
    },
    async remove(keys) {
      [].concat(keys).forEach((k) => delete data[k]);
    },
  };
}

let installs = 0;

/**
 * One extension install signed in as `uid`, with a tab that answers every
 * message. Returns scrape() to run a whole search and flush() to sync it.
 */
export function installExtension(ext, { uid, db, log = quiet }) {
  const name = `proscan-web-${process.pid}-${++installs}`;
  const clock = { t: 0 };
  let url = '';
  const chrome = {
    storage: {
      session: memoryArea(),
      local: memoryArea({ account: { uid }, settings: { maxPages: 400 } }),
    },
    runtime: { lastError: null },
    tabs: {
      sendMessage(tabId, message, opts, cb) {
        setImmediate(() => cb(message.type === 'PING' ? { ok: true, kind: 'results', url } : { ok: true }));
      },
      async update() {
        return {};
      },
      async get(id) {
        return { id, url };
      },
    },
  };
  const engine = ext.createEngine({
    chrome,
    openDb: () => ext.DB.open({ name }),
    now: () => clock.t,
    random: () => 0,
    setTimer: () => 0,
    clearTimer: () => {},
    flags: { CLOUD_SYNC: true },
    log,
  });
  const sender = { tab: { id: 1 } };

  async function reportPage(runId, pageNo, cards, { last, total }) {
    if (pageNo > 1) {
      clock.t += 5000;
      await engine.tick();
    }
    const at = new Date(clock.t).toISOString();
    const result = {
      kind: last ? 'last' : 'results',
      // Rank within the page; the engine makes it run-wide.
      products: cards.map((p, j) => ({
        ...p,
        placements: p.placements ?? [{ position: j + 1, sponsored: false, rank: j + 1 }],
        scrapedAt: at,
      })),
      placements: cards.length,
      nextHref: last ? null : `${url}&page=${pageNo + 1}`,
      total,
      fill: { asin: 1, title: 1, price: 1 },
    };
    const pageUrl = pageNo === 1 ? url : `${url}&page=${pageNo}`;
    const resp = await engine.pageResult({ runId, page: pageNo, url: pageUrl, result }, sender);
    if (!resp.ok) throw new Error(`page ${pageNo} refused: ${JSON.stringify(resp)}`);
  }

  /** Scrapes `cards` from the search at `searchUrl`, `perPage` to a page, starting at `startMs`. */
  async function scrape(searchUrl, startMs, cards, perPage = 48) {
    clock.t = startMs;
    url = searchUrl;
    const resp = await engine.start({ tabId: 1 });
    if (!resp.ok) throw new Error(`run refused: ${JSON.stringify(resp)}`);
    const pages = Math.ceil(cards.length / perPage);
    for (let i = 0; i < pages; i++) {
      await reportPage(resp.runId, i + 1, cards.slice(i * perPage, (i + 1) * perPage), {
        last: i === pages - 1,
        total: cards.length,
      });
    }
    return resp.runId;
  }

  const sync = ext.createSync({ db, openStore: () => engine.db(), fs: FIRESTORE, log });
  return { scrape, flush: () => sync.flush(uid), pending: () => sync.pending(uid) };
}

export const asinOf = (i) => `B0${i.toString(36).toUpperCase().padStart(8, '0')}`;

/**
 * Search result cards as the content script reports them. `price(i)` gives
 * cents or null for a price that failed to parse.
 */
export function cards(n, { price = (i) => 1000 + i, reviews = (i) => 100 + i, offset = 0 } = {}) {
  return Array.from({ length: n }, (_, k) => {
    const i = k + offset;
    const cents = price(i);
    const asin = asinOf(i);
    return {
      asin,
      name: `Test product ${i}`,
      price: cents === null ? null : `$${(cents / 100).toFixed(2)}`,
      priceCents: cents,
      currency: cents === null ? null : 'USD',
      rating: 3 + (i % 20) / 10,
      reviewCount: reviews(i),
      isPrime: i % 2 === 0,
      sponsored: false,
      url: `https://www.amazon.com/dp/${asin}`,
      img: `https://m.media-amazon.com/images/I/test-${i}.jpg`,
    };
  });
}
