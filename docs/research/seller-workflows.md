# How Amazon Resellers Actually Work in 2025–2026: Workflows, Buying Criteria, and the Excel Problem

_Last updated: 2026-06-09 — produced by the planning fleet._

Scope: online arbitrage (OA), retail arbitrage (RA), used/collectible flipping, and small wholesale sellers — the people ProScan's extension already serves with storefront/search scraping. Sources are 2024–2026 seller blogs, tool-vendor sites (cross-checked for pricing), and seller-community material. Reddit could not be fetched directly (reddit.com blocks the crawler), so community evidence comes via seller blogs, YouTube sourcing sessions, and lead-list vendors who serve those communities.

---

## 1. Seller segments at a glance

| Segment | Where they source | Where they sell | Catalog size | Re-buy behavior |
|---|---|---|---|---|
| Online arbitrage (OA) | Retail websites (Walmart, Target, Kohl's, clearance/coupon stacking) | Amazon FBA, mostly existing listings | 50–500+ ASINs | High — "replens" are the goal |
| Retail arbitrage (RA) | Physical stores, clearance aisles | Amazon FBA | Similar, churnier | Medium — store stock is unpredictable |
| Used/collectible flippers | Thrift, library sales, estate sales | Amazon (books), eBay (collectibles — Amazon collectibles category is gated) | Long-tail, one-off units | Low — every unit is unique |
| Small wholesale | Distributor/brand price lists (CSV/XLSX) | Amazon FBA | 100s–1000s of SKUs per list scan | High — reorder POs |

All four segments converge on the same decision question per ASIN: **"If I buy at cost X, will it sell at price Y, fast enough, with acceptable risk?"** — and all four currently externalize that decision into spreadsheets.

---

## 2. Canonical workflows, step by step

### 2.1 Storefront stalking / reverse sourcing (the workflow ProScan sits in)

This is the highest-relevance workflow: find a competitor who is already winning, mine their catalog, and source the same products. It is widely documented as a standard 2025–2026 method ([Stealth Seller blog](https://stealthseller.co/blog/everything-on-storefront-stalking-as-a-arbitrage-seller), [Fast Track FBA](https://fasttrackfba.com/blog/b/my-top-2-amazon-online-arbitrage-sourcing-methods), [BowTied Slinger guide](https://www.bowtiedslinger.com/p/guide-amazon-storefront-stalking), [Clear The Shelf](https://cleartheshelf.com/storefront-stalker-pro/)).

1. **Find a seed product.** Start from a product you already sell or know flips well, with at least ~3 other FBA sellers on the listing (Fast Track FBA).
2. **Identify a good competitor storefront.** Hover the FBA offers, open seller profiles. Ideal target per Fast Track FBA: review counts of roughly **100–200** (big enough to be real, small enough to be an arbitrage peer, not a brand or mega-wholesaler). Stealth Seller adds: a good target has "a mix of products and [is] not all into one specific category," typically **under 1,000 items**; avoid accounts with a "huge inventory of one brand" (those are wholesale/PL, not sourceable at retail).
3. **Capture the storefront ID.** The seller ID is the token after `me=` in the storefront URL ([Clear The Shelf](https://cleartheshelf.com/storefront-stalker-pro/)).
4. **Extract the catalog.** Either page through the storefront manually (what ProScan's scraper automates today), or feed seller IDs into Keepa Product Finder, which "can stalk multiple Amazon storefronts at a time" and break a seller's catalog down by category ([Clear The Shelf](https://cleartheshelf.com/storefront-stalker-pro/), [George's blog](https://georges.blog/feed/discover-the-perfect-amazon-storefront-for-your-business-using-keepa-product-finder), [YouTube tutorial](https://www.youtube.com/watch?v=bHPXDIS6rDE)).
5. **Filter the extracted ASINs** by sales rank, price movement, and competition — e.g. Keepa filters like "30-day average BSR under 1,000 AND current BSR under 5,000" or "price increased 25–50% in 30 days" ([Clear The Shelf](https://cleartheshelf.com/storefront-stalker-pro/)).
6. **Reverse-source each survivor:** Google the product / search retail sites to find where the competitor is buying it cheaper, verify the exact variant matches (size, count, edition), then run the profit calc.
7. **Validate with Keepa history** (rank drops = sales, price stability, offer-count trend) and check eligibility/gating/IP before buying.
8. **Save survivors to a buy list** (today: a Google Sheet) and purchase.

Key nuance from BowTied Slinger: storefront stalking "works really well for finding replenishables (products you can source repeatedly) and wholesale products. Not so much for 'hot' products with inflated prices because by the time you source it, price will probably have crashed or you missed the sale" ([source](https://www.bowtiedslinger.com/p/guide-amazon-storefront-stalking)). The value is in durable, repeatable ASINs — which is exactly a tracking/history problem, not a one-shot scrape problem.

A dedicated SaaS micro-market now exists around this workflow: [Arbitrage Stalker](https://arbitragestalker.com/) (monitors competitor storefronts in near-real-time, "auto-filter by BSR, ROI %, margin, and brand," anti-saturation controls that "hide anything 3 or more of your sellers already have," Discord/Slack/Telegram alerts; $19–$159/mo), [Stealth Seller](https://stealthseller.co/storefront-stalker) (alerts on new listings in stalked storefronts), and [Seller Spy by Seller Assistant](https://www.sellerassistant.app/tools/seller-spy) (daily diff of up to 3 tracked sellers — what they added/dropped and price changes — exported as .xls). These are the closest competitors to where ProScan is heading.

### 2.2 The daily OA sourcing session

Documented across [SellerAmp's sourcing guide](https://selleramp.com/news/2024-complete-sourcing-guide-for-amazon-online-arbitrage/), [Aura's OA guide](https://goaura.com/blog/online-arbitrage-guide), [OABeans](https://oabeans.com/criteria-to-choose-an-online-arbitrage-profitable-lead/), and lead-list vendors:

1. **Morning lead intake.** Sellers on paid lead lists "check a spreadsheet filled with profitable leads" delivered every weekday morning ([FBA Lead List](https://www.fbaleadlist.com/)); each lead row carries ~17 data points (title, store URL, coupon codes, Amazon URL, reviews, variations, ASIN, rank, category, Amazon price, buy price, net profit…).
2. **Manual sourcing blocks.** Browse retailer clearance/sale pages, or run automated scans (Tactical Arbitrage scans 1,400+ retail sites and matches to ASINs; reverse search starts from an ASIN and finds the retailer — [Tactical Arbitrage](https://tacticalarbitrage.com/)). Manual sourcing productivity is poor: OABeans notes people can "spend hours a day browsing online websites … and not find even one product per hour" ([OABeans](https://oabeans.com/)).
3. **Per-ASIN vetting in a side-panel tool.** SellerAmp SAS / Seller Assistant overlay profit calc (fees, ROI, profit), eligibility + IP alerts, Keepa-style charts, Buy Box analysis, and estimated monthly sales on the Amazon page; alerts use a stoplight format ([SellerAmp features](https://selleramp.com/features/)).
4. **Buy + log.** Survivors go into a buy-list spreadsheet with quantity, order #, cost, expected sell price, ROI, rank, seller count ([template column list](https://www.fbaleadlist.com/what-is-an-online-arbitrage-sourcing-list-plus-free-inventory-template)). Many sellers batch: "buy on one day per week and use a prep service to cut down on hours" ([FBA Lead List](https://www.fbaleadlist.com/)).
5. **Prep/ship → list → reprice.** Inventory goes to FBA (often via prep center), gets listed on the existing ASIN, and a repricer (Aura, BQool, Informed) manages Buy Box competition from then on ([Aura guide](https://goaura.com/blog/online-arbitrage-guide)).

### 2.3 Retail arbitrage (in-store)

Same decision logic, compressed to seconds: scan barcode with Amazon Seller App / Scoutify / SellerAmp mobile, read profit + rank + eligibility on the spot, fill the cart ([Jungle Scout RA guide](https://www.junglescout.com/resources/articles/amazon-retail-arbitrage/), [Threecolts RA guide](https://www.threecolts.com/blog/complete-guide-to-amazon-retail-arbitrage/)). The common velocity rule cited by Jungle Scout: estimate **your** share as monthly sales ÷ number of FBA sellers (e.g. 5,000/22 ≈ 227 units/mo) before deciding quantity.

### 2.4 Used book / collectible flipping

- Hardware-first workflow: smartphone + Bluetooth barcode scanner + ScoutIQ lets sellers "evaluate 5–10 books per minute"; ScoutIQ's **eScore** measures demand — "a book with an eScore of 150+ has sold almost daily, while one under 10 rarely sells" ([Side Hustle Nation](https://www.sidehustlenation.com/flipping-books/)).
- Decisions are encoded as **triggers** (accept/reject rules combining eScore, rank, profit) so a human doesn't re-derive criteria per item ([The Book Flipper](https://www.thebookflipper.com/post/reviews-of-three-book-scouting-apps)).
- Collectibles on Amazon are gated (fine art, collectible coins, sports collectibles); most collectible flipping happens on eBay, with spreadsheets tracking cost basis per unique unit ([Threecolts books guide](https://www.threecolts.com/blog/how-to-sell-books-on-amazon/)).
- Takeaway for ProScan: this segment's core innovation — pre-encoded buy *triggers* evaluated automatically — is exactly what OA sellers do manually in spreadsheets.

### 2.5 Small wholesale price-list scanning

"Scan supplier catalog" = turn a raw price list (UPC/EAN, cost, title) into "matched ASINs, true profitability, sales velocity, competition, restrictions, and risk flags" ([Seller Assistant](https://www.sellerassistant.app/blog/how-to-scan-supplier-catalog-bulk-amazon-product-analytics)). Tools: Seller Assistant Price List Analyzer (70+ metrics/row), Scan Unlimited, Analyzer.Tools; bulk restriction checkers handle up to 20,000 ASINs at once ([Seller Assistant Bulk Restriction Checker](https://www.sellerassistant.app/blog/how-to-use-seller-assistants-bulk-restriction-checker)). Wholesale sellers also storefront-stalk to *discover brands* worth opening accounts with ([Tactical Arbitrage wholesale plan](https://tacticalarbitrage.com/)).

### 2.6 The recurring loop (what happens after the first buy)

1. **Reprice continuously** (automated repricers; manual repricing is considered obsolete).
2. **Track sell-through**: Aura's "30-day rule — if no sales after a month, reassess pricing"; plan purchases to clear within 90 days ([Aura guide](https://goaura.com/blog/online-arbitrage-guide)).
3. **Restock replens**: "Buy a replen, send it in, sell it, get a disbursement, buy that replen again" ([Full-Time FBA](https://www.fulltimefba.com/the-power-of-selling-replenishable-inventory-on-amazon-fba/)).
4. **Audit replens every 30–60 days**: "Check your numbers every 30–60 days: adjust your min/max pricing, renegotiate with suppliers, or swap in an alternative SKU if the math stops working," because "replens can lose their edge if fees creep up or competitors drive down prices" ([FBA Lead List](https://www.fbaleadlist.com/how-to-keep-your-amazon-online-arbitrage-replens-profitable-month-after-month/)).

---

## 3. Buying criteria and typical thresholds

Numbers below are the ranges sellers actually cite, not single truths — every guide stresses customizing thresholds. ProScan should treat these as **user-configurable defaults**.

| Metric | Typical threshold(s) | Notes / source |
|---|---|---|
| ROI after all fees | 10% absolute floor; 20% common; **30% the most-cited target**; beginners told 15–30% min | [OABeans](https://oabeans.com/criteria-to-choose-an-online-arbitrage-profitable-lead/), [Aura: "$3 profit or 30% ROI"](https://goaura.com/blog/online-arbitrage-guide), [Threecolts](https://www.threecolts.com/blog/online-arbitrage-for-beginners-getting-started/) |
| Profit per unit | $3 minimum; $3.50 cited as floor; **$5–$10 preferred** | [OABeans](https://oabeans.com/criteria-to-choose-an-online-arbitrage-profitable-lead/), [Aura](https://goaura.com/blog/online-arbitrage-guide); FBA Lead List vets leads at ≥$5 profit |
| Net margin | 10–15% typical realized; 40%+ gross margin for aggressive sourcing | [Aura](https://goaura.com/blog/online-arbitrage-guide), [Seller Sprite](https://www.sellersprite.com/en/blog/how-to-start-online-arbitrage-amazon-2025) |
| Estimated monthly sales | ≥15–20 sales/mo minimum to bother | [OABeans](https://oabeans.com/criteria-to-choose-an-online-arbitrage-profitable-lead/); FBA Lead List leads sell ≥15×/mo |
| BSR (absolute) | Beginners: under 30,000; broader rule: "under 100k in its category"; aggressive: under 15k | [Threecolts](https://www.threecolts.com/blog/online-arbitrage-for-beginners-getting-started/), [Aura](https://goaura.com/blog/online-arbitrage-guide) |
| BSR (relative) | "Top 1–3% of category" is the more defensible framing; monthly percentile charts published by [Full-Time FBA](https://www.fulltimefba.com/monthly-updated-sales-rank-chart/) and [SellerAmp](https://sas.selleramp.com/sas/bsr-tables?domain_id=1) | Percentile cutoffs vary wildly by category (see §4) |
| Sales velocity (Keepa) | Count rank **drops** as sales; e.g. 23 drops/90d ≈ 8 sales/mo; zoom to 12-month view | [Clear The Shelf Keepa guide](https://cleartheshelf.com/how-to-read-a-keepa-chart/), [Full-Time FBA](https://www.fulltimefba.com/read-understand-keepa-graphs/); Keepa undercounts low-traffic ASINs |
| Number of FBA sellers | Beginners: fewer than ~10 FBA offers; reverse-sourcing viability signal: **3–8+ FBA sellers** proves the listing tolerates arbitrageurs; too many = price war | [Threecolts](https://www.threecolts.com/blog/online-arbitrage-for-beginners-getting-started/), [Fast Track FBA](https://fasttrackfba.com/blog/b/my-top-2-amazon-online-arbitrage-sourcing-methods) |
| Expected unit share | monthly sales ÷ (number of FBA sellers) — e.g. 5,000/22 ≈ 227/mo | [Jungle Scout](https://www.junglescout.com/resources/articles/amazon-retail-arbitrage/); some sellers use sellers+1 |
| Amazon on the listing | Mostly disqualifying: "avoid products with Amazon sellers because they tend to give themselves the buy box" | [Threecolts RA guide](https://www.threecolts.com/blog/complete-guide-to-amazon-retail-arbitrage/), [Full-Time FBA](https://www.fulltimefba.com/two-best-retail-arbitrage-sourcing-strategies/) |
| Buy Box behavior | Check BB rotation among FBA sellers and "Amazon in BB %"; stable BB price ≥ target sell price | [Seller Assistant](https://www.sellerassistant.app/blog/how-to-scan-supplier-catalog-bulk-amazon-product-analytics), [SellerAmp features](https://selleramp.com/features/) |
| Price history stability | Avoid leads priced off a recent spike; verify against 90-day/12-month Keepa average | [OABeans](https://oabeans.com/criteria-to-choose-an-online-arbitrage-profitable-lead/) |
| Competition depth | Avoid when competitor stock dwarfs demand (e.g. competitors hold 1,000 units vs 100 sales/mo) | [OABeans](https://oabeans.com/analyze-the-competition-for-oa-lead/) |
| IP / gating / hazmat | Hard gate: check selling eligibility per ASIN, IP-complaint history per brand, hazmat/meltable flags **before** buying | [Seller Assistant IP Alert](https://www.sellerassistant.app/features/ip-alert/), [Aura](https://goaura.com/blog/online-arbitrage-guide) |
| Sell-through window | Buy only what clears in ~90 days; reassess price if no sale in 30 days | [Aura](https://goaura.com/blog/online-arbitrage-guide) |
| Book demand (ScoutIQ) | eScore 150+ = sells ~daily; under 10 = rarely sells | [Side Hustle Nation](https://www.sidehustlenation.com/flipping-books/) |

Risk context worsening through 2026: Amazon keeps expanding brand gating, and trademark-troll entities "mass-register trademarks or buy small brands for the sole purpose of filing IP complaints" against resellers ([The Selling Guys gated-brands list](https://www.thesellingguys.com/current-list-of-amazon-gated-and-restricted-brands/), [OABeans IP cheat sheet](https://oabeans.com/ip-complaint-on-amazon/), [SellerApp](https://www.sellerapp.com/blog/amazon-ip-complaint/)). Per-brand risk flags are now table stakes in vetting tools.

---

## 4. BSR percentile reference (US, per Clear The Shelf, Nov 2024 data)

"Top 1%" cutoffs differ by ~75x across categories, which is why a single absolute BSR threshold misleads. Sample from [Clear The Shelf's chart](https://cleartheshelf.com/amazon-sales-rank-chart/) (updated regularly; [Full-Time FBA](https://www.fulltimefba.com/monthly-updated-sales-rank-chart/) publishes a monthly equivalent):

| Category | Top 1% BSR | Top 3% BSR |
|---|---|---|
| Grocery & Gourmet Food | 38,239 | 114,717 |
| Toys & Games | 90,720 | 272,159 |
| Health & Household | 108,760 | 326,281 |
| Beauty & Personal Care | 144,903 | 434,709 |
| Electronics | 262,145 | 786,435 |
| Books | 1,060,064 | 3,180,192 |
| Home & Kitchen | 1,660,470 | 4,981,411 |

Caveat from the same source: percentile charts are "a guide not gospel" — rank weights recent sales and updates hourly; Keepa drop-counting is the better velocity signal. Implication for ProScan: a category-aware rank-percentile lookup is cheap to ship and immediately more credible than raw BSR or the current price/rating-based Opportunity Score.

---

## 5. How leads are managed today

**The artifact is a spreadsheet.** The canonical OA sourcing list columns, per [FBA Lead List's free template](https://www.fbaleadlist.com/what-is-an-online-arbitrage-sourcing-list-plus-free-inventory-template): Product Name, Retailer, Retailer Link, Amazon Link (ASIN), Buy Price, Sell Price, Net Profit, ROI, 90-Day Average Rank, Current Rank, Category, # of FBA Sellers, Deal/Discount Codes, Deal Expiration Date, Source Notes — plus buyer-side Quantity, Order #, Notes. Sold templates add auto-generated Keepa graph links and ROI calculators ([OA Challenge template](https://oachallenge.gumroad.com/l/oa-leads-template), [Southern Mom Flair](https://southernmomflair.com/product/oa-sourcing-spreadsheet-lite-version/)). This column set is effectively the schema ProScan's per-user product records need to cover or import.

**Paid lead lists are a spreadsheet-subscription business.** Sellers pay $99–$998/mo for daily lead rows; vendors cap subscribers (FBA Lead List: 22 or 44 per list; OABeans: ~25 per list) explicitly to stop subscribers from tanking prices on shared leads ([OABeans](https://oabeans.com/), [FBA Lead List](https://www.fbaleadlist.com/), [Why lead lists will matter in 2026](https://www.fbaleadlist.com/why-amazon-online-arbitrage-lead-lists-will-be-valuable-in-2026/)).

**The tool stack and what it costs** (verified against vendor sites where possible):

| Tool | Role in workflow | Price (2025–2026) |
|---|---|---|
| [Keepa](https://keepa.com/) | Price/rank/offer history, Product Finder, storefront queries | €19/mo or €189/yr |
| [SellerAmp SAS](https://selleramp.com/pricing/) | Per-ASIN vetting panel (profit, eligibility, IP alerts, BB analysis) | $19.95 / $29.95 / $49.95 per mo (increase June 2025) |
| [Seller Assistant](https://www.sellerassistant.app/) | Vetting + IP Alert + bulk price-list scanning + Seller Spy | tiered; IP-Alert lookup free |
| [Tactical Arbitrage](https://tacticalarbitrage.com/) | Automated retail-site scanning, reverse search, storefront stalk | $69–$159/mo |
| [Arbitrage Stalker](https://arbitragestalker.com/) | Real-time storefront monitoring + lead scoring + alerts | $19 / $39 / $159 per mo |
| [ScoutIQ](https://www.sidehustlenation.com/flipping-books/) | Book scanning with triggers/eScore | ~$44/mo |
| Repricers (Aura, BQool, Informed) | Post-purchase Buy Box management | ~$27–$100+/mo |

A serious OA seller's software bill is commonly $100–$300/mo across 3–5 subscriptions — relevant to ProScan pricing headroom.

---

## 6. What sellers re-check on a recurring basis

| Cadence | Check | Why |
|---|---|---|
| Continuous (automated) | Buy Box price vs. min/max | Repricer territory; not ProScan's fight |
| Daily–weekly | New listings added/dropped by stalked competitor storefronts | This is the Arbitrage Stalker / Seller Spy / Stealth Seller niche — restock detection "< 90s" is a selling point ([Arbitrage Stalker](https://arbitragestalker.com/)) |
| Weekly | Sell-through vs. plan; leads whose deal/coupon expired | 30-day no-sale rule; deal expiration is a template column |
| Monthly / 30–60 days | Replen economics: current BB price vs. my cost, fee changes, offer count growth, rank trend | "Check your numbers every 30–60 days… swap in an alternative SKU if the math stops working" ([FBA Lead List](https://www.fbaleadlist.com/how-to-keep-your-amazon-online-arbitrage-replens-profitable-month-after-month/)) |
| Monthly | Category BSR percentile chart refresh | Full-Time FBA republishes monthly ([source](https://www.fulltimefba.com/monthly-updated-sales-rank-chart/)) |
| Quarterly | Aged inventory vs. long-term storage fee dates; gated-brand list changes | [Aura](https://goaura.com/blog/online-arbitrage-guide); [The Selling Guys gated list](https://www.thesellingguys.com/current-list-of-amazon-gated-and-restricted-brands/) |

The month-over-month deltas the owner wants ProScan to track (price, rating, review count, seller count per ASIN) map directly onto the monthly replen audit and the storefront-diff habit — both currently done by eyeballing Keepa charts one ASIN at a time or maintaining manual snapshot columns in Sheets.

---

## 7. Jobs-to-be-done: what an "Excel replacement" must actually do

Derived from the workflows above. Excel survives because it is the only place where *scraped data + personal criteria + purchase state + history* coexist. A replacement must cover all four or sellers keep the sheet.

1. **Capture without retyping.** Every lead arrives with identity (ASIN, title, URL), market state (price, rank/percentile, rating, reviews, offer count), and provenance (which storefront/search it came from, when). ProScan's scraper already does most of this; the gap is rank/offer-count and source attribution.
2. **Evaluate against MY criteria, not a generic score.** Sellers run rule sets (ROI ≥ 30%, profit ≥ $5, est. sales ≥ 20/mo, FBA sellers < 10, no Amazon on listing, no IP flag). ScoutIQ "triggers" and Arbitrage Stalker "scores leads against your ROI, BSR, and margin rules" prove the pattern: **user-defined thresholds with pass/fail/warn output**, not just an opaque 1–10 score.
3. **Hold lifecycle state.** A lead is researching → vetted → purchased (qty, cost, order #) → listed → replen / dead. The buy-list columns (Quantity, Order #, Deal Expiration, Notes) are state, not data — any replacement needs these fields or sellers bounce back to Sheets.
4. **Snapshot and diff over time.** Month-over-month price/rank/review/seller-count deltas per ASIN, plus storefront-level diffs (what did this competitor add/drop since last scrape — Seller Spy's entire product). This is the feature spreadsheets are worst at and the one the owner already identified.
5. **Resurface what needs attention.** "Replen X: BB price down 18% since purchase," "Storefront Y added 14 new ASINs," "Lead Z's deal expires Friday." Push, don't make them re-scan. Competitors deliver this via Discord/Telegram webhooks.
6. **Compute expected share, not just demand.** monthly-sales ÷ FBA-sellers is the unit-quantity decision; needs offer count + velocity estimate per ASIN.
7. **Flag risk early.** Per-brand IP-complaint and gating flags are now expected (SellerAmp and Seller Assistant ship them in every plan). Even a static "risky brands" list beats nothing.
8. **Export cleanly.** Sellers will not abandon Excel for accounting/VA handoffs. XLSX export (which ProScan has) is retention insurance, not a legacy feature.

What does NOT need replacing: repricing, fee-exact profit calc (requires Amazon SP-API fee data), and inventory/order sync — mature, crowded markets. The defensible slice is **lead capture → criteria filter → tracked history → re-check alerts** for storefront-sourced leads.

---

## 8. Pain points, in sellers' (and their vendors') words

- **Sourcing time.** "Sourcing is arguably the single largest time-suck in the online arbitrage business model." — [FBA Lead List](https://www.fbaleadlist.com/what-is-an-online-arbitrage-sourcing-list-plus-free-inventory-template). OABeans: people "spend hours a day browsing online websites for products to resell" without finding "even one product per hour" ([OABeans](https://oabeans.com/)).
- **Lead saturation / price tanking.** Shared leads mean "everyone joining the 'race to the bottom,' leaving little to no profit left on purchased items"; the entire subscriber-cap business model (22/44 seats) exists because "old lead lists died from saturation" ([FBA Lead List blog](https://blog.fbaleadlist.com/p/why-amazon-online-arbitrage-lead-lists-will-be-valuable-in-2026), [Full-Time FBA OA list](https://www.fulltimefba.com/our-trainings/oa-success-leads-list/)). Aura: "When multiple sellers find the same deal, prices plummet" ([source](https://goaura.com/blog/online-arbitrage-guide)).
- **Spreadsheet staleness.** "A seller downloading an inventory report at 9 AM may find that fast-moving SKUs sold out by noon, but the spreadsheet still shows available stock"; one seller reportedly "lost $5,000 in a day after fulfilling orders based on a 24-hour-old Amazon inventory spreadsheet" — [Canopy](https://www.canopyinventory.com/blog/why-spreadsheets-fail-inventory-management) (inventory-SaaS vendor; claims directionally credible, self-interested).
- **Spreadsheet maintenance tax.** "Most sellers spend 30–60 minutes every week downloading CSV reports from Seller Central, cleaning the data, copying it into their tracking spreadsheet, and updating formulas — 26–52 hours per year" ([Canopy](https://www.canopyinventory.com/blog/why-spreadsheets-fail-inventory-management)). Gorilla ROI: consolidating payment/transaction reports "takes over an hour" per pass ([Gorilla ROI](https://www.gorillaroi.com/blog/free-amazon-fba-spreadsheet-template-for-google-sheets-and-excel)).
- **Spreadsheet scaling failure.** "Manual entry creates errors that compound into systemic inaccuracy across spreadsheets with 500+ SKUs… A spreadsheet that works for 100 SKUs breaks at 500" ([Canopy](https://www.canopyinventory.com/blog/why-spreadsheets-fail-inventory-management)).
- **Stale leads kill hot-product plays.** "By the time you source it, price will probably have crashed or you missed the sale." — [BowTied Slinger](https://www.bowtiedslinger.com/p/guide-amazon-storefront-stalking).
- **Replens silently rot.** "Replens can lose their edge if fees creep up or competitors drive down prices… swap in an alternative SKU if the math stops working." — [FBA Lead List](https://www.fbaleadlist.com/how-to-keep-your-amazon-online-arbitrage-replens-profitable-month-after-month/).
- **IP/gating anxiety.** Trademark-troll "entities mass-register trademarks or buy small brands for the sole purpose of filing IP complaints and wiping out competition"; gating keeps expanding, "meaning there are fewer products you can legally buy and sell without risking suspension" ([OABeans IP cheat sheet](https://oabeans.com/ip-complaint-on-amazon/), [The Selling Guys](https://www.thesellingguys.com/online-retail-arbitrage-amazon-dead/)).
- **Keepa data blind spots.** "If no one with Keepa has ever looked at a particular ASIN, it is highly unlikely that Keepa has any data at all for that ASIN" — velocity estimates skew unreliable on long-tail items ([Full-Time FBA](https://www.fulltimefba.com/read-understand-keepa-graphs/)).

**Sourcing-quality note:** spreadsheet-pain quotes above come disproportionately from vendors selling the cure (Canopy, lead-list companies). Direct Reddit threads were not fetchable (domain blocks the crawler). The claims are consistent across independent vendors and match the structure of the sold spreadsheet templates, but treat exact figures ($5k loss, 26–52 hr/yr) as marketing-grade anecdotes.

---

## 9. Implications for ProScan (short, decision-oriented)

1. **ProScan's scraper sits at step 4 of the highest-value workflow** (storefront catalog extraction) but currently discards the data sellers act on: it has price/rating/reviews but not BSR, offer count, or Buy Box state — the three inputs every buying rule needs. Roadmap weight should go there before more derived scores.
2. **The competitor set is Arbitrage Stalker ($19–159/mo), Stealth Seller, and Seller Spy** — all storefront-diff-and-alert products. ProScan's differentiation today is client-side scraping (no per-store server costs) and the price-spread/offer analysis; per-user cloud history closes the main gap.
3. **Replace generic scores with user-defined trigger rules** (ROI/velocity/competition thresholds with pass/warn/fail), keeping Opportunity Score as a default preset. This matches how every segment (OA criteria, ScoutIQ triggers, Arbitrage Stalker rules) actually decides.
4. **The Firestore schema should mirror the lead-list template columns + lifecycle state + snapshots**, because that's the Excel artifact being replaced: identity, market state per scrape (timestamped), user state (status, qty, cost, notes), and source storefront.
5. **Month-over-month diffing has two distinct surfaces**: per-ASIN deltas (replen audit, monthly cadence) and per-storefront catalog diffs (added/dropped ASINs, daily–weekly cadence). Both are explicitly demanded behaviors with named competitor features; build them as first-class views, not derived reports.
