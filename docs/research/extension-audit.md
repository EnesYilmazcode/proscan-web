# ProScan Chrome Extension Audit

_Last updated: 2026-06-09 — produced by the planning fleet._

Audit of `C:\Users\galax\Downloads\Projects\AmazonSellerScraper` (published MV3 extension, Chrome Web Store id `bikgignfnljpbmchlemkbbpboigodgap`, manifest version string "2.0"). Purpose: establish exactly what the extension does and captures today, what it could capture for near-zero extra cost, what code is reusable for the web platform, and which debts affect the REVAMP_PLAN architecture.

All file paths below are relative to the extension root unless absolute.

---

## 1. Current capabilities and end-to-end user flow

### Capabilities summary

| Capability | Where | Status |
|---|---|---|
| Multi-page scrape of search/storefront result pages | `scripts/content/scraper.js` | Working, shipped |
| Per-ASIN competing-offer price fetch ("price spread") | `scripts/content/offer-fetcher.js` | Working, shipped |
| Spread statistics (min/max/mean/median/stdDev/CV/IQR) + arbitrage score | `scripts/modules/spread-analyzer.js` | Working; **results shown in popup only, never exported** (see §5) |
| Opportunity scoring, distributions, insights | `scripts/modules/analyzer.js` | Working |
| Excel (3-sheet) / CSV / JSON export | `scripts/modules/exporter.js` + SheetJS (`libs/xlsx.full.min.js`) | Working |
| Floating Gemini chatbot on Amazon listing pages | `scripts/content/chatbot.js` + `scripts/background/service-worker.js` | Working; uses a **hardcoded fallback API key** (see §5) |
| Optional localhost FastAPI/SQLite/ChromaDB/MCP backend | `server/` (Python) | Dead experiment; service worker still POSTs to it after every scrape |

The extension runs all three content scripts on every `*.amazon.com` page (`manifest.json` lines 27-37) at `document_idle`. Only `storage` and `downloads` permissions are requested; host permissions are `*://*.amazon.com/*` and `https://generativelanguage.googleapis.com/*`. No auth, no cloud — everything in one global `chrome.storage.local` store (keys defined in `scripts/modules/storage.js` `Storage.KEYS`: `results`, `currentItemCount`, `isScrapingActive`, `settings`, `spreadResults`, `isSpreadAnalyzing`).

### Click-by-click flow (what a seller actually does)

1. Navigate to an Amazon search results page (`/s?k=...`) or a competitor storefront (`/s?me=SELLERID`). Product detail pages yield nothing — the scraper only finds `.s-result-item[data-asin]` containers.
2. Click the ProScan toolbar icon. Popup (`popup/popup.html`) shows Items / Avg Rating / Avg Price restored from the previous session's storage.
3. Click **Start Scraping**. `popup/popup.js startScraping()` resets `results`/`currentItemCount`, sets `isScrapingActive=true`, sends `START_SCRAPING` to the active tab.
4. `scraper.js` extracts every listing on the page (8 fields per product, §2), appends to `results` in storage, sends `UPDATE_PROGRESS` to the popup (live count/avg updates).
5. If the "Next" pagination button is not disabled (`.s-pagination-next.s-pagination-disabled` absent), the tab navigates to `?page=N+1&ref=sr_pg_N+1` after a hardcoded 2 s delay. On the new page load, the content script reads `isScrapingActive` from storage and resumes automatically. Repeats until last page or user clicks **Stop Scraping**.
6. On completion, `SCRAPING_COMPLETE` fires; the service worker fire-and-forgets a POST of all results to `http://127.0.0.1:8000/api/products/sync` (silently fails for every real user — §5).
7. Popup now shows export buttons and **Analyze Price Spreads**.
8. (Optional) Click **Analyze Price Spreads**. `offer-fetcher.js` iterates all scraped ASINs sequentially with a 2 s delay, fetching the AOD AJAX endpoint (`/gp/aod/ajax?asin=...`) and falling back to the classic offer-listing page (`/gp/offer-listing/{ASIN}?...&condition=new`), parsing seller prices with `DOMParser`. Progress bar in popup; result card shows "High Spread" count and average CV.
9. Click **Excel / CSV / JSON**. File is generated in the popup and saved via `chrome.downloads` with a save-as dialog. Filename pattern: `amazon_store_scraped_data_YYYY-MM-DD.xlsx` (the seller-name part never populates — §5).
10. (Anytime on a listing page) Click the floating bottom-right chatbot button; ask e.g. "What's the best deal under $30?". `chatbot.js` sends the question plus ALL stored products to the service worker, which calls `gemini-2.0-flash` and renders the answer in a Shadow-DOM-isolated bubble.

