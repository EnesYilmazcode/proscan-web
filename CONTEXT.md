# CONTEXT.md — ProScan Current State

Precise current-state reference for the ProScan system as of 2026-06-09. Two repositories, both local under `C:\Users\galax\downloads\projects\`. No invented facts; everything below reflects the code as it exists today.

---

## 1. Repositories & Locations

| Repo | Path | What it is |
|---|---|---|
| Chrome extension | `C:\Users\galax\downloads\projects\AmazonSellerScraper` | MV3 Amazon competitor-research scraper + Gemini chatbot. Published to Chrome Web Store as extension ID `bikgignfnljpbmchlemkbbpboigodgap`. |
| Marketing website | `C:\Users\galax\downloads\projects\proscan-web` | Static Firebase-hosted landing page. Firebase project ID `proscanbot`. |

There is **no shared codebase, no shared auth, and no live backend** linking the two today. The website only links out to the Chrome Web Store listing.

---

## 2. Extension — Current State (`AmazonSellerScraper`)

### Tech & structure
- Manifest V3, event-driven background **service worker** (`scripts/background/service-worker.js`).
- Content scripts injected into Amazon pages: `scraper.js`, `chatbot.js`, `offer-fetcher.js`.
- Popup UI: `popup.html` / `popup.js` / `popup.css`.
- Modules under `scripts/modules/` (`storage.js`, `analyzer.js`, `spread-analyzer.js`, etc.).
- Has a Jest test config and a `server/` folder containing an experimental local sync backend.
- Extension version 2.0. AI features call **Gemini 2.0 Flash**.

### Manifest permissions (today)
| Field | Value |
|---|---|
| `permissions` | `["storage", "downloads"]` |
| `host_permissions` | `["*://*.amazon.com/*", "https://generativelanguage.googleapis.com/*"]` |
| `content_scripts` | matches `*://*.amazon.com/*`; injects `scraper.js`, `chatbot.js`, `offer-fetcher.js` |
| `background.service_worker` | `scripts/background/service-worker.js` |
| `web_accessible_resources` | `styles/chatbot.css`, `libs/*.js`, `assets/icons/*.png` to `*://*.amazon.com/*` |
| `externally_connectable` | **NOT DEFINED** — a website cannot message the extension today |

### `chrome.storage.local` schema (exact, from `scripts/modules/storage.js`)
| Key | Type | Shape |
|---|---|---|
| `results` | Array | `Product[]` (see below) |
| `currentItemCount` | Number | integer count |
| `isScrapingActive` | Boolean | scraping state flag |
| `settings` | Object | `{ pageDelay: number, maxPages: number }` (e.g. `{pageDelay:2000, maxPages:100}`) |
| `spreadResults` | Object | `{ [asin]: SpreadData | null }` |
| `isSpreadAnalyzing` | Boolean | analysis state flag |
| `geminiApiKey` | String | user's Gemini API key (plaintext in local storage) |

### Data model

**Product** (raw scrape, from `scraper.js`):
```js
{
  name: string,        // product title
  asin: string,        // Amazon Standard ID, never empty
  price: string,       // display string, e.g. "$19.99" or "N/A"
  rating: number,      // 0–5, 0 if unavailable
  reviewCount: number, // parsed integer, 0 if unavailable
  isPrime: boolean,    // Prime badge present
  url: string,         // full canonical Amazon product URL
  scrapedAt: string    // ISO 8601 UTC timestamp
}
```

**SpreadData** (per-ASIN price spread, from `offer-fetcher.js`), keyed by ASIN in `spreadResults`:
```js
{
  asin: string,
  productName: string,    // copied from product.name
  listPrice: string,      // copied from product.price
  sellerPrices: number[], // competing seller prices, deduplicated floats
  fetchedAt: string       // ISO 8601 timestamp
}
```

**Derived metrics** (computed client-side, not stored as schema):
- Opportunity Score per product: `(rating * log10(reviews+1)) / sqrt(price)` ×2, normalized 1–10 (`analyzer.js`).
- Spread metrics per ASIN: `sellerCount, minPrice, maxPrice, meanPrice, medianPrice, stdDev, coefficientOfVariation, absoluteSpread, interquartileRange` (`spread-analyzer.js`).
- Arbitrage Score per ASIN: `(CV/15) * log10(sellers+1) * min(1, spread/20)` ×2.5, normalized 1–10.
- Full analytics report: `{ summary, distributions, topOpportunities, insights, generatedAt }`.

