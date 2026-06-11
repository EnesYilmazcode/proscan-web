# ProScan Planning Docs — Index

_Produced 2026-06-09/10 by a 20-agent planning fleet (recon, web research, persona ideation, architecture synthesis, adversarial critique) plus owner-facing synthesis. ~58 raw feature ideas → 34 tiered features → milestone roadmap._

## Read in this order

| # | Doc | What it answers |
|---|---|---|
| 1 | [`product/vision.md`](product/vision.md) | Why this product, the market gap, the moat, principles, positioning, north star |
| 2 | [`product/personas.md`](product/personas.md) | Who it's for: Felix (acquisition), **Sarah (design center)**, Omar (expansion) |
| 3 | [`product/feature-catalog.md`](product/feature-catalog.md) | All 34 features, scored and tiered (MVP / v1 / v2 / later / rejected) + prerequisites |
| 4 | [`ROADMAP.md`](ROADMAP.md) | Milestones M0–M7, parallelization, the two Chrome Web Store batches |
| 5 | [`TASKS.md`](TASKS.md) | **Who does what** — autonomous work vs. ~15 min of owner actions vs. decisions |
| 6 | [`decisions.md`](decisions.md) | The 11 owner decisions, each with a default ("defaults, except…" unblocks all) |

## Architecture (the build contract)

| Doc | Contents |
|---|---|
| [`architecture/platform-architecture.md`](architecture/platform-architecture.md) | Full system design: auth handoff (custom-token callable), sync queue, hosting layout, extension build pipeline, emulator/staging strategy, CWS release engineering, backups |
| [`architecture/data-model.md`](architecture/data-model.md) | Definitive Firestore schema: `workspaces/{wid}` tree, ASIN-keyed products + date-keyed history docs, security rules, indexes, **authoritative cost model** (§7), retention/TTL, quota enforcement |

## Research (the evidence)

| Doc | Contents |
|---|---|
| [`research/extension-audit.md`](research/extension-audit.md) | Code-level audit of the extension: what it captures, what it could capture for free, reusable assets, 22 debt items, installed-base addendum (233 users, 4.9★) |
| [`research/website-firebase-state.md`](research/website-firebase-state.md) | Verified repo + Firebase project state; the exists / agent-can-do / owner-must-do readiness table |
| [`research/competitor-landscape.md`](research/competitor-landscape.md) | 13+ tools profiled; the finding: **no storefront tracking exists under ~$60/mo** |
| [`research/seller-workflows.md`](research/seller-workflows.md) | How sellers actually work: storefront stalking, buy thresholds, the Excel artifact's exact schema, re-check cadences, pain points |
| [`research/technical-firebase.md`](research/technical-firebase.md) | 2026 Firebase facts: the auth-handoff correction, time-series modeling, pricing/quotas, dashboard stack picks |
| [`research/monetization-and-positioning.md`](research/monetization-and-positioning.md) | Pricing ladders, Stripe path, Amazon ToS/Agent Policy posture, CWS compliance, trust checklist |

## Root-level docs (predate the fleet; still canonical for what they cover)

- [`../CONTEXT.md`](../CONTEXT.md) — precise current-state reference for both repos
- [`../REVAMP_PLAN.md`](../REVAMP_PLAN.md) — the original forward plan; §§2–4 now carry SUPERSEDED banners pointing into `architecture/`

## The five load-bearing conclusions

1. **The market gap is real and time-limited:** only three tools track competitor storefronts over time, none under ~$60/mo, all delivering analysis as Excel downloads — and ProScan's client-side scraping makes a generous free tier structurally affordable. Seller Assistant is the threat to outrun.
2. **The original auth plan was unbuildable:** a pushed raw ID token can't initialize or refresh an extension SDK session. The fix (one `mintExtensionToken` callable + `signInWithCustomToken`) works — and means **Blaze** (still ~$0/mo expected).
3. **The original data model was unaffordable at dashboard scale:** one-doc-per-scrape made a 90-day × 200-product render ~18,000 reads. The final model (ASIN-keyed docs + compact history maps + extension-stamped deltas) does it in ~400, and Movers in ~100.
4. **The extension needs surgery before the first cloud write:** no run identity, string prices, no dedup, spread-math bugs — plus a live incident: a **shared hardcoded Gemini API key** ships to all users (the claimed BYO-key UI doesn't exist). Owner action B4 + decision D4.
5. **MVP is six features, not twenty:** auth/sync, run inbox, delta board + history drawer, spread + Max Buy Price, storefront watchlist, XLSX export. After two scrapes of one storefront, that already beats the workbook competitors charge $60–80/mo to replace.