A 214-test Jest suite (plus 35 pytest tests for the dead server) encodes the scraper selector contracts against HTML fixtures in `tests/fixtures/` — a real asset for schema stability.

---

## 2. Every data field captured today (with code evidence)

### Per product (written to `chrome.storage.local.results[]` by `scraper.js scrapeProduct()`, lines 254-280)

| Field | Type | Source / selector evidence (in `scripts/content/scraper.js`) |
|---|---|---|
| `asin` | string | `listing.dataset.asin` from container `.s-result-item[data-asin]:not([data-asin=""])` (SELECTORS.productItem, line 34; empty-ASIN ad placeholders filtered) |
| `name` | string | `h2 span`, fallback `.a-size-base-plus.a-color-base.a-text-normal` (lines 37-38) |
| `price` | **display string** ("$19.99" / "N/A") | `.a-price[data-a-size="xl"] .a-offscreen`, fallback `.a-price .a-offscreen` (lines 41-42). Never parsed to a number at capture time — every consumer re-parses |
| `rating` | number 0-5 | 4-level cascade: `[data-cy="reviews-ratings-slot"] .a-icon-alt` → `.a-icon-star-mini .a-icon-alt` → `.a-icon-star-small .a-icon-alt` → `[data-cy="reviews-block"] span.a-size-base.a-color-secondary` (lines 45-48), regex `(\d+\.?\d*)` |
| `reviewCount` | integer | `a[aria-label$="ratings"]` aria-label (exact count) → `.a-size-mini.puis-normal-weight-text.s-underline-text` → `.a-size-base.puis-normal-weight-text.s-underline-text` with K/M-suffix parsing (lines 51-53, `parseReviewText`) |
| `isPrime` | boolean | presence of `.a-icon-prime, .s-prime` (line 56) |
| `url` | string | `href` of `.a-link-normal.s-no-outline`, prefixed `https://www.amazon.com` (lines 55, 264-268) |
| `scrapedAt` | ISO string | `new Date().toISOString()` at extraction (line 278) |

### Per ASIN spread record (written to `spreadResults[asin]` by `offer-fetcher.js runSpreadAnalysis()`, lines 216-222)

| Field | Type | Source |
|---|---|---|
| `asin`, `productName`, `listPrice` | copied from the product record | — |
| `sellerPrices` | number[] | Offer-page price cascade in `OFFER_SELECTORS` (lines 30-42): `.aod-information-block .a-price .a-offscreen` → `#olpOfferList .a-price .a-offscreen` → `.olpOfferPrice` → `.a-price .a-offscreen`; deduplicated via `[...new Set(prices)]` (line 113 — a statistical bug, see §5) |
| `fetchedAt` | ISO string | fetch time |

Spread metrics (`sellerCount`, `minPrice`, `maxPrice`, `meanPrice`, `medianPrice`, `stdDev`, `coefficientOfVariation`, `absoluteSpread`, `interquartileRange`) and the arbitrage score are **derived on demand** by `spread-analyzer.js calculateSpread()/calculateArbitrageScore()`, not persisted.

### Captured-then-dropped / never-captured metadata

- **Total result count**: `getTotalResults()` parses `h2.a-size-base.a-spacing-small.a-spacing-top-small span` ("1-48 of 523 results") but is **never called** (scraper.js line 287; zero call sites).
- **Scrape context**: the search keyword (`k=`), storefront seller id (`me=`), category (`i=`), page count, and run timestamp are never recorded. There is no scrape-run id at all — the platform's "what did I scrape, when, from whom" model has no raw material today.
- **Result position** (organic rank on page) — the scraper iterates listings in DOM order but discards the index.

---

## 3. Visible but NOT captured — the near-free data inventory

Two tiers. Tier A is on pages the extension **already parses** (search/storefront results DOM, and the offer-page HTML it already downloads and throws away except prices). Tier B requires one extra fetch per ASIN using the exact same pattern as `offer-fetcher.js`.

