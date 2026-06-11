# ProScan Product Vision

_Last updated: 2026-06-10 — synthesized from the planning fleet's research (see `docs/research/`)._

## The one-liner

**ProScan is the affordable command center for storefront-sourcing Amazon sellers: a free extension that captures competitor catalogs, and a web platform that remembers, compares, and ranks everything it captures — so the seller's giant Excel workbook can finally die.**

## The problem

Arbitrage and wholesale sellers source by "storefront stalking": find a successful peer seller, mine their catalog, reverse-source the winners, and re-check everything on a cadence. Today that workflow runs on a spreadsheet — one tab per storefront, manual VLOOKUPs to diff this month against last month, conditional formatting for price drops, 30–60 minutes a week of CSV copying, and sheets that break past ~500 SKUs. Sourcing time is the segment's #1 documented pain ("the single largest time-suck"), and spreadsheet staleness is #2 (`docs/research/seller-workflows.md`).

The tools market hasn't solved this; it has *fed* it. Every major tool in the lane — Tactical Arbitrage, Seller Assistant's Seller Spy, SellerAmp — terminates its workflow in an Excel/CSV download (`docs/research/competitor-landscape.md`).

## The market gap (why now)

Three findings from the competitor research define the opening:

1. **Storefront tracking is rare and expensive.** Only three products track a competitor storefront over time — Seller Spy (gated to Seller Assistant's $79.99/mo Business tier), Storefront Stalker Pro ($60/mo for just 10 storefronts), and SellerSprite ($79/mo, 60-day window). **There is no storefront-tracking offering under ~$60/mo.** The rest of the market is $8–30/mo single-product analyzers. That leaves a clear $15–29/mo gap for an integrated product.
2. **The 2025–26 repricing wave created churn-shoppers.** Helium 10 killed its $39 Starter plan (entry now $99–129/mo), SellerAmp and ScanUnlimited raised prices, and Tactical Arbitrage is being forced into the $69/mo Seller 365 bundle. Sellers are actively shopping for cheaper consolidations — a serious OA seller already pays $100–300/mo across tools.
3. **ProScan has a structural cost advantage.** Competitors scrape server-side, paying for proxies and Keepa API tokens — COGS that force $60+/mo pricing and 10–40 storefront caps. ProScan scrapes in the user's own browser session at near-zero marginal cost. A genuinely generous free tier is a *structural* advantage here, not a promo.

## The moat

ProScan's defensible asset is **the user's own longitudinal dataset**. Keepa owns years of per-ASIN price history and we will never out-history Keepa — so we don't try (we deep-link to Keepa instead). What no one owns is *this seller's* tracked storefronts, scrape runs, deltas, verdicts, and lead lifecycle. Every scrape makes ProScan more valuable and more painful to cancel. History depth is therefore both the moat and the natural paid gate.

The honest corollary: month-over-month value only materializes after 1–2 months of scraping. **Day-one value must come from what no other tool computes at all** — per-ASIN price-spread statistics (CV/IQR across competing sellers), catalog-wide Opportunity/Arbitrage scoring, and an actionable Max Buy Price — while the history accrues.

## Who it's for

Three personas, detailed in `personas.md`:

- **First-Flip Felix** — brand-new OA seller, won't pay for Helium 10, needs guardrails and quick wins. Acquisition engine.
- **Storefront-Stalker Sarah** — established seller ($20–50k/mo) maintaining 30–60 competitor storefronts in a workbook. **The design center.** Her workbook is what we replace.
- **Operator Omar** — high-volume operation with VAs; needs process: triage queues, dedup, bulk actions, exports. Expansion revenue.

## Product principles

1. **Never paywall or remove what the extension does free today.** The extension stays free forever; the *platform* (history depth, tracked storefronts, alerts, dashboard exports) is the paid surface.
2. **Useful from the first scrape.** Spread stats, scores, and Max Buy Price work with zero history; the delta board lights up on scrape #2.
3. **Deterministic explanations first, AI garnish later.** Every verdict shows the rule that fired ("FAIL: 14 FBA sellers > your max 10"); LLM narrative ships only after the deterministic engines work (see the AI Narrative layer, parked in `feature-catalog.md`).
4. **Private leads.** Shared lead lists saturate and tank prices (why they cap seats at 22–44 and charge $99–998/mo). ProScan data is per-user by construction — that privacy is a selling point.
5. **Excel export is retention insurance, not legacy.** Sellers hand spreadsheets to VAs, prep centers, and accountants. Clean XLSX out remains first-class forever.
6. **Transparent billing.** Billing/cancellation friction is the #1 reputation killer across competitor reviews. Self-serve Stripe portal cancellation from day one of monetization.
7. **Stay inside Amazon's lines.** User-initiated, in-browser capture only; `chrome.alarms` flushes our queue to Firestore, never fetches Amazon in the background; no Seller Central, no credentials, no proxying Amazon traffic through our servers (Amazon Agent Policy, effective 2026-03-04 — see `docs/research/monetization-and-positioning.md`).

## Positioning statement

For Amazon arbitrage and wholesale sellers who source from competitor storefronts, **ProScan is the only tool under $20/mo that captures whole storefronts, tracks them month over month, and ranks what to buy** — unlike Tactical Arbitrage (no memory between scans), Seller Spy ($79.99/mo tier), and Keepa (single-ASIN depth, no storefront diffing) — and it works *with* Keepa, not against it.

## Monetization (summary — full analysis in `docs/research/monetization-and-positioning.md`)

- **Free forever:** everything the extension does today, plus a starter platform slice (2 tracked storefronts, 30-day history).
- **Pro at $14.99/mo or $119/yr (Ladder A, pending decision D3):** unlimited storefronts, full history depth, alerts + weekly digest, dashboard bulk exports. Deliberately undercuts SellerAmp's $19.95 entry while the longitudinal dataset matures.
- 14-day cancel-anytime trial; Stripe Checkout + customer portal; ~3.4–3.7% payment cost.
- The weekly digest email is the conversion surface; history depth is the retention lock.

## North-star metric

**Weekly synced scrape runs per active user.** It captures the whole loop: the extension is being used (capture), data is reaching the platform (sync), and the cadence habit that the digest and rescan queue reinforce (retention). Secondary: storefronts on watchlists; leads promoted to buy-list per week (proof of decisions made in-product, not in Excel).

## Strategic risks (eyes open)

| Risk | Mitigation |
|---|---|
| **Seller Assistant down-tiers Seller Spy** — it's shipping fast in exactly this direction | Speed + price + the spread/scoring features they lack; our free tier is structurally cheaper than their server-side COGS allows |
| **Keepa's history moat makes our MoM story look thin at first** | Day-one value from spread stats + scores; Keepa deep-links instead of competition; Excel Workbook Import (v2) seeds baselines instantly |
| **Sales-velocity estimates are table stakes we lack** (no BSR capture yet) | Review-velocity proxy now; category-aware BSR via PDP fetch deliberately deferred (decision D7) until offer-fetcher's jittered pattern proves uneventful |
| **Amazon policy tightening (Agent Policy 2026)** | Principle 7 above; positioning language follows incumbents ("research/analytics, user-initiated") |
| **Chrome Web Store review friction on the sync release** | Release-engineering plan in `docs/architecture/platform-architecture.md`: staged rollout, privacy policy first, liabilities (shared Gemini key, CDN font) removed pre-submission |
