# ProScan Platform Architecture

_Last updated: 2026-06-10 — produced by the planning fleet; §§10–13 added after completeness review._

Definitive system design for the ProScan platform: the Chrome extension (scraper + sync client), the Firebase backend (`proscanbot`), and the web dashboard. This document supersedes REVAMP_PLAN §2 and §4 and amends §3 (the data model itself is fully specified in `docs/architecture/data-model.md`). It is the synthesis of two independent design proposals plus the research in `docs/research/technical-firebase.md`, `docs/research/extension-audit.md`, and the tiering in `docs/product/feature-catalog.md`.

---

## 1. Components

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** The "Cloud Functions" row below (and the `mintExtensionToken` callable / custom-token handoff it references, restated in §2 and §4) is dropped. There is NO Blaze plan and NO Cloud Functions, ever. The extension authenticates to Firebase directly via extension-native `firebase/auth/web-extension` (it holds its own refresh token; its uid == the user's account, so the `request.auth.uid == wid` rules still hold). Owner gates are B1+B2 only (B3 removed). Ignore the Functions mechanism everywhere it appears in this doc.

| Component | Tech | Responsibility |
|---|---|---|
| Landing page `/` | Static HTML/CSS, Vite build (Phase 0 done) | Marketing. Never taken down during the build-out. |
| Dashboard SPA `/dashboard/**` | Vite + React + React Router, Recharts, TanStack Table/Virtual | Sign-in, watchlist, run inbox, delta board, spread/Max-Buy, lead pipeline, exports. Reads Firestore via `onSnapshot` with `persistentLocalCache`; writes triage/config docs. |
| Extension content scripts | `scraper.js`, `offer-fetcher.js` (existing, amended) | Scrape SERP/storefront pages and AOD offer HTML; post per-page results to the service worker. No Firebase code here. |
| Extension service worker | MV3, `firebase/auth/web-extension` + `firebase/firestore/lite` | **Write-only sync client.** Queues pages in `chrome.storage.local`, flushes idempotent `writeBatch`es on `chrome.alarms`. Never reads Firestore. |
| Firebase Auth | Email + Google providers | Identity for both clients. `plan` entitlement lives in **custom claims**, not client-writable docs. Free to 50k MAU (https://firebase.google.com/pricing). |
| Cloud Firestore | Single database, rules-as-authz | System of record. Everything under `workspaces/{wid}/...`, `wid == owner uid` today. See `data-model.md`. |
| Cloud Functions | One callable at MVP: `mintExtensionToken` | The single unavoidable Function (custom-token mint for the extension handoff). v2 adds `weeklyDigest` (scheduled, Resend) and `downsampleHistory` (scheduled). Blaze required for any Function (https://firebase.google.com/pricing). |
| Firebase Hosting | One site, one deploy | Serves `/` and `/dashboard/**` from the same origin — no CORS, one `externally_connectable` origin set. |

Out of scope / deleted before launch: the extension's `server/` Python tree, the `syncToServer()` localhost POST, the embedded Gemini fallback key, and the legacy v1 files at the extension repo root (extension-audit §5; these are launch blockers, not features).

---

## 2. Architecture diagram

```
┌──────────────────────────── Chrome (user's browser) ────────────────────────────┐
│                                                                                  │
│  [Amazon tab]                                                                    │
│    scraper.js ──┐  per page: products + sponsored flags + rank + demand fields   │
│    offer-fetcher.js ─┐  per ASIN: sellerPrices + parsed AOD offers               │
│                      │ chrome.runtime.sendMessage (internal)                     │
│                      ▼                                                           │
│  [MV3 service worker — stateless, WRITE-ONLY Firestore client]                   │
│    chrome.storage.local: syncQueue · runState · lastValues map                   │
│    firebase/auth/web-extension  (custom-token session, IndexedDB persistence)    │
│    firebase/firestore/lite      (REST; one writeBatch per queued page)           │
│    chrome.alarms "flush" every 1 min  + immediate flush on page/run complete     │
│        │ idempotent batched writes                ▲                              │
│        │ workspaces/{wid}/...                     │ LINK: custom token via       │
│        │                                          │ chrome.runtime.sendMessage   │
│        ▼                                          │ (externally_connectable)     │
└────────┼──────────────────────────────────────────┼──────────────────────────────┘
         ▼                                          │
┌───────────────────────── FIREBASE project "proscanbot" ─────────────────────────┐
│  Auth: email + Google · custom claims {plan}                                     │
│  Callable Fn: mintExtensionToken          [v2: weeklyDigest, downsampleHistory]  │
│  Firestore: workspaces/{wid}/sources|runs|products|sellers|rules|views|alerts    │
│    Security rules: request.auth.uid == wid  + per-field validation               │
│  Hosting: /  (static landing)   /dashboard/**  (Vite+React SPA)                  │
└──────────────┬──────────────────────────────────────▲────────────────────────────┘
               │ onSnapshot (SCOPED queries only)      │ writes: lead triage,       │
               │ + one-shot getDoc for history/charts  │ rules, views, settings     │
               ▼                                       │
      [Dashboard SPA  https://proscanbot.web.app/dashboard] ──────────────────────┘
        sign-in → mint token → push to extension → watch data stream in
```

Data flows one way from the extension (writes), one way to the dashboard (snapshots); the only extension⇄dashboard channel is the auth handoff plus future `ARM_SCRAPE` deep-link messages (v1 Rescan Queue).

---

## 3. Hosting layout

Unchanged from REVAMP_PLAN §5 Phase 1, restated as the contract:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [{ "source": "/dashboard/**", "destination": "/dashboard/index.html" }]
  }
}
```

- Landing build output → `public/` (owns `/`).
- Dashboard built with Vite `base: '/dashboard/'` → `public/dashboard/`.
- Same origin for both → the extension manifest whitelists exactly one origin set, and the SPA never deals with CORS.
- **Open decision (unchanged, now blocking Phase 4):** lock `proscanbot.web.app` vs a custom domain before the extension manifest ships, because `externally_connectable.matches` is hardcoded in the published manifest (https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable).

---

## 4. Extension ↔ site auth handoff

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** The entire handoff sequence below — the `mintExtensionToken` callable, `createCustomToken(uid)`, the `LINK`/`signInWithCustomToken` dance — is VOID. There is NO Blaze plan and NO Cloud Functions. The extension signs in to Firebase **directly** via extension-native `firebase/auth/web-extension` (email/password + Google), holding its own refresh token. No token is minted by or pushed from the dashboard. The `externally_connectable` / `sender.origin` validation and the `authStateReady()` cold-start guard remain valid; the token-mint mechanism does not. Owner gates are B1+B2 only (B3 removed).

This **replaces REVAMP_PLAN §4 steps 2–4 wholesale.** The plan's raw-ID-token push cannot work: there is no `signInWithIdToken`, the SDK cannot refresh a token it didn't mint, and ID tokens die after ~1 hour — background sync would silently stop (research correction #1, grounded against https://firebase.google.com/docs/auth/web/chrome-extension).

### Handoff sequence

1. User signs in on `/dashboard` (Firebase Auth, email + Google).
2. Dashboard feature-detects the extension: `chrome.runtime.sendMessage(EXT_ID, {type:"PING"})` with a timeout (`EXT_ID = bikgignfnljpbmchlemkbbpboigodgap`).
3. Dashboard calls the callable Function **`mintExtensionToken`** → Admin SDK `createCustomToken(uid)` (~20 lines; the one unavoidable Function, per the feature catalog's prerequisites).
4. Dashboard pushes it: `chrome.runtime.sendMessage(EXT_ID, {type:"LINK", token})` via `externally_connectable`.
5. Extension `chrome.runtime.onMessageExternal` (registered synchronously at worker top level) **validates `sender.origin`** against the locked origin allowlist, then calls `signInWithCustomToken()` from **`firebase/auth/web-extension`** (SDK ≥ 10.8.0) with IndexedDB persistence. The extension now owns its **own refresh token** — background sync works for weeks without the dashboard open.
6. Extension replies `{linked: true, uid}`; popup and dashboard both show "linked" state.
7. Every flush gates on `Promise.race([auth.authStateReady(), timeout(5000)])` — guards the known cold-start hang with IndexedDB persistence (https://github.com/firebase/firebase-js-sdk/issues/8482). On timeout or signed-out: leave the queue intact, surface "Open dashboard to reconnect".

### Security posture

- The SDK persists a refresh token in the extension's IndexedDB. This is the same trust model as any Firebase web app — accepted; do not hand-roll token storage (research §3). REVAMP_PLAN's "short-lived tokens only" principle is amended accordingly.
- Custom tokens are consumed immediately on receipt; their ~1h validity window never matters.
- No raw ID tokens, no passwords, nothing auth-related in `chrome.storage.local`.
- Fallback for users who never open the dashboard (REVAMP_PLAN open decision #4, still deferred): `chrome.identity.launchWebAuthFlow` → `signInWithCredential` — Google-only, no server. Compatible with this data model either way.

---

## 5. Sync pipeline (queue → Firestore)

### 5.1 Extension-local state (`chrome.storage.local`)

```js
syncQueue: [ /* value-complete entries, see below */ ]   // ~6 KB per page entry
runState:  { runId, sourceId, dayKey, startedAt, pagesDone, counters, seenThisRun: [...] }
lastValues: {                       // last observation per ASIN — the delta engine
  "B0C8XL4N2P": { p: 2599, r: 4.5, v: 1701, rk: 18, at: "...", runId: "...", dayKey: "2026-06-02" },
  ...                               // ~60 B/ASIN → 24k ASINs ≈ 1.5 MB
}
```

`lastValues` doubles as the seen-ASIN set (key existence = seen). Within the 10 MB `chrome.storage.local` cap with room to spare; add `unlimitedStorage` to the manifest in the same CWS submission as the sync batch for headroom.

### 5.2 Queue entries are value-complete (the idempotency core)

Everything derived from "previous state" — `prev`, `delta`, `firstSeen`, new-vs-seen counters — is computed **at enqueue time** from `lastValues`/`runState` and frozen into the entry. Flushing is pure replay: a retried batch rewrites byte-identical documents. The worker never reads Firestore and never uses `increment()`.

```js
// kind: "page" — one entry per completed SERP page, persisted BEFORE navigating to the next page
{ kind: "page", runId, page, dayKey,
  chunk:   { scrapedAt, expireAt, count, items: { asin: point, ... } },   // EVERY placement, incl. sponsored repeats
  upserts: [ { asin, name, img, url, latest, prev, delta, firstSeen? } ], // once per ASIN per run, first organic occurrence wins
  runHeader:   { status, pagesDone, counters... },                        // ABSOLUTE values from runState
  sourcePatch: { lastScrapedAt, lastRunId, catalogSize } | null }         // first + last page only

// kind: "spread" — one entry per completed per-ASIN offer fetch
{ kind: "spread", runId, dayKey, asin,
  productPatch: { spread, scores },                       // stats + extension-computed scores (spread-analyzer.js)
  historyPoint: { sc, mn, mx, md, cv, oc, fba, az },      // merged into the same dayKey point
  snapshot:     { prices, offers, totalOfferCount, at, expireAt },
  sellerPatches:[ { sellerId, name, asins:[asin], lastSeenAt } ] }
```

### 5.3 Flush algorithm

Trigger: `chrome.alarms` every 1 min while a run is active or the queue is non-empty, plus an immediate flush on `PAGE_COMPLETE` and `SCRAPING_COMPLETE`. All listeners registered synchronously at top level; the worker rehydrates everything from storage on each wakeup (MV3 discipline from REVAMP_PLAN §4, unchanged).

1. Gate on `authStateReady()` race (see §4 step 7).
2. Drain FIFO. **One `writeBatch` per page entry** via `firebase/firestore/lite`:
   `1` page chunk set + `|upserts| × 2` (product merge + history merge) + `1` run-header merge + `0–1` source merge ≤ **123 ops** at Amazon's ≤60-placement pages — far under the 500-op batch limit, so a batch never needs splitting.
3. Spread entries batch ~35 ASINs together (≈6 ops each).
4. On commit success, atomically remove the entry from `syncQueue` **then** update `lastValues` from the entry's `latest` values. On failure: keep the entry, exponential-backoff counter; every write is idempotent so retry is safe.
5. On `SCRAPING_COMPLETE`: final flush, then run header merged to `{status:"complete", finishedAt, counters}` and the source doc's `lastScrapedAt`/`catalogSize` patched.

### 5.4 Failure modes

| Failure | Behavior |
|---|---|
| Tab dies mid-run (full-page-navigation pagination) | At most the in-flight page is lost; `runId` + cursor + `seenThisRun` persist in `runState`, resume continues the **same** run (no forked runs). |
| Worker killed mid-flush | Batch either committed or not; retry rewrites identical docs. Queue entry only removed after commit. |
| Signed out / token refresh fails | Queue retained indefinitely (months of backlog fit in storage); flush paused; popup + dashboard show "reconnect". |
| Extension reinstalled | `lastValues` lost → next run omits `prev`/`delta` and over-reports `newSeen` once; dashboard falls back to the history doc for deltas. Self-heals on the following run. |
| Run abandoned (no page write 30 min) | Dashboard marks the run `dead` — no extension heartbeat needed. |
| Same storefront scraped twice in one day | Second run overwrites the day's history point (daily granularity is the contract); per-run fidelity is preserved in page chunks. |

### 5.5 Extension prerequisites (load-bearing, before the first Firestore write)

From the feature catalog's prerequisite table — this schema is impossible without them: run-ID minting + per-page persistence; numeric price (**integer cents**) at capture; ASIN dedup + sponsored flag + organic rank; spread correctness fixes (`Set()` dedup removal, `condition=new` on AOD URL, fallback-selector containment, `spreadResults` reset); wiring `getTotalResults()`; deleting `syncToServer()` + `server/`; rotating the embedded Gemini key. The 214-test fixture suite is the contract for every selector change.

---

## 6. What changed vs REVAMP_PLAN, and why

| # | REVAMP_PLAN said | This architecture | Why |
|---|---|---|---|
| 1 | §3: `users/{uid}/clients` + `competitors` collections | **Dropped.** Replaced by `sources/{sourceId}` — the storefront/keyword watchlist keyed by Amazon seller ID | A CRM shape grafted onto a tracking product. The actual organizing spine of the seller workflow is the storefront watchlist (MVP feature); no MVP/v1/v2 feature uses "clients". `tags[]` covers grouping. |
| 2 | §3: one doc per scraped product | ASIN-keyed `products/{asin}` + one `history/daily` doc + per-page run chunks | One-doc-per-scrape makes a 90-day/200-product render ~18,000 reads; the hybrid makes it ≤400 and gives cross-run dedup structurally (research §1, model D). |
| 3 | §3: `scrapeRunId` as a field | First-class `runs/{runId}` docs + `pages/` chunk subcollection | Runs must be browsable, diffable, deletable units (Run Inbox, Run-to-Run Diff — both catalog features). |
| 4 | §4: dashboard pushes a raw **ID token**; extension "refreshes via SDK" | Custom-token mint (callable Fn) + `signInWithCustomToken` via `firebase/auth/web-extension` | A raw ID token cannot initialize or refresh an SDK session; background sync would die after ~1h (research correction #1, https://firebase.google.com/docs/auth/web/chrome-extension). |
| 5 | Root `users/{uid}/...` | Root **`workspaces/{wid}/...`** with `wid == uid` today; `users/{uid}` survives as a profile/pointer doc | The catalog's Later tier (VA Seats) says verbatim: "design Firestore paths for it now to avoid a migration." Cost now: one path segment + one rules function + a `rootRef(wid)` helper in both clients. Cost later: zero data migration. |
| 6 | §3: one wildcard security rule, "harden later" | Per-collection rules with per-field validation from day 1 | Validation is cheap to write now and prevents malformed extension writes from ever entering the moat dataset. Full rules in `data-model.md` §5. |
| 7 | Implicit: price as captured | **Integer cents at the extension boundary**; display strings never enter Firestore | All delta math, Max Buy, and rules need numbers; three modules currently re-parse the string differently (audit §5.6). |
| 8 | Full Firebase SDK in the worker | `firebase/auth/web-extension` + `firebase/firestore/lite` only | The worker only writes; the realtime machinery is dead weight (research correction #5). |
| 9 | Implicit: Spark as long as possible | **Blaze at Phase 4**, budget alert at $10/mo | The token mint is a Function; Functions are Blaze-only. Free allowances persist on Blaze; expected bill ≈ $0 until hundreds of active users (research §2). |
| 10 | *(absent)* | `prev` + `delta` scalars stamped on the product doc by the extension | New in this synthesis — see §7. Makes "Movers"/Flip Radar a server-side top-N query instead of N history reads. |

Everything else in REVAMP_PLAN survives: queue in `chrome.storage.local`, `chrome.alarms` flush, idempotent doc IDs, rules-as-authz, hosting layout, phased build plan (Phases 0–6 proceed as written, with §3/§4 content swapped for this document and `data-model.md`).

---

## 7. Synthesis record — what was taken from each proposal

Two independent proposals (A: "minimal evolution", B: "ideal platform") were judged on read costs at 60 storefronts × 400 products × weekly × 12 months (~20–24k tracked ASINs), write-path simplicity/idempotency, diff ergonomics, free-tier fit, migration friction, and v2 headroom. They agreed on the core (ASIN-keyed products + single history doc + run chunks + write-only idempotent extension + one auth Function). Where they differed:

| Decision | Proposal A | Proposal B | **Chosen** | Reasoning |
|---|---|---|---|---|
| Root path | `users/{uid}` | `workspaces/{wid}`, wid=uid | **B** | A's "future move is a path prefix swap" understates: a prefix swap *is* a full data migration. B's indirection costs ~nothing now. |
| Chunk unit | 240-item chunks (`c0001`) | Per-page docs (`p0001`) | **B** | The page is the natural persistence unit (tab-death tolerance) and the natural batch — no regrouping logic, batches ≤123 ops vs A's 482 grazing the 500 limit. The diff-read difference (≈20 vs ≈12 reads per two-run diff) is immaterial. |
| Run ID | `{sourceKey}_{startEpochMs}` natural key | ULID | **A** | No dependency, time-sortable, greppable, idempotent by construction. |
| Offers/raw spread | Embedded `offers.sellers[]` on the product doc | TTL'd `offerSnapshots/{runId}` subcollection | **B** | Embedding bloats the hot doc every table render pays for (egress is billed; reads are per-doc regardless of size — https://firebase.google.com/docs/firestore/pricing). Summary stays hot, raw goes cold. |
| Delta computation | Read history doc per row (both A and B) | same | **Neither — new design** | At the judging scale a global movers render is ~48k reads / ~40 MB. The extension already keeps a local seen-set; extending it to a `lastValues` map lets it stamp `prev` + `delta` on the product doc idempotently. Movers = `orderBy delta.pPct limit 100` ≈ 100 reads. History doc remains the source for charts and exact 30-day comparisons. |
| Rules / saved views | Maps embedded in the user doc | Separate collections | **B (minus tags)** | Deep-linkable view IDs and growable rule sets fit docs better; the read-count difference is single digits. Tags stay as strings on products + a `tagMeta` map on the workspace doc — a tags collection is overkill. |
| Sellers (v1 discovery) | None (in-memory over subscribed products) | `sellers/{sellerId}` with `increment()` counters | **B minus increments** | In-memory aggregation breaks once views are scoped (you never have all products loaded at 24k ASINs). `increment()` violates the idempotency invariant — dropped; overlap is `asins.length`, ranked client-side. |
| Lead activity trail | Bounded `statusHistory` array (last 10) | `events/` subcollection | **B** | Append-only, unbounded, rules-enforced immutable; the v2 Ledger needs the full trail. Stage/reason stay denormalized on the product doc for badges. |
| Run counters / newSeen | Extension-computed absolute values | Dashboard-computed lazily, cached back | **A** | The extension has the local state anyway (`lastValues`); absolute values keep the no-read, no-increment invariant. Dashboard heal remains the fallback after reinstall. |
| Security rules at launch | Wildcard now, validate in Phase 6 | Per-field validation now | **B** | See §6 row 6. |
| Scores | Extension-written | Dashboard-written cache | **Split** | Spread-coupled scores (opportunity/arbitrage/combined/maxBuy) are written by the extension at fetch time — the math (`spread-analyzer.js`, `analyzer.js`) already lives there and is unit-tested. Rule verdicts are dashboard-written caches (rules live in Firestore). |

---

## 8. v2 growth seams and Functions inventory

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** There is NO Blaze plan and NO Cloud Functions, ever. The `mintExtensionToken` (MVP) row below is dropped entirely — the extension authenticates to Firebase directly via extension-native `firebase/auth/web-extension`. The v2 `weeklyDigest` / `downsampleHistory` Functions are likewise unavailable under the no-card constraint and would need a non-Function approach (or to be cut) if revisited. Owner gates are B1+B2 only (B3 removed).

| Function | Phase | Trigger | Job |
|---|---|---|---|
| `mintExtensionToken` | 4 (MVP) | Callable from the signed-in dashboard | `createCustomToken(uid)` — ~20 lines |
| `weeklyDigest` | v2 | Cloud Scheduler weekly (3 jobs free per billing account — https://cloud.google.com/scheduler/pricing) | Reads `alerts` + `sources` + history slices, writes a digest doc, emails via Resend (SendGrid's free tier died 2025-07 — https://www.twilio.com/en-us/changelog/sendgrid-free-plan) |
| `downsampleHistory` | v2 | Cloud Scheduler monthly | Folds `history/daily` points older than 365d into `history/monthly`; capacity insurance, not a launch requirement |

Schema-level seams already in place (details in `data-model.md` §9): `alerts/` path reserved; `lead.recheckAt` field reserved (Re-Check Queue); `lastReviewedAt` on the workspace doc (What-Changed feed); Excel import writes a synthetic run with `source.type:"import"` through the identical upsert path; `mk` field on products/runs for marketplace expansion; Storefront Scorecards ride Firestore aggregation queries (≈1 read per 1,000 index entries — https://firebase.google.com/docs/firestore/query-data/aggregation-queries); VA Workspaces is a rules change, not a data migration.

---

## 9. Remaining open decisions

1. **Canonical origin** for `externally_connectable` + Hosting (REVAMP_PLAN open decision #3). Must be locked before Phase 4 — hardcoded in the published manifest.
2. **OAuth fallback in the extension** (`launchWebAuthFlow`, Google-only) — build now or defer (REVAMP_PLAN open decision #4). Default: defer; the data model is unaffected.
3. **`unlimitedStorage` permission** in the sync CWS submission — recommended (the `lastValues` map plus a long offline backlog can approach the 10 MB default cap at power-user scale); costs one low-severity permission warning at update time.

---

## 10. Extension build pipeline

_Added 2026-06-10 after completeness review._

The extension currently has **no bundler** — every file ships as authored. That stops working at Phase 4: this architecture requires npm modules (`firebase/auth/web-extension`, `firebase/firestore/lite`, SDK ≥ 10.8.0) compiled into the MV3 service worker, and MV3 forbids loading code at runtime.

- **Bundler: esbuild.** Fast, zero-config, and its IIFE output loads directly as an MV3 worker script with no module-loader shims. One entry point for the service worker; the content scripts (`scraper.js`, `offer-fetcher.js`) can stay unbundled until they grow imports.
- **Config module pattern** for per-environment values, selected at build time (`config.dev.js` / `config.prod.js`): the Firebase web config, the allowed dashboard origins (the `sender.origin` allowlist from §4 step 5), and the `EXTENSION_ID` constant the dashboard side consumes for `chrome.runtime.sendMessage`. No environment branching at runtime.
- **npm scripts**: `test` (Jest), `build` (esbuild → `dist/`), `zip` (package `dist/` only).
- **Packaging must provably exclude dead weight.** The repo root still contains the legacy v1 files (`popup.js`, `popup.html`, `popup.css`, `background.js`, `contentscript.js`, root icons) and the dead `server/` Python tree — both ship today if the folder is zipped naively. The `zip` step packages an allowlisted `dist/` output, never the repo root, and the build fails if any legacy filename appears in the archive.
- **Test-suite continuity.** The 214-test Jest fixture suite is the contract for every selector change (§5.5) and must keep passing under the new module layout — either keep the jest config/module maps CommonJS-compatible, or migrate the suite to ESM as a deliberate step, not as a side effect of introducing the bundler.

---

## 11. Dev, staging, and rules testing

_Added 2026-06-10 after completeness review._

- **Firebase Emulator Suite (Auth + Firestore + Functions) for all local development.** Both clients point at the emulators in dev builds (the §10 config module carries the switch) so test scrapes never land in the production dataset — which matters precisely because that dataset is the compounding moat.
- **`@firebase/rules-unit-testing`** against the Firestore emulator for the per-field security rules in `data-model.md` §5: assert the extension can write only the documented shapes, the dashboard can write only triage/config docs, and cross-`wid` access is denied. Rules regressions become test failures, not incidents.
- **Optional staging project.** A second free (Spark) Firebase project as staging for end-to-end extension tests — real Auth, real rules, real `externally_connectable` handoff — before each CWS submission. Costs nothing; the one callable (`mintExtensionToken`) is Blaze-only to deploy, so staging either runs it in the Functions emulator or flips to Blaze at ~$0.

---

## 12. Release engineering — Chrome Web Store

_Added 2026-06-10 after completeness review._

The sync-enabled version is a materially different product in CWS terms — it starts collecting user data into the cloud and adds manifest permissions. Treat the submission as a project milestone, not a formality.

**Hard prerequisites (block the upload):**

1. A **live privacy-policy URL and ToS** hosted on the website (the §3 Hosting site) and linked from the CWS listing — required once the extension transmits user data.
2. **Updated CWS data-disclosure form** (Privacy practices tab): the extension goes from "collects nothing" to syncing scraped data, auth identity, and usage state to Firebase; every applicable category must be disclosed accurately.
3. A **Limited Use statement** certifying collected data is used only for the user-facing features described.
4. **Rotate/remove the hardcoded base64 Gemini API key** in `service-worker.js`. Already a launch blocker (§1), now promoted to an immediate store prerequisite — an exposed credential is grounds for rejection, and the key is leaked regardless of review outcome.
5. **Remove the popup's CDN-loaded Font Awesome.** Remotely hosted code/resources are an MV3 review liability; vendor the icons (or a subset of the font) into the package.

**Review timeline and rollout:**

- Typical review is a few days, but the manifest additions in this plan (`externally_connectable`, `unlimitedStorage`) are exactly the kind of permission change that can route the item to longer manual review — **plan 1–3 weeks of buffer** before any date that depends on the new version being live.
- Use a **staged rollout percentage** on the new version where CWS offers it (partial rollout is gated on item size — currently items above ~10,000 seven-day actives); below that threshold, keep the previously reviewed zip ready for re-submission as the rollback path.

**Compatibility during review (old-version users):**

- The dashboard must degrade gracefully while old extension versions remain in the field (review window plus Chrome's lazy auto-update). It already feature-detects by `PING` with a timeout (§4 step 2); extend the `PING` reply with a version field, and when the extension is absent or pre-sync, render an explicit **"update your extension"** state — never errors or a broken link flow.
- Old versions have no `onMessageExternal` listener, so the dashboard's `PING` simply times out — the timeout path covers them with no extra code in the old version.

---

## 13. Ops hardening — backups

_Added 2026-06-10 after completeness review._

The dataset is the compounding longitudinal moat (§6 row 6); it must survive an operator mistake or a bad rules deploy, not just a region failure. When Blaze flips on at Phase 4:

- Enable **Firestore point-in-time recovery** (7-day window) — the lower-effort default (https://firebase.google.com/docs/firestore/pitr) — or alternatively a **weekly scheduled export to a GCS bucket** (`gcloud firestore export` driven by Cloud Scheduler).
- Cost is small at this scale: PITR bills extra storage for retained versions; exports bill document reads plus GCS storage — single-digit dollars/month at the judging scale (§7), ≈ $0 at launch.
- Add the enablement (and a periodic restore check) to the ops checklist alongside the existing $10/mo budget alert (§6 row 9).
