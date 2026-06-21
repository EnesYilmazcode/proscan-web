# ProScan Roadmap

_Last updated: 2026-06-10. Milestones M0–M7. Feature definitions live in `product/feature-catalog.md`; architecture in `architecture/`; who-does-what in `TASKS.md`; owner decisions in `decisions.md`. The marketing site at `/` stays live through every milestone._

```
M0 ✅ ──> M1 Foundations ──> M2 Auth+Shell ──┬──> M3 Sync Engine (extension) ──┐
                                             └──> M4 MVP Dashboard (parallel) ─┴──> M5 v1 Decision Layer ──> M6 Retention+Monetization ──> M7 Later
```

M3 and M4 deliberately run in parallel: the dashboard is built against the Firebase Emulator Suite with seeded fixture data while the extension sync engine goes through its Chrome Web Store review cycle.

---

## M0 — Build pipeline ✅ done (commit `0429cc3`)
Vite `src/ → dist/` pipeline; landing page byte-identical; deployed site unaffected.

## M1 — Foundations (fully autonomous; no owner gates)
**Goal: the repo, hosting layout, and extension codebase are ready to grow.**
- Hosting layout for coexistence: landing at `/`, SPA rewrites for `/dashboard/**` (`firebase.json`), React+Vite+TypeScript SPA scaffold with router, built to `dist/dashboard/`.
- Firebase Emulator Suite (Auth + Firestore + Functions) wired into dev scripts; seeded fixture data matching `data-model.md` shapes.
- Extension hygiene batch (no behavior change): delete the dead `server/` tree + `syncToServer()` localhost POST; remove legacy v1 root files; esbuild build pipeline + packaging script that provably excludes them; Jest suite green on the new layout.
- **Selector + AOD verification spike** (time-boxed): verify every planned new selector against live Amazon pages, capture fresh HTML fixtures into Jest first, empirically test AOD throttle behavior at 2s+jitter cadence.
- Privacy policy + ToS drafted and staged as site pages (CWS prerequisite for M3, per the release-engineering plan in `architecture/platform-architecture.md`).
- Brand the 404 page; deploy the (still-identical) site through the new pipeline once.

## M2 — Auth + dashboard shell (owner gates: B1 create Firestore, B2 enable Auth providers)
**Goal: a user can sign in and see an empty, branded workspace.**
- Firebase Auth (email + Google) on `/dashboard`; sign-in/sign-up/reset screens; profile menu; sign-out.
- Firestore security rules v1 (per-field validation from `data-model.md` §5) + composite indexes + single-field exemptions deployed; `@firebase/rules-unit-testing` suite green.
- Empty-state workspace UI: the `workspaces/{wid}` doc created on first sign-in; landing page links to the dashboard.
- Decision D6 (drop "clients") confirmed before rules ship.

## M3 — Sync engine (owner gates: D1 Blaze, B4 key rotation, B5 CWS submission; decisions D2, D4, D9–D11)
**Goal: a scrape on Amazon appears in the dashboard, idempotently, within minutes.**

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** The "D1 Blaze" gate and the `mintExtensionToken` callable / `signInWithCustomToken` auth-handoff bullet below are dropped. There is NO Blaze plan and NO Cloud Functions. The extension authenticates to Firebase directly via extension-native `firebase/auth/web-extension`; M3 owner gates collapse to B4 + B5 (D1/B3 removed, B1+B2 land at M2). Ignore the Blaze/Function references below.
- Extension data prerequisites (the feature-catalog "cross-cutting prerequisites"): `scrapeRun` entity (runId `{sourceKey}_{startEpochMs}`, `me=`/`k=` source parsing, per-page persistence), numeric price parsing, ASIN dedup + sponsored flag + organic rank, spread-correctness fixes, `spreadResults` reset fix.
- Gemini key rotation + BYO-key settings UI (D4 default) — shipped in this same release.
- Sync writer: queue in `chrome.storage.local`, `firebase/firestore/lite` in the worker, one `writeBatch` per SERP page, absolute-value `set(merge:true)` writes, local `lastValues` map stamping `prev` + `delta` scalars, `chrome.alarms` flush.
- Auth handoff: `mintExtensionToken` callable (the one Function — Blaze, D1) + `signInWithCustomToken` via `firebase/auth/web-extension`; `externally_connectable` locked to the D2 origin; linked/unlinked UI in popup and dashboard.
- One-time local-history import as synthetic run (D9).
- **CWS submission batch (a)** per the release-engineering plan: data-disclosure form updated, privacy-policy URL live, staged rollout, dashboard feature-detects old extension versions gracefully. Expect days-to-3-weeks of review buffer.
- Firestore PITR/backup enabled when Blaze flips on.