DOM locations below are stated from current-generation Amazon markup conventions (same family as the selectors already in `scraper.js`, which were verified against live pages in Feb 2026 per CLAUDE.md); each needs a quick verify-against-live-DOM pass before implementation, same as any Amazon selector.

### Tier A1 — search/storefront result cards (already in the parsed DOM, zero extra requests)

| Data | Where in the DOM (result card) | Platform feature it unlocks |
|---|---|---|
| **Sponsored flag** | `[data-component-type="sp-sponsored-result"]` on the card, or `.puis-sponsored-label-text` / "Sponsored" label | Separate organic vs paid listings; dedupe sponsored repeats; "is this competitor paying for placement?" signal |
| **Result position + page** | DOM index of the listing (`listings.forEach((l, i) => ...)`) + `data-index` attr + URL `page` param | Month-over-month **search-rank tracking** per ASIN — directly serves the "track changes over time" product goal |
| **Image URL** | `img.s-image` `src`/`srcset` | Product thumbnails throughout the dashboard (tables, cards, exports) — biggest UX upgrade per line of code |
| **List/strike-through price** | `.a-price.a-text-price .a-offscreen` (the `data-a-strike="true"` price next to the main price) | Discount-depth metric; "on sale vs list" flag; better margin estimates |
| **Unit price** | secondary `.a-price` sibling with "(…/Fl Oz)" text near the main price | Per-unit comparisons in commodity categories |
| **Coupon badge** | `.s-coupon-unclipped` / coupon highlight span with "Save $X with coupon" text | Deal-hunting filter ("has coupon"), effective-price calculation |
| **Deal badge** ("Limited time deal", "Deal") | `.a-badge` / `[data-a-badge-color="sx-lightning-deal-red"]` with `.a-badge-text` | Flag time-sensitive flips; deal-frequency tracking per ASIN |
| **"Best Seller" / "Amazon's Choice" / "Overall Pick" badge** | status badge component on the card (`.a-badge-label`, badge text) | Cheap demand proxy without BSR; "badge appeared/disappeared" change tracking |
| **"N+ bought in past month"** | text span in the reviews block area (`[data-cy="reviews-block"]` region), text-match `/([\d,.]+K?\+?) bought in past month/` | The single best **demand/velocity signal** visible on SERPs — turns the Opportunity Score from popularity-based to sales-based |
| **Stock-scarcity line** ("Only 5 left in stock") | `span.a-color-price` text on the card (when present) | Stock-out alerts; scarcity-based flip prioritization |
| **Variation hints** ("+5 colors/patterns") | color-swatch row / `+N colors` link under the title | Marks parent-ASIN products needing variation-level analysis |
| **Delivery promise** ("FREE delivery Tue, Jun 16") | `[data-cy="delivery-recipe"]` spans | FBA-vs-FBM heuristic, fulfillment-speed comparisons |
| **Small Business / Climate Pledge badges** | provenance certifications row on the card | Sourcing filters (small-brand wholesale outreach lists) |
| **Total results + query context** | already-written `getTotalResults()` + `URLSearchParams` of `location.href` (`k`, `me`, `i`, `rh`, `page`) | **Scrape-run metadata**: niche size, storefront identity, repeatable monthly re-scrapes of the same target |

### Tier A2 — offer pages (HTML already downloaded by `offer-fetcher.js`; today only prices are kept)

