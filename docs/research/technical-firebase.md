# Firebase Technical Research — Data Model, Pricing, MV3 Auth, Dashboard Stack

_Last updated: 2026-06-09 — produced by the planning fleet._

Pressure-test of REVAMP_PLAN.md against current (2025–2026) Firebase/Chrome facts, plus concrete recommendations for the parts the plan left open (time-series modeling, charting, tables, digests). Read alongside `CONTEXT.md` and `REVAMP_PLAN.md`.

## 0. Corrections to REVAMP_PLAN — read this first

| # | REVAMP_PLAN says | Reality (2026) | Fix |
|---|---|---|---|
| 1 | Dashboard pushes a Firebase **ID token**; extension stores it and "refreshes via the Firebase SDK" (§4.4) | A raw ID token **cannot** initialize a Firebase Auth SDK session — there is no `signInWithIdToken`, and the SDK cannot refresh a token it didn't mint. ID tokens die after ~1 hour. | Push a **custom token** (minted by a tiny callable Cloud Function) and call `signInWithCustomToken` from `firebase/auth/web-extension` in the worker. The extension then owns its own refresh token and stays signed in autonomously. See §3. |
| 2 | `users/{uid}/products/{productId}` = "one doc per scraped product" per scrape run (§3) | That conflates *tracked product* with *observation*. Re-scraping creates duplicate product rows, and charting one ASIN's history requires a `where('asin','==',…)` query over all observations — expensive reads and a messy product list. | Split into `products/{asin}` (identity + latest values) and per-product **history/snapshot** docs. See §1. |
| 3 | Implicit: stay on Spark as long as possible | Custom-token minting, weekly digest emails, and history downsampling all require Cloud Functions, which are **Blaze-only** ("Spark Plan: Not available" — https://firebase.google.com/pricing). | Enable Blaze at Phase 4 with a budget alert. Expected real bill at <100 users: ≈ $0/mo (free allowances apply on Blaze too). See §2. |
| 4 | "Set Auth persistence to `indexedDBLocalPersistence`" in the worker | Still correct, but the supported way since SDK v10.8.0 is the dedicated **`firebase/auth/web-extension`** entry point (https://firebase.google.com/docs/auth/web/chrome-extension). There are open issues where `onAuthStateChanged` hangs on worker restart with indexedDB persistence (https://github.com/firebase/firebase-js-sdk/issues/8482) — wrap startup auth in `authStateReady()` plus a timeout fallback. |
| 5 | (not addressed) Extension bundles full Firestore SDK | The worker only *writes*; it never needs `onSnapshot`. Use **`firebase/firestore/lite`** (fetch/REST-based, much smaller, worker-safe) in the service worker; full SDK only in the dashboard. |
| 6 | `externally_connectable` matches `https://proscanbot.web.app/*` | Still valid — explicit hosts are fine; only broad wildcards (no second-level domain) are rejected (https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable). Keep the `sender.origin` check. Decide the custom domain **before** Phase 4 as the plan says. |

Everything else in REVAMP_PLAN (queue in `chrome.storage.local`, `chrome.alarms` flush, idempotent doc IDs, security-rules-as-authz, Hosting layout) checks out against current docs.

---

## 1. Firestore data model for price/rating time series

### Hard limits that shape the design

- Max document size **1 MiB** (https://firebase.google.com/docs/firestore/quotas).
- Arrays/maps are indexed per element by default; large array/map fields can approach the **40,000 index entries per document** limit — exempt history fields from indexing (https://firebase.google.com/docs/firestore/best-practices).
- Collections with a sequentially increasing indexed field (e.g. `scrapedAt`) cap at **~500 writes/sec** (same best-practices page). Irrelevant at ProScan's per-user burst sizes (hundreds of docs), worth knowing if a bulk import is ever built.
- Reads are billed **per document**, regardless of size; egress beyond 10 GiB/month is billed separately — so "few small docs for the list view, one fat doc for the chart, fetched only on demand" is the cost-optimal shape.

### Options compared (200 tracked products, 90-day daily history)

| Model | Reads to render product list | Reads to chart 1 product (90d) | Reads to chart all 200 | Verdict |
|---|---|---|---|---|
| A. Snapshot subcollection only (`products/{asin}/snapshots/{runId}`) | 200 + a "latest" query each, or denormalized latest | 90 | **18,000** (36% of the whole project's daily free read quota in one render) | Too read-expensive as the chart source |
| B. History embedded in the product doc (array or date-keyed map) | 200 (but each doc carries the full history payload → egress waste on every list render) | 0 extra | 200 | Cheap reads, but bloats the hot list doc; web SDK can't fetch partial fields |
| C. One doc per scrape run embedding all product rows | n/a (no per-product doc) | must read ~90 run docs and filter | ~90 | Great for "diff between two runs", terrible for per-product queries; a 3–4k-product run hits 1 MiB |
| **D. Hybrid (recommended)**: small `products/{asin}` doc + one `series` doc per product + optional raw snapshots with TTL | **200 small reads** | **1 extra read** | 400 | Best read/egress economics, simple writes |

### Recommended schema (replaces REVAMP_PLAN §3 `products`)

```
users/{uid}/products/{asin}                 // small "identity + latest" doc — list view reads only these
  { asin, name, url, isPrime, clientId?, competitorId?,
    latest: { price:Number, rating, reviewCount, sellerCount?, scrapedAt, runId },
    prev7d:  { price, rating, reviewCount },        // tiny denormalized delta source for list badges
    opportunityScore, arbitrageScore,
    firstSeenAt, lastScrapedAt }

users/{uid}/products/{asin}/series/daily    // ONE doc: compact history, fetched only for charts
  { points: { "2026-06-09": { p:19.99, r:4.5, rc:1234, sc:7, mn:17.50, mx:24.99 }, ... } }
  // ~80 bytes/point → 3 years of daily points ≈ 90 KB, far under 1 MiB
  // map keyed by date ⇒ extension appends idempotently via update() on a dotted
  // field path — no read-modify-write, re-scraping the same day just overwrites
  // EXEMPT `points` from indexing (single-field exemption) — avoids the 40k
  // index-entry ceiling and per-element index write amplification

users/{uid}/products/{asin}/snapshots/{runId}   // OPTIONAL raw fidelity (sellerPrices[], full spread)
  { price, rating, reviewCount, isPrime, spread:{...}, scrapedAt, runId,
    expireAt }                                   // TTL field, e.g. scrapedAt + 400 days

users/{uid}/runs/{runId}                    // scrape-run metadata (what/when/where)
  { startedAt, source:"search"|"storefront", query?, storefrontUrl?, productCount, status }
```

Notes:
- Keying products by **ASIN** gives free dedupe across scrape runs — exactly what month-over-month tracking needs. Price must be stored as a **number** (parse the extension's display string at queue time; keep the raw string in the snapshot doc if wanted).
- Extension write per product per run = 2–3 writes (`products/{asin}` merge-update, `series/daily` dotted-path update, optional snapshot create). A 200-product run ≈ 400–600 writes.
- `where('clientId','==',X)` still works on the product docs, preserving the plan's client/competitor grouping.

### Aggregation queries vs. rollup docs

- `count()`/`sum()`/`average()` are billed at **1 document read per 1,000 index entries scanned** (minimum 1) — https://firebase.google.com/docs/firestore/query-data/aggregation-queries and https://firebase.google.com/docs/firestore/pricing. Portfolio stats over 200 products ("avg rating", "count under $20") cost ~1 read each. Use them directly in the dashboard; no infra needed.
- Aggregations **cannot** produce chart points (no group-by-day), so they don't replace the series doc.
- A Cloud Function **rollup is warranted** for exactly two jobs here: (1) the weekly change digest (precompute `users/{uid}/digests/{isoWeek}` so the email and a "what changed" dashboard panel read 1 doc), and (2) monthly **downsampling/pruning** of `series/daily` points older than ~13 months to monthly granularity. Skip write-time rollups otherwise — at this scale they're premature (https://firebase.google.com/docs/firestore/solutions/aggregation).

### TTL for old snapshots

Firestore TTL policies (one TTL field per collection group, set on `expireAt`) auto-delete expired docs, typically within **24 hours** of expiry; expired docs still appear in queries until physically deleted; TTL deletes are billed as normal deletes — $0.02/100k, i.e. negligible (https://firebase.google.com/docs/firestore/ttl). Apply TTL to `snapshots` (raw fidelity) only; `series/daily` is pruned by the downsampling function, and product docs never expire.

---

## 2. Firebase pricing 2026 and free-tier fit

Verified against https://firebase.google.com/pricing and https://firebase.google.com/docs/firestore/pricing (2026-06):

| Service | Spark (free) | Blaze (pay-as-you-go; **includes the same free allowances**) |
|---|---|---|
| Firestore reads | 50k/day | then $0.06 / 100k (nam5 multi-region; single regions cheaper — https://cloud.google.com/firestore/pricing) |
| Firestore writes | 20k/day | then $0.18 / 100k |
| Firestore deletes | 20k/day | then $0.02 / 100k |
| Firestore storage | 1 GiB | then ~$0.18 / GiB-month (nam5) |
| Firestore egress | 10 GiB/month | then GCP internet egress rates |
| Auth | **50k MAU** free (email/social); SAML/OIDC 50 MAU | same free tier, then Identity Platform tiers; phone SMS always billed |
| Hosting | 10 GB storage, **360 MB/day** transfer | then $0.026/GB storage, $0.15/GB transfer |
| Cloud Functions | **Not available** | 2M invocations/mo, 400k GB-s, 200k CPU-s free, then $0.40/M |
| Cloud Scheduler | n/a | **3 jobs free** per billing account, then $0.10/job/month (https://cloud.google.com/scheduler/pricing) |

Key framing: **free quotas are per project, not per user.** Estimates below assume an active user scrapes ~5 runs/week × ~100 products (≈ 215 writes/day with the §1 model) and opens the dashboard ~5×/week (≈ 285 reads/day):

| Scale | Firestore reads/day | Firestore writes/day | Fits Spark? | Est. Blaze bill |
|---|---|---|---|---|
| 10 users | ~3k | ~2k | **Yes** — except anything needing Functions | ~$0/mo |
| 100 users | ~29k | ~21k | Borderline — writes graze the 20k/day line on busy days | < $1/mo |
| 1,000 users | ~285k | ~215k | No | ~$5 reads + ~$11 writes + ~$2–3 storage + egress ≈ **$20–40/mo** |

> **Correction (2026-06-10, after completeness review):** the ~215 writes/day/user figure above predates the final schema — per-page observation chunks plus dual product + history writes per ASIN per run (~92 writes per SERP page) put the median user at **~960 writes/day**. `docs/architecture/data-model.md` §7 is the **authoritative cost model**; the "borderline Spark at 100 users" row is **false** under the final schema (100 median users ≈ 96k writes/day, ~5× Spark's 20k/day cap). The conclusion is unchanged — Blaze at Phase 4, still cheap (≈$5–8/mo at 100 users per data-model.md §7.3).

Honest verdict: the product fits Spark only in a degraded form (no custom-token auth handoff, no digest emails, Google-only extension sign-in). Since Functions are needed by Phase 4 anyway, **enable Blaze at Phase 4, set a budget alert at $10/mo**, and expect to pay nothing until hundreds of active users. The single biggest self-inflicted cost risk is model A from §1 (snapshot-only charting): one all-products 90-day render = 18,000 reads; the §1 hybrid model makes the same render 400 reads.

Hosting note: at 1,000 users the SPA bundle (say 500 KB gz × repeat visits) can exceed Spark's 360 MB/day; on Blaze that's a few dollars/month at most. Keep the charting bundle small (§4) and rely on HTTP caching.

---

## 3. Firebase Auth in the MV3 extension (2026 best practice)

Official guide: https://firebase.google.com/docs/auth/web/chrome-extension. Key facts:

- Since SDK **v10.8.0**, import auth from **`firebase/auth/web-extension`** in extension contexts. It supports email/password, email link, anonymous, and **custom-token** sign-in directly in MV3 service workers, persisting sessions in IndexedDB so they survive worker restarts.
- `signInWithPopup`/`redirect` never work in extension pages; the **offscreen-document** workaround exists for extensions that must run the OAuth dance themselves. ProScan does **not** need it — the dashboard does interactive sign-in.
- If any federated sign-in ever happens inside the extension, add `chrome-extension://bikgignfnljpbmchlemkbbpboigodgap` to Auth's authorized domains.

### Handoff options (replaces REVAMP_PLAN §4 step 2–4)

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Custom-token handoff (recommended)** | Dashboard calls a callable Function → Admin SDK `createCustomToken(uid)` → `chrome.runtime.sendMessage(EXT_ID, {type:'SET_AUTH', token})` → worker: `signInWithCustomToken()` from `firebase/auth/web-extension` | Extension gets its **own refresh token**, persisted in IndexedDB → background alarm flushes work indefinitely without an open tab; all providers supported | Requires Blaze (one tiny Function); custom token must be used within ~1h of minting (fine — it's consumed immediately) |
| B. Raw ID-token + Firestore REST | Dashboard pushes ID token; worker writes via Firestore REST with `Authorization: Bearer` | No Functions, works on Spark | Token dead after ~1h and **cannot be refreshed by the extension** — background sync silently stops; only viable as a stopgap |
| C. Independent OAuth in extension | `chrome.identity.launchWebAuthFlow` → `GoogleAuthProvider.credential()` → `signInWithCredential()` | No server, no dashboard visit needed | Google accounts only; second sign-in UX; consent screen friction |

Pattern A is the well-trodden community pattern for exactly this architecture (e.g. https://gourav.io/blog/firebase-auth-chrome-extension). Recommendation: **A primary, C as the documented fallback** for users who never open the dashboard (matches REVAMP_PLAN open decision #4).

Implementation cautions:

- Keep all the plan's MV3 discipline (top-level listeners, `sender.origin` validation, alarms). Unchanged.
- The plan's "short-lived tokens only, never persist refresh tokens" principle needs a footnote: with option A the **SDK itself** persists a refresh token in the extension's IndexedDB — same trust model as any Firebase web app. Accept it; do not hand-roll token storage on top.
- Known flakiness: `onAuthStateChanged` can hang on worker cold start with IndexedDB persistence (https://github.com/firebase/firebase-js-sdk/issues/8482). Gate the queue flush on `auth.authStateReady()` with a timeout; on timeout, surface "Open dashboard to reconnect".
- Service worker bundle: use `firebase/auth/web-extension` + **`firebase/firestore/lite`** (write-only REST client) — the full Firestore SDK's realtime machinery is dead weight in the worker.

---

## 4. React dashboard stack

### Charting (price-history lines, ~90–400 points per series)

| Library | Size (approx, gz) | Rendering | Fit |
|---|---|---|---|
| **Recharts (recommended)** | ~100 KB+ with deps | SVG | Fastest to production for mixed dashboard charts (lines, bars, sparklines); the de-facto default for React dashboards in 2025–2026 reviews (https://blog.logrocket.com/best-react-chart-libraries-2026/) |
| lightweight-charts (TradingView) | **~45 KB** | Canvas, 60fps on thousands of points | Best-in-class for financial time series; official React tutorial exists (https://www.tradingview.com/lightweight-charts/, https://tradingview.github.io/lightweight-charts/tutorials/react/simple) |
| visx | ~15 KB core, compose-it-yourself | SVG | Smallest, most control, most work — overkill here |
| Chart.js / ECharts | medium/large | Canvas | Only if datasets get dense (100k+ points) — they won't at 90–1,100 points/ASIN |

Recommendation: **Recharts** for v1 (product list sparklines + detail chart + spread histogram all in one API). If the product-detail price chart later needs candlestick/financial styling or multi-year dense series, swap that one component to **lightweight-charts** — it's purpose-built and only 45 KB.

### Product table (1,000+ rows)

**TanStack Table v8 (headless) + TanStack Virtual** for row virtualization — the standard 2025–2026 answer; handles tens of thousands of rows with sorting/filtering intact (https://tanstack.com/table/v8/docs/guide/virtualization, https://tanstack.com/virtual/latest). At only ~200–1,000 products, virtualization is cheap insurance rather than a hard requirement; client-side sorting/filtering over the in-memory `onSnapshot` result is fine — no server-side pagination needed at this scale.

### Firestore → React state

- v1: a small custom hook (`useCollection(query)` wrapping `onSnapshot` with `useEffect` + cleanup) plus React context for auth state. At 200 small product docs per user this is trivially sufficient and adds zero dependencies.
- If caching/retry infra is wanted, **TanStack Query Firebase** (Invertase) is the actively maintained integration (https://github.com/invertase/tanstack-query-firebase) — note its realtime `subscribe` mode has had remount-resubscription bugs (https://github.com/invertase/tanstack-query-firebase/issues/25).
- `react-firebase-hooks` is community/best-effort maintained (https://github.com/CSFrequency/react-firebase-hooks/issues/93) — don't build on it in 2026.
- Cost guardrail: every `onSnapshot` re-attach re-reads matched docs. Mount one listener on the products collection per session; fetch `series/daily` with one-shot `getDoc` on chart open (history doesn't need realtime).

---

## 5. Weekly change-digest: scheduled Functions + email

- **Scheduler:** `onSchedule` from `firebase-functions/v2/scheduler` (https://firebase.google.com/docs/functions/schedule-functions). One weekly job; Cloud Scheduler gives **3 jobs free** per billing account, then $0.10/job/mo (https://cloud.google.com/scheduler/pricing). Blaze required. The job iterates users, reads each user's product docs + last week's series points (~250 reads/user → 1,000 users ≈ 250k reads/week ≈ <$1/mo), writes `users/{uid}/digests/{isoWeek}`, and queues emails.
- **Email — important 2025 fact: SendGrid killed its free tier on 2025-07-26** (https://www.twilio.com/en-us/changelog/sendgrid-free-plan); any plan or tutorial assuming free SendGrid is stale.

| Email option | Free tier (2026) | Integration |
|---|---|---|
| **Resend (recommended)** | 3,000 emails/mo | Direct API call from the digest Function (cleanest), or via SMTP through the Trigger Email extension; React Email templates fit the React stack |
| Trigger Email extension (`firestore-send-email`) | extension free; **you supply SMTP creds**; runs on Functions → Blaze | Write a doc to a `mail` collection, extension sends (https://firebase.google.com/docs/extensions/official/firestore-send-email) |
| Brevo | 300/day | SMTP — pairs with Trigger Email |
| MailerSend | ~3,000/mo + own Firebase extension | https://www.mailersend.com/integrations/firebase |

Recommendation: skip the Trigger Email extension (it adds a queue collection + extension surface you don't need) and call **Resend's API directly from the scheduled Function**. 1,000 weekly digests/mo fits Resend's free tier with room; at 1,000 users (~4,300 emails/mo) the first paid Resend tier (~$20/mo) becomes the largest single line item in the stack — fine, and swappable since it's one `fetch` call.

---

## 6. Decision summary

1. **Data model:** hybrid `products/{asin}` (small) + `series/daily` (one compact, index-exempt history doc) + optional TTL'd `snapshots` + `runs`. Replaces REVAMP_PLAN §3's one-doc-per-scraped-product. Dashboard render = ~200 reads, any chart = +1 read.
2. **Plan:** go Blaze at Phase 4, budget alert at $10/mo; expect ~$0 until hundreds of users, ~$20–40/mo at 1,000 users plus email provider.
3. **Extension auth:** custom-token handoff (callable Function + `signInWithCustomToken` via `firebase/auth/web-extension`, SDK ≥ 10.8.0); `launchWebAuthFlow` Google-only fallback; no offscreen document needed; `firestore/lite` in the worker.
4. **Dashboard:** Vite + React + Recharts + TanStack Table/Virtual + hand-rolled `onSnapshot` hooks (TanStack Query Firebase if caching infra is wanted later).
5. **Digest:** one v2 scheduled Function (free Scheduler slot) → precomputed digest doc → Resend API.