## M4 — MVP dashboard (parallel with M3 against the emulator; fully autonomous)
**Goal: the first platform that beats the Excel workbook.** The six MVP features:
1. **Auth & Cloud Sync Foundation** (lands via M2+M3).
2. **Scrape Run Inbox** — runs as named cards, "X new / Y already seen".
3. **Month-over-Month Delta Board & History Drawer** — Δprice/Δrating/Δreviews columns, Movers filter, Recharts sparklines per ASIN.
4. **Spread & Variation Analysis with Max Buy Price** — spread stats finally surfaced + "buy below $13.10 for 30% ROI" sentence.
5. **Storefront Watchlist** — the organizing spine; nickname, seller ID, tags, staleness.
6. **Dashboard XLSX Export** — FBA Lead List format, reusing the tested `exporter.js`.
- Stack per `research/technical-firebase.md`: React, TanStack Table v8 (+ Virtual), Recharts, hand-rolled `onSnapshot` hooks.
- **Exit criterion:** after two scrapes of one storefront, a user sees what changed, what to buy below what price, and exports a clean workbook — without opening Excel.

## M5 — v1 decision layer (one extension batch (b): AOD parse + 3 selectors + ARM_SCRAPE; rest is dashboard work)
**Goal: ProScan answers "what should I buy, who should I scrape, what's next" — the owner's what-to-flip/what-to-scrape asks, fully landed.**
- Order of shipping inside M5: Offer Intelligence first (its AOD parse feeds three other features), then Rules Engine → Run-to-Run Diff → Seller Discovery → Rescan Queue → Flip Radar → Lead Lifecycle Pipeline → Review-Velocity Signals → Demand Signals → Reverse-Source Links → Saved Views → Tags + Bulk Actions.
- Variation-hint selector ships here under D5's default.
- D7 review point: with offer-fetcher telemetry in hand, revisit the BSR/PDP-fetch deferral.

## M6 — Retention + monetization (owner gates: B7 Stripe account, B8 TTL toggle; decision D3)
**Goal: the pull-back-in loop and the first dollar.**
- v2 features in rough order: What Changed Home Feed → Change Alerts & Weekly Digest (Cloud Scheduler + Resend) → Excel Workbook Import → Already-Evaluated Ledger → Re-Check Due Queue → Delisted Tracker → Spread Sentinel → Storefront Scorecards → Data Hygiene Center → Scrape Health Check → First Scrape Wizard (timed to the marketing push).
- Monetization: pricing page, Stripe Checkout + one webhook Function + customer portal; plan claims; quota enforcement per `data-model.md`'s design note; TTL policies on cold collections.
- Website relaunch completes: pricing, testimonials, CWS rating badge, data-deletion flow (trust checklist in `research/monetization-and-positioning.md`).

## M7 — Later (parked deliberately; see feature-catalog "Later" tier)
VA Seats & Shared Workspace (the data model is already shaped for it), Ask Your Data, Catalog Copilot, Monthly Flip Report, AI Narrative & Coaching Layer. Trigger to unpark: single-user retention proven (M6 digest open/click rates, Pro conversion) or a concrete agency/team customer.

---

## Standing constraints

- Extension changes cluster into exactly **two CWS submissions** (M3 batch a, M5 batch b) — review times are unpredictable, so batches are sacred; nothing else forces a store re-review.
- Nothing before M6 is paywalled; current extension capabilities are never paywalled (product principle 1).
- Every new selector gets a Jest fixture before implementation (the 214-test suite is the selector contract).
- All development against the emulator; production `proscanbot` data is never a test surface.
