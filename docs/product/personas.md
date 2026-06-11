# ProScan Personas

_Last updated: 2026-06-10 — grounded in `docs/research/seller-workflows.md` and the ideation passes behind `feature-catalog.md`._

Three buyer personas, in order of strategic priority. A fourth ideation lens (blue-sky/AI) was used during planning but is a feature layer, not a person.

---

## 1. Storefront-Stalker Sarah — the design center

**Profile.** Established OA/wholesale seller, $20–50k/mo revenue, 2–4 years in. Pays for Keepa (€19/mo) and SellerAmp (~$20–50/mo); canceled Tactical Arbitrage during the Seller 365 forced-bundle migration. Works ~30 hours/week, half of it sourcing.

**Workflow today.** Maintains a list of 30–60 competitor storefronts (arbitrage peers: 100–200 feedback, <1,000 mixed-category items). Re-mines them weekly-to-monthly: export/copy each storefront's catalog, paste into the workbook tab, VLOOKUP against last month's tab, conditional-format the price drops, eyeball the new ASINs, reverse-source survivors. The workbook has one tab per storefront and breaks somewhere past ~500 SKUs per tab.

**Pains.** The VLOOKUP diff ritual (30–60 min/week of pure data plumbing); not knowing *which* storefronts are still worth the cadence; missing the window on price drops because she only looks monthly; the workbook telling her nothing about rating/review changes, which she'd act on if she saw them.

**Buying criteria she gates on** (from the thresholds research): ≥30% ROI, ≥$5/unit profit, BSR in roughly the top 1–3% of category, <10 FBA sellers, no Amazon on the listing.

**What wins her, by milestone.**
- *MVP:* Storefront Watchlist (her tabs, as an entity), Delta Board ("what changed since last month" as a screen, not a formula), History Drawer sparklines, XLSX export for her VA.
- *v1:* Run-to-Run Storefront Diff (the literal VLOOKUP killer), Rules Engine with her thresholds, Review-Velocity signals (data she's never had), Rescan Queue ("StoreB — 9 days overdue").
- *v2:* Change Alerts + Weekly Digest (the pull-back-in loop), What Changed home feed, Storefront Scorecards ("which of my 60 stores still deserve weekly cadence"), Excel Workbook Import (10-minute onboarding instead of 30 days of accrual).

**Willingness to pay:** already spends $100–300/mo across tools; $14.99/mo is an easy consolidation add if it kills the workbook ritual. She is the Pro conversion.

---

## 2. First-Flip Felix — the acquisition engine

**Profile.** Started OA four months ago after YouTube; 0–20 products live; budget-anxious (balked at Helium 10's $129 entry, installs everything free). Sources evenings and weekends.

**Workflow today.** Follows guru storefront-stalking tutorials, scrapes or hand-copies listings, stares at 500 rows wondering which three matter. No system: a messy sheet, browser tabs, gut feel. Doesn't know the category-BSR norms yet, overweights price and rating because that's what he can see.

**Pains.** Decision paralysis ("which of these is actually worth my time?"); fear of bad buys (Amazon on the listing, saturated offers); not knowing what a *good* storefront to mine even looks like; an hour of browsing per usable lead.

**What wins him, by milestone.**
- *MVP:* free cloud sync (his data stops being disposable), Spread & Max Buy Price ("buy below $13.10 for 30% ROI" — one number instead of statistics), Opportunity-score sorting of a 500-row scrape.
- *v1:* Rules Engine beginner presets ("Cautious first flip"), red-flag badges ("Amazon sells this", "Crowded: 14 FBA sellers" with the unit-share math), Reverse-Source Links (attacks his #1 time cost), Seller Discovery (who to stalk next).
- *v2:* First Scrape Wizard, the weekly digest as his habit loop.

**Willingness to pay:** $0 today — and that's fine. Felix is top-of-funnel: he reviews the extension, evangelizes in communities, and becomes Sarah in 12–18 months. The free tier exists for him; clawing back free features would burn this engine (product principle 1).

---

## 3. Operator Omar — expansion revenue

**Profile.** Runs arbitrage as a business: mid-six-figure revenue, 2 VAs on triage and purchasing, hundreds of evaluations a week across many storefronts and lead sources.

**Workflow today.** Bulk scrape sessions; a master sheet merged from many exports; VAs work rows by color code; constant duplicate effort ("didn't we already reject this ASIN in March?"); export-import round-trips between his sheet, his prep center's sheet, and his accountant's.

**Pains.** Process, not discovery: dedup across months of scrapes; knowing who evaluated what and why it was rejected; handing VAs a clean queue instead of a 2,000-row sheet; data hygiene (duplicate runs, stale spread numbers, sponsored-listing pollution).

**What wins him, by milestone.**
- *MVP:* Scrape Run Inbox ("X new / Y already seen" — dedup against history at ingest), watchlist tags, FBA-Lead-List-format export (drops into his existing downstream process unchanged).
- *v1:* Lead Lifecycle Pipeline (New → Reviewing → Approved → Purchased, with rejection reasons and notes — the master sheet, killed), Tags + Bulk Actions, Saved Views as VA queues ("Maria's queue: green + reviewing").
- *v2:* Already-Evaluated ASIN Ledger ("Seen 3× — last rejected 2026-04-12"), Re-Check Due Queue (the 30–60-day replen audit as process, not discipline), Data Hygiene Center.
- *Later:* VA Seats & Shared Workspace — the B2B fork. Parked, but the `workspaces/{wid}` data-model root is designed for it now so it's a security-rules change, not a migration (see `docs/architecture/data-model.md`).

**Willingness to pay:** the least price-sensitive; will pay for seats when they exist. Until then he's a Pro subscriber whose feature requests forecast the team tier.

---

## Anti-personas (explicitly not designing for)

- **Private-label brand builders** — they need keyword/PPC research (Helium 10's and Jungle Scout's actual lane), not storefront tracking.
- **Repricer users seeking automation** — repricing, fee-exact profit math (SP-API), and inventory sync are mature adjacent markets the research flagged as not worth entering (`docs/research/seller-workflows.md`).
- **Data resellers / lead-list vendors** — bulk redistribution of scraped data invites the exact Amazon-policy exposure product principle 7 avoids, and shared leads destroy the private-leads value prop.