### Runtime messaging (today, all internal — no external channel)
Popup → content scripts: `START_SCRAPING`, `STOP_SCRAPING`, `START_SPREAD_ANALYSIS`, `STOP_SPREAD_ANALYSIS`.
Content → popup (via service worker): `UPDATE_PROGRESS`, `SCRAPING_COMPLETE`, `PAGE_COMPLETE`, `SPREAD_PROGRESS`, `SPREAD_ANALYSIS_COMPLETE`, `CHAT_MESSAGE`.
Service worker → Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API_KEY`.

### Experimental server sync (present in `server/`, fire-and-forget)
- `service-worker.js.syncToServer()` does `POST http://localhost:8000/api/products/sync`.
- Request body: `{ products: Product[], seller_name: null, seller_url: null }`.
- Response (from `products.py`): `{ synced: number, scrape_run_id: number }`.
- **No authentication header. No user ID. `seller_name`/`seller_url` always null.** Errors are swallowed.

---

## 3. Website — Current State (`proscan-web`)

### Tech & structure
- Pure static **HTML / CSS / vanilla JS**. No build step, no bundler, no framework, **no `package.json`**.
- **Source lives directly in `dist/`**, which is also the Firebase Hosting public directory (source == deploy target — a known footgun).
- Files: `dist/index.html` (single-page landing), `dist/style.css` (~390 lines, monolithic), `dist/404.html` (unbranded Firebase boilerplate), `dist/icon128.png`, Google Search Console verification file, `.firebaserc`, `firebase.json`.
- Deployed via Firebase Hosting, project ID `proscanbot`, `public: "dist"`, default rewrites (no SPA fallback).
- JS is ~100 lines inline in `<script>` tags: IntersectionObserver, scroll tracking, a `performScan()` mockup animation loop on a 3000ms interval.

### Design system (in active use)
- Colors: dark `#2a343e`, light bg `#fcfcfc`, gray `#5a646e`, feature bg `#f4f7f6`, accent `#667eea`, price green `#059669`, Amazon yellow `#f0c14b`.
- Fonts: system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`), no web fonts.
- Layout: container `90%`/`max-width:1100px`; two-column flex hero; `auto-fit minmax(280px,1fr)` features grid; sticky nav.

### Content
- Nav (logo + "Features" anchor + "Get Proscan" CTA), hero ("Outsmart Your Competition." + animated browser mockup cycling 7 sample products), 3 feature cards (price monitoring, data extraction, trend analysis), CTA section, footer ("© 2024 Proscan").
- Chrome Web Store URL hardcoded in **3 places**: `https://chromewebstore.google.com/detail/proscan-amazon-product-sc/bikgignfnljpbmchlemkbbpboigodgap`.

### Constraints for adding auth + dashboard
- No routing infrastructure (anchor links only); `/login`, `/dashboard` would need a SPA + Firebase rewrites.
- No env/config system; Store URL and project ID hardcoded.
- Monolithic global CSS and inline JS — no module system, no component isolation, no tests.

---

## 4. Integration Surface — Have vs. Need

| Concern | Today | Needed for the revamp |
|---|---|---|
| Website → extension messaging | None (`externally_connectable` absent) | Add `externally_connectable` + `onMessageExternal`/`onConnectExternal` listener |
| User identity | None anywhere; all extension data is local-only, single global store | Auth provider + per-user `user_id` on all saved data |
| Auth token in extension | None | Short-lived token in `chrome.storage.session` (not refresh tokens on disk) |
| Data ownership | Product objects have no owner / client / workspace fields | Add `userId`, client/competitor grouping, timestamps, scrape-run/batch id |
| Server sync auth | Unauthenticated `POST` to `localhost:8000`, fire-and-forget | Authenticated `Authorization: Bearer <jwt>` to a real per-user backend |
| Backend | Experimental local-only `server/`, no auth/users/rate-limit | Real backend or BaaS deriving `user_id` from token, with security rules / authz |
| Persistence/sync model | In-memory + `chrome.storage.local` only, no cross-device | Cloud store; MV3 worker treated as stateless, alarm-driven queue flusher |
| Website architecture | Static, no build, source in `dist/` | `src/`→`dist/` split, build tool, SPA route at `/dashboard`, landing page kept static |

### Known MV3 sync constraints (apply to any forward design)
- Service worker idles out after ~30s; 5-minute hard cap per event; no in-memory state survives restart.
- Use `chrome.alarms` (not `setInterval`) for periodic sync; register all listeners synchronously at top level; rehydrate token + queue from storage on each wakeup.
- `chrome.storage.local` capped ~10 MB; no built-in encryption; survives uninstall until cleared.