| Data | Where in the AOD response | Platform feature it unlocks |
|---|---|---|
| **Seller name + seller id** | per offer: "Sold by" block (`#aod-offer-soldBy` link; href contains `seller=A...` id) | **Competitor-storefront discovery** — "which sellers keep appearing on my target ASINs" → exactly the "what to scrape next" goal; click-through to scrape that storefront |
| **Seller rating / feedback count** | `#aod-offer-seller-rating` area ("92% positive over 12 months") | Weight spread analysis by seller credibility; ignore junk sellers |
| **Ships from (FBA vs FBM)** | "Ships from" block (`#aod-offer-shipsFrom`); "Amazon" = FBA | FBA/FBM mix per ASIN — key arbitrage viability input (Buy Box dynamics) |
| **Offer condition** | per-offer condition heading (`#aod-offer-heading`) | Filter used/renewed offers out of spread stats (currently NOT filtered on the AOD path — §5) |
| **Buy Box / pinned offer** | pinned first offer block (`#aod-pinned-offer`) with its own price | Buy Box price vs offer-floor delta — the actual sell-price anchor for repricing decisions |
| **Total offer count** | AOD header count element (e.g. `#aod-filter-offer-count-string`) | True seller count even when only ~10 offers render (current `sellerCount` undercounts) |
| **Shipping cost per offer** | per-offer delivery/shipping line | Landed-price spread instead of item-price spread (spec'd in `docs/PRICE_SPREAD_ANALYSIS.md` edge case 5, never implemented) |

### Tier B — one extra same-origin fetch per ASIN (product detail page), identical technique to offer-fetcher

| Data | Where on the detail page | Platform feature it unlocks |
|---|---|---|
| **BSR (Best Sellers Rank) + category** | "Best Sellers Rank" row in `#productDetails_detailBullets_sections1` or `#detailBulletsWrapper_feature_div` | The canonical demand metric; month-over-month BSR tracking is the backbone of "what to flip". Already on the extension's own roadmap (CLAUDE.md "Future") |
| **Brand / byline** | `#bylineInfo` ("Visit the X Store" / "Brand: X") | Brand-level grouping, wholesale-target lists |
| **Full variation matrix** | `twister` data / variation dimensions on the page | Per-variation price/availability analysis |
| **Buy Box seller** | `#merchant-info` ("Ships from and sold by …") | Who owns the Buy Box right now; rotation tracking |
| **Item weight / dimensions** | product details table | FBA fee estimation → real margin math instead of score heuristics |
| **Date first available** | product details table | Product age → review-velocity normalization |
| **"Frequently returned item" badge** | warning badge above the buy box (when present) | Risk filter before sourcing |

Recommendation embedded in the data: Tier A1 + A2 are the highest-value/lowest-risk wins (no new request volume, no new rate-limit exposure). Tier B doubles request volume per ASIN and should be opt-in per product or batched, reusing offer-fetcher's queue/delay/cancel machinery.

---

## 4. Reusable assets → dashboard feature mapping

| Asset | Purity / portability | Maps to web-platform feature |
|---|---|---|
| `analyzer.js` (Opportunity Score `(rating·log10(reviews+1))/√price` ×2 clamped 1-10; price/rating distributions; underpriced/underexposed insight detectors; `generateFullReport`) | Pure JS, already `module.exports`-guarded and unit-tested — drops into the React SPA or a Cloud Function unchanged | Dashboard scorecards, distribution charts, "Top Opportunities" table, insight feed. Server-side recompute enables score-over-time charts once data is in Firestore |
| `spread-analyzer.js` (CV, stdDev, IQR, arbitrage score `(CV/15)·log10(sellers+1)·min(1, spread/20)` ×2.5 clamped; 5-tier CV classification with colors) | Pure math, zero Chrome deps, unit-tested | Spread badges/columns in product tables; CV-over-time charts (the spec's own "historical spread tracking" future item); classification colors map 1:1 to UI chips |
| `Analyzer.calculateCombinedScore` (60 % base + 40 % arbitrage) | Implemented + tested but **never wired into any production path** (only `tests/` reference it) | Ready-made "ProScan Score" for the dashboard — finish the wiring there instead of in the popup |
| `exporter.js` (3-sheet styled XLSX via SheetJS, CSV with spread columns, JSON+analytics) | Browser-portable; only `triggerDownload` is Chrome-specific (swap for an `<a download>` blob link) | "Export my data" in the dashboard — preserves the seller's Excel workflow during migration. Note the CSV spread columns are dead code today (§5) but the implementation is reusable |
| Chatbot prompt + Gemini call (`service-worker.js handleChatMessage`) | Prompt template and product-context formatting are reusable; the key-handling is not (§5) | Dashboard AI assistant answering over the user's Firestore data; move the Gemini call behind a Cloud Function (or per-user stored key) |
| `offer-fetcher.js` machinery (AOD endpoint, cascading DOMParser extraction, sequential 2 s rate limiting, cancel flag, incremental progress) | Must stay in the extension (needs the user's Amazon session, same-origin fetch) | The template for ALL future enrichment fetchers (Tier A2 seller extraction, Tier B detail-page fetch). The queue/progress pattern also matches REVAMP_PLAN's scrape-buffer design |
| Test suite (`tests/` — 214 Jest tests, HTML fixtures matching exact selectors, chrome API mock, vm-based content-script loader) | Directly reusable | Contract tests for the Product schema the platform will ingest; fixtures double as documentation of Amazon DOM assumptions |
| `storage.js` | Thin promise wrapper | Superseded by the REVAMP_PLAN queue + Firestore writes, but its `KEYS` enum is the de-facto current schema to migrate from |

The `server/` Python stack (FastAPI, SQLite, ChromaDB RAG, 7 MCP tools) is conceptually a prototype of the cloud platform but shares no runtime with the Firebase plan; treat it as reference material only, then delete.

---

## 5. Limitations and tech debt affecting the platform plan

### Security / trust

1. **Hardcoded shared Gemini API key.** `service-worker.js` lines 25-32 ship a base64-encoded fallback key (`const _t = 'QUl6YVN5...'; atob(_t)`) in a published extension. Worse: **there is no settings UI anywhere** — `popup/popup.html` has no API-key input, and nothing in the codebase ever writes the `geminiApiKey` storage key — so despite README/CLAUDE.md claiming "paste your Gemini API key in Settings", every user's chatbot runs on the embedded shared key. Quota exhaustion, billing abuse, and key revocation are all live risks; the key is trivially extractable from the store package. The platform plan must move Gemini calls behind a Cloud Function (or build the per-user key UI it claims to have) and rotate this key.
2. Popup loads Font Awesome CSS from cdnjs (`popup/popup.html` line 4) — a remote resource in an extension page; works under the current CSP but is a store-review and supply-chain liability.
3. Three content scripts inject on **every** `*.amazon.com` page (cart, checkout, account) though they only do useful work on listing pages — unnecessary footprint for a published extension and for future store reviews of `externally_connectable` changes.

### Data-model gaps (directly blocking the cloud platform)

4. **No scrape-run identity.** One global `results` array, overwritten per run. No run id, no source URL/keyword/storefront-id, no page count, no run timestamp (only per-product `scrapedAt`). Month-over-month tracking — the core product goal — requires introducing a `scrapeRun` entity before sync; retrofit now, in the extension, so Firestore documents are born with provenance.
5. **No ASIN dedup and no sponsored/organic distinction.** Sponsored cards carry `data-asin` and repeat across pages, inflating counts, averages, and the spread-analysis workload.
6. **Price stored as display string**, parsed independently (and slightly differently) in `analyzer.js`, `exporter.js`, and `offer-fetcher.js`. Currency/locale is implicitly US (`.amazon.com` only). Normalize to `{amountCents, currency, display}` at capture before anything syncs.
7. **`spreadResults` is never cleared on a new scrape** (`Storage.resetForNewScrape()` resets only results/count/flag), so stale spread data from a previous run is displayed against, and keyed into, the new product set.
8. No `unlimitedStorage` permission — large multi-run histories cannot live in `chrome.storage.local` anyway; consistent with the plan to make Firestore the system of record and the extension a buffer.

### Spread-analysis correctness

9. `extractPricesFromDocument` dedupes prices with `new Set` (offer-fetcher.js line 113), so two sellers at the same price collapse into one — **undercounts sellers and biases CV upward**; `sellerCount` is really "unique price count".
10. The AOD AJAX URL contains **no condition filter** (only the classic fallback URL has `condition=new`), so used/renewed offers can contaminate "new" spread stats — violating the spec's own edge case 4 (`docs/PRICE_SPREAD_ANALYSIS.md`).
11. The final fallback selector `.a-price .a-offscreen` over a whole fetched page can vacuum unrelated prices (strike-through, bundles) into `sellerPrices`.
12. Spec'd retry-on-throttle ("retry once after 5 s") is not implemented; a 503 silently yields `null`. AOD also returns only the first ~10 offers and the fetcher never paginates them.

### Dead / mis-wired code

13. **Spread data never reaches any export.** Popup calls `Exporter.exportToCSV(currentResults)` without the `spreadResults` argument (popup.js line 390), and the Excel path builds its report via `Analyzer.generateFullReport()` which neither accepts nor includes spread data — so the exporter's spread columns and the high-spread insight are unreachable in production. `calculateCombinedScore` is likewise never called outside tests.
14. `Exporter.getFileName` keys off `results[0].sellerName`, which the scraper never sets — filenames are always `amazon_store_...`.
15. `settings` (`pageDelay`, `maxPages`) are initialized on install (service-worker.js lines 134-139) but never read; the 2 s delay is hardcoded in both content scripts and there is no page cap at all (a 400-page storefront scrapes for ~15+ minutes of full page reloads).
16. `getTotalResults()` is dead code (defined, never called).
17. The service worker's `STOP_SCRAPING` forward requires `sender.tab` (line 46), which is never true for popup-originated messages — the branch is dead; stopping actually works only because the content script re-reads the storage flag on the next page navigation (mid-page stop is eventual, not immediate).
18. **Duplicate legacy v1 files at repo root** — `popup.js` (482 lines), `popup.html`, `popup.css`, `background.js`, `contentscript.js`, `icon*.png`, `logo.png` — none referenced by `manifest.json` but easy to edit by mistake and shipped if the folder is zipped naively. Delete.
19. **Dead localhost server experiment** — the entire `server/` tree (FastAPI + SQLite + ChromaDB + MCP, with committed `chroma_data/` binaries, `__pycache__`, `.pytest_cache`, and a root `.env`) plus the `syncToServer()` call that POSTs every completed scrape's full results to `http://127.0.0.1:8000` for 100 % of real users (silent failure). Remove the call before adding Firestore sync; archive or delete `server/`.

### Architecture friction for the REVAMP_PLAN

20. Pagination by full-page navigation means the scrape state machine survives via storage flags and content-script re-injection — any future per-run queue/buffer must be written incrementally per page (it effectively already is) and tolerate the tab dying mid-run; `isScrapingActive` is only force-reset on browser startup.
21. Popup, content scripts, and service worker all read/write the same storage keys directly (the `Storage` wrapper is only loaded in the popup; `scraper.js`/`offer-fetcher.js` use raw `chrome.storage` calls) — schema changes currently require touching four files; centralize before adding the sync queue.
22. The chatbot stuffs **all** stored products into a single Gemini prompt with no truncation — fine at ~50 products, token-limit failure mode at storefront scale; the dashboard assistant needs retrieval or summarization.

---

## Bottom line

The extension is a working, shipped scraper with genuinely reusable pure-math analytics and a battle-tested selector strategy, but its data model is run-less, context-less, and single-store — every platform-blocking gap (run ids, source metadata, numeric prices, ASIN dedup) is cheapest to fix inside the extension *before* the first Firestore document is written. The highest-leverage capture work is Tier A: image URL, sponsored flag, rank position, "bought in past month", badges, and the seller names already sitting in the offer-page HTML the extension downloads and discards today.

---

## Addendum: installed base (public listing, 2026-06-10)

Verified directly from the public Chrome Web Store listing (`https://chromewebstore.google.com/detail/proscan-amazon-product-sc/bikgignfnljpbmchlemkbbpboigodgap`) on 2026-06-10:

- **Users:** 233
- **Rating:** 4.9 / 5 stars from **8 ratings**
- **Last updated:** February 12, 2026
- **Listed version:** 2.0
- **Review excerpts** (reviews page): "works pretty well" (Sloan Lake, Jan 9 2026); "Saves me so much time! Instantly pulls competitor prices, ratings, and sales data right into Excel… Works exactly as promised!" (Kristian Diana, Aug 4 2025); "Works as intended. easy to understand. had difficulty understanding information at first." (George Trowbridge, Aug 4 2025); plus two positive Feb 18 2025 reviews praising Excel export and competitor data.
- **Not retrievable without the developer dashboard:** exact weekly-active users, install/uninstall trends, geographic breakdown, and per-version adoption — these need the owner's CWS developer dashboard (owner task).

**What the size implies:** At ~233 users this is a small installed base, so migration-compatibility constraints relax considerably — breaking storage-schema changes, feature clawbacks, and a forced-update path are all viable with minimal user-facing fallout. The shared-Gemini-key incident (§5.1) correspondingly has a small blast radius today, but the key is still trivially extractable from the published package and **must be rotated before any publicity or user-growth push** — exposure scales with installs, not with current usage. The positive 4.9-star signal suggests the core scrape→Excel workflow is the thing to preserve through the platform migration.
