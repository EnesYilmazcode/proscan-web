# Competitor Landscape: Amazon Seller Tooling Around ProScan's Lane

_Last updated: 2026-06-09 — produced by the planning fleet._

Scope: tools that overlap ProScan's lane — storefront scouting, product research, price tracking, and arbitrage sourcing for Amazon arbitrage/OA/wholesale sellers. Pricing was cross-checked against vendor sites where possible (vendor pricing pages fetched 2026-06-09). All prices are list prices as of mid-2026 unless noted; vendors in this space change pricing frequently (Helium 10 repriced April 2026, SellerAmp repriced 2025, Tactical Arbitrage is being folded into a bundle).

---

## 1. Per-tool profiles

### 1.1 Keepa

- **What it does:** The de-facto standard for per-ASIN historical data — price history (Amazon/3P/FBA/Warehouse), sales-rank history, Buy Box stats, offer counts, review counts. Browser extension injects charts into Amazon pages; web app ("Data" section) adds Product Finder (query billions of products by attributes), Product Viewer (bulk ASIN import/export, up to 24,000 ASINs/day on paid), Best Sellers, **Seller Lookup** (storefront details for 100k+ top sellers), Category Tree, price-drop tracking/alerts, wishlist import. ([keepa.com](https://keepa.com/#!features), [revenuegeeks.com/keepa-pricing](https://revenuegeeks.com/keepa-pricing/), [cleartheshelf.com/keepa-review](https://cleartheshelf.com/keepa-review/))
- **Form factor:** Extension + web app (the web app is where the paid "Data" value lives). Mobile app exists but is widely considered weak ([cleartheshelf.com](https://cleartheshelf.com/keepa-review/)).
- **Pricing:** Free tier (charts, basic tracking, wishlist; no Data toolset). Paid: **€19/month or €189/year (~€16/mo)**. API plans are separate and steep: €49/mo for 20 tokens/min up to €4,499/mo for 4,000 tokens/min; tokens expire after 60 min ([keepa.com/#!api](https://keepa.com/#!api), [revenuegeeks.com/keepa-pricing](https://revenuegeeks.com/keepa-pricing/)).
- **Web dashboard / historical tracking:** The deepest per-ASIN history in the industry (years of price/rank data). Seller Lookup shows a storefront's ASIN list and stats as a **snapshot** — it does not diff a storefront month-over-month or alert on adds/drops/price moves at the seller level.
- **Strengths:** Unmatched historical depth; cheap; every other tool in this list embeds or imitates Keepa charts; large dataset moat.
- **Weaknesses/complaints:** Dense, intimidating UI with a real learning curve ("to truly master Keepa, you will need to use it often and learn as you go") ([goaura.com](https://goaura.com/blog/camelcamelcamel-vs-keepa), [entreresource.com](https://entreresource.com/keepa-amazon-selling/)); no profit/fee calculation (sellers pair it with SellerAmp/Seller Assistant); seller-level analysis is bulk-export-to-spreadsheet territory; API pricing locks out small developers.

### 1.2 SellerAmp SAS

- **What it does:** Per-product deal analysis for arbitrage: profit calculator with FBA fees, ROI, BSR/estimated sales, eligibility & IP alerts, Buy Box analysis, embedded Keepa-style historical charts. Chrome extension + web app + mobile app (barcode scanning for RA). Google Sheets sync for sourcing lists ([selleramp.com/pricing](https://selleramp.com/pricing/), [selleramp.com Google Sheets update](https://selleramp.com/news/google-sheets-update/)).
- **Form factor:** Extension + web app + mobile, all on every plan.
- **Pricing (repriced 2025):** Getting Started **$19.95/mo** (1,000 lookups/mo, 1 phone + 2 extension installs); Getting Serious **$29.95/mo** (unlimited lookups, 3 phone + 5 extension installs); Going Pro **$49.95/mo** ($39.95 intro) — unlimited users, settings profiles, team/usage analytics ([selleramp.com/pricing](https://selleramp.com/pricing/), [Going Pro announcement](https://selleramp.com/news/selleramp-sass-brand-new-package-going-pro/), [new pricing post](https://selleramp.com/news/new-pricing-2025/)). UK: £13.95/£19.95 + VAT ([revenuegeeks.com](https://revenuegeeks.com/seller-amp-price/)). 14-day trial.
- **Web dashboard / historical tracking:** Web app is a lookup/analysis surface plus saved sourcing lists; history shown is Keepa-derived per-ASIN charts. **No storefront-wide scraping and no longitudinal tracking of a competitor catalog.** Going Pro analytics track *your team's* lookup activity, not market history.
- **Strengths:** Speed and simplicity for single-item buy/no-buy decisions; best-in-class mobile RA workflow; very popular default for OA sellers ([garlicpressseller.com](https://garlicpressseller.com/selleramp-sas-review/), [entreresource.com](https://entreresource.com/seller-amp-review/)).
- **Weaknesses/complaints:** Lookup cap on the cheap tier; price went up in 2025; it analyzes one product at a time — list-level and storefront-level work still ends in Google Sheets; requires Keepa data subscription for full chart depth in practice ([sellerassistant.app comparison](https://www.sellerassistant.app/blog/selleramp-vs-seller-assistant/)).

### 1.3 Helium 10

- **What it does:** Full private-label suite: keyword research (Cerebro/Magnet), listing optimization, Xray product research extension, PPC automation (Adtomic), inventory/profits, follow-up email, etc. Arbitrage/storefront workflows are not the focus.
- **Form factor:** Web app suite + Chrome extension.
- **Pricing (April 2026 repricing):** **Starter plan ($39) removed.** Platinum **$129/mo** ($99/mo annual); Diamond **$359/mo** ($279/mo annual); Enterprise from ~$1,499/mo. Adtomic adds a 2% fee on managed ad spend ([helium10.com/pricing](https://www.helium10.com/pricing/), [sentrykit.com analysis](https://sentrykit.com/blog/helium-10-price-increase-2026-starter-plan-removed/), [demandsage.com](https://www.demandsage.com/helium-10-pricing/)).
- **Web dashboard / historical tracking:** Deep — but oriented at your own listings/keywords and category-level research, not competitor storefront catalogs.
- **Strengths:** Best keyword tooling (Cerebro is repeatedly called essential on Reddit FBA communities); huge brand.
- **Weaknesses/complaints:** 2026 price hike is loudly resented — review sites cut ratings citing the Starter-plan removal; "more than doubled the cost and removing features unless you pay extra"; entry price of $1,188+/yr now excludes beginners ([sentrykit.com](https://sentrykit.com/blog/helium-10-price-increase-2026-starter-plan-removed/), [trustpilot.com/review/www.helium10.com](https://www.trustpilot.com/review/www.helium10.com)). Irrelevant to storefront-stalking arbitrage workflows — it's a different sport.

### 1.4 Jungle Scout

- **What it does:** Private-label product research: Opportunity Finder, Product/Keyword databases, supplier database, sales estimates, Product Tracker (track a shortlist of ASINs' price/sales over time), Competitive Intelligence (brand-level) on the top tier.
- **Form factor:** Web app + Chrome extension.
- **Pricing (2026 "Catalyst" plans):** Starter **$49/mo** ($348/yr annual); Growth Accelerator **$79/mo** ($588/yr); Brand Owner + CI **$399/mo** ($3,588/yr) — Competitive Intelligence is exclusive to this tier; Cobalt (enterprise) custom ([junglescout.com/pricing](https://www.junglescout.com/pricing/), [demandsage.com](https://www.demandsage.com/jungle-scout-pricing/), [scribehow.com breakdown](https://scribehow.com/page/Jungle_Scout_Pricing_2026_Plans_Cost_and_Best_Value__o1fkzsAhQ6iC2bnxqzLMbw)). 7-day money-back, no free trial.
- **Web dashboard / historical tracking:** Product Tracker holds ~20 products on entry tiers (vs 150 on AMZScout, per [revenuegeeks.com/amzscout-pricing](https://revenuegeeks.com/amzscout-pricing/)) — single-product watching, not catalog tracking. Brand/competitor history is paywalled at $399/mo.
- **Strengths:** Polished UX, trusted sales estimates, good for PL product discovery.
- **Weaknesses/complaints:** Arbitrage sellers are not the audience (no profit-calc-on-page, no storefront tools); meaningful competitor tracking is locked to the $399/mo tier.

### 1.5 Tactical Arbitrage (Threecolts / Seller 365)

- **What it does:** The flagship OA sourcing crawler: scans 1,400+ retail sites against Amazon for price gaps; reverse search; wholesale list scanning; **Storefront Stalk** — feed it competitor Amazon storefront URLs, it pulls the ASINs and finds which are profitably sourceable elsewhere; users run "dozens or even hundreds of storefronts at a time" ([cleartheshelf.com review](https://cleartheshelf.com/tactical-arbitrage-review/), [entreresource.com](https://entreresource.com/tool-spotlight-tactical-arbitrage/)).
- **Form factor:** Web app (scans run server-side); CSV/XLSX in and out is the core workflow.
- **Pricing:** Legacy standalone plans $59–$159/mo (Flip Pack $59, Wholesale $69, OA $89, OA+WS $109, Full Suite $129, Pro $159; annual ~20–22% off) ([revenuegeeks.com/tactical-arbitrage-price](https://revenuegeeks.com/tactical-arbitrage-price/)). Standalone pages now redirect to **Seller 365**: $69/mo (annual $828), Teams $79/mo, Pro $199/mo — a 10-app bundle (Tactical Arbitrage, InventoryLab, SmartRepricer, ScoutIQ, Scoutify, ScoutX, FeedbackWhiz suite) ([threecolts.com/seller-365](https://www.threecolts.com/seller-365), [threecolts.com pricing](https://www.threecolts.com/seller-365/pricing)).
- **Web dashboard / historical tracking:** Scan-job oriented — you launch scans, wait (live scans can take hours), download results. **No persistent month-over-month memory of a storefront's catalog**; each Storefront Stalk is a fresh snapshot you reconcile yourself, typically in Excel.
- **Strengths:** Breadth (1,400+ source sites), the most complete sourcing crawler; bundle is now decent value on paper.
- **Weaknesses/complaints:** Trustpilot is full of billing/cancellation horror stories — "charged $89 monthly for 7 months after cancelling," cancellation flow "intentionally obscured" ([trustpilot.com/review/tacticalarbitrage.com](https://www.trustpilot.com/review/tacticalarbitrage.com)); steep learning curve; output is big spreadsheets that still need manual triage; $69+/mo is the floor even if you only want storefront scanning.

### 1.6 AZInsight (asinzen)

- **What it does:** On-page product analysis extension: profit calculator, sales estimates, hazmat/restriction checks, variation viewer, stock checker. Also publishes **ASINFetcher**, a free ASIN-grabber extension for storefronts/search pages ([asinzen.com](https://asinzen.com/getazinsightpro/), [chrome-stats ASINFetcher](https://chrome-stats.com/d/eiiaminhipheiklkloadaapojkpgmdfm)).
- **Form factor:** Extension-first; minimal web dashboard.
- **Pricing:** Starter **$59.95/yr (~$7.95/mo equiv.)**; Advanced **$145.95/yr** ($114.95 first year promo); >50% saving vs monthly billing; 30-day free trial, no card ([support.asinzen.com pricing breakdown](https://support.asinzen.com/support/solutions/articles/153000216157-azinsight-pricing-and-plans-a-breakdown), [revenuegeeks.com/asinzen-pricing](https://revenuegeeks.com/asinzen-pricing/)).
- **Web dashboard / historical tracking:** None to speak of — it's an in-page analysis overlay. No storefront tracking.
- **Strengths:** Cheapest credible deal-analyzer; generous trial; ASINFetcher proves demand for free storefront ASIN extraction.
- **Weaknesses:** No cloud workspace, no history, no tracking; data lives in the moment or in your export.

### 1.7 Seller Assistant (sellerassistant.app) — closest direct competitor

- **What it does:** Extension + web platform for OA/wholesale/dropship research: on-page profit calc, IP-Alert, VPN extension, Price List Analyzer (bulk supplier-list scanning), Bulk Restriction Checker, ASIN Grabber, **Storefront Widget** (analytics widget injected on storefront pages), **Brand Analyzer** (brand revenue, Buy Box ownership, Amazon share across a brand catalog), and **Seller Spy** ([sellerassistant.app/features](https://www.sellerassistant.app/features/), [storefront widget](https://www.sellerassistant.app/features/storefront-widget)).
- **Seller Spy (the direct overlap with ProScan's plan):** monitor a competitor storefront **daily** for price changes and product adds/removals; results in a dashboard (date / Added–Changed–Removed status / category / link / title) and downloadable as Excel ([help.sellerassistant.app Seller Spy](https://help.sellerassistant.app/en/articles/9286199-what-is-seller-spy-in-seller-assistant), [sellerassistant.app/tools/seller-spy](https://www.sellerassistant.app/tools/seller-spy)). One third-party review reports a 3-seller monitoring cap ([fbamultitool.com](https://fbamultitool.com/seller-spy-can-it-help-your-amazon-business/)); the help doc states no limit, so caps likely vary by plan.
- **Form factor:** Extension(s) + real web dashboard. Zapier/Make/n8n/Google Sheets/API integrations on Business+.
- **Pricing (vendor page, fetched 2026-06-09):** Start **$159.99/yr** (annual-only; 3,500 lookups/mo); Pro **$29.99/mo** / $299.99/yr (10k lookups/mo, Price List Analyzer 3k scans/mo); **Business $79.99/mo** / $839.88/yr — **Seller Spy and Brand Analyzer start here**, plus 150k–300k list scans/mo and integrations; Business Plus $189.99/mo (5 seats); Agency from $399.99/mo ([sellerassistant.app/pricing](https://www.sellerassistant.app/pricing/)). 14-day trial.
- **Strengths:** The only mainstream tool that combines on-page analysis + bulk list scanning + storefront/brand longitudinal tracking in one account; aggressive content marketing; grows from $13–30/mo into team plans.
- **Weaknesses/complaints:** Storefront tracking (Seller Spy) is paywalled at **$70–80/mo** — ~4x the entry tier; mixed Trustpilot reports on billing/refunds (charged after cancelling a trial, weekend support gap) ([trustpilot.com/review/sellerassistant.app](https://www.trustpilot.com/review/sellerassistant.app)); Seller Spy output leans on Excel downloads for real analysis; no price-spread/offer-depth statistics, no scoring of "what to flip next."

### 1.8 ScanUnlimited

- **What it does:** Web-based bulk wholesale list scanner: upload supplier CSVs (UPC/EAN/ASIN), match against Amazon, return 60+ data points/product with profit calc ([scanunlimited.com/bulk-scan](https://www.scanunlimited.com/bulk-scan)).
- **Form factor:** Web app only.
- **Pricing:** Free forever plan — one scan of up to 10,000 lines/month; Unlimited **$70/mo** ($60 annual, 100k lines); Unlimited Plus **$100/mo** ($90 annual) ([revenuegeeks.com/scan-unlimited-pricing](https://revenuegeeks.com/scan-unlimited-pricing/), [help.scanunlimited.com](https://help.scanunlimited.com/en/articles/4381591-what-types-of-plans-do-we-offer)). Now part of Carbon6.
- **Web dashboard / historical tracking:** Scan results only; no longitudinal tracking, no storefront features, "doesn't support OA, dropshipping, or connected workflows" ([ecomcircles.com review](https://ecomcircles.com/blog/scan-unlimited-review/)).
- **Strengths:** Genuinely useful free tier; fast wholesale scanning.
- **Weaknesses:** Jump from free to $70/mo with nothing in between — "pricing is too high for a very small business, they should have an affordable small plan" ([sourceforge.net reviews](https://sourceforge.net/software/product/ScanUnlimited/)).

### 1.9 BuyBotPro

- **What it does:** Automated deal analyzer extension (UK-origin, OA/RA): AI buy/no-buy score with green/amber/red verdict, fee-complete profit calc, IP Radar, wholesale CSV/XLSX analyzer, BuyBotGo mobile RA app ([buybotpro.com](https://www.buybotpro.com/), [learnretailarbitrage.com review](https://learnretailarbitrage.com/buybotpro-review/)).
- **Form factor:** Extension + mobile; no meaningful web dashboard.
- **Pricing (Jan 2025):** Lite **$17.95/mo**; Advanced **$39.95/mo**; Professional **$54.95/mo** (unlimited scans, 15 licenses); Enterprise **$129.95/mo** (32 licenses) ([oabeans.com/buybot-pro-reviews](https://oabeans.com/buybot-pro-reviews/), [trustradius.com](https://www.trustradius.com/products/buybotpro/pricing)).
- **Strengths:** Beginner-friendly verdict scoring; strong UK community.
- **Weaknesses:** Doesn't find products — only judges one you've already found; no historical/cloud workspace; per-deal not per-catalog.

### 1.10 SmartScout

- **What it does:** Top-down market intelligence web app: database of millions of sellers and 1.5M+ brands across 43k subcategories; brand revenue/Buy Box share at a glance; seller database with 30+ filterable parameters; Chrome extension for on-page history charts ([smartscout.com](https://www.smartscout.com/), [thesellingguys.com review](https://www.thesellingguys.com/smartscout-review/)).
- **Form factor:** Web app + extension.
- **Pricing:** Basic **$29/mo** ($25 annual); mid tiers up to ~$187/mo; Enterprise from $399+ with API/historical data suites ([smartscout.com/pricing](https://www.smartscout.com/pricing), [getapp.com](https://www.getapp.com/business-intelligence-analytics-software/a/smartscout/)).
- **Web dashboard / historical tracking:** Excellent *database snapshots* of sellers/brands (estimated revenue, ASIN counts); historical suites exist but are gated to enterprise. Aimed at wholesale prospecting ("find brands to pitch"), not daily flip-hunting.
- **Strengths:** Unique seller/brand database angle; reasonable entry price.
- **Weaknesses/complaints:** Learning curve; limited Basic plan; auto-renewal complaints; **"$158 for excel download option" cited as expensive** — exports are an upsell ([revenuegeeks.com/smartscout-review](https://revenuegeeks.com/smartscout-review/), [trustpilot.com/review/smartscout.com](https://www.trustpilot.com/review/smartscout.com)); estimates 80–90% accurate by their own accuracy page ([affinco.com](https://affinco.com/smartscout-review/)).

### 1.11 Storefront-stalking specialists

- **Storefront Stalker Pro** (Nate McCallister / EntreResource): began as a Chrome extension exporting up to 100 storefront pages (400 non-storefront pages) of ASINs to CSV for feeding into Tactical Arbitrage; a legacy lifetime-license extension is still sold on Gumroad ([natemccallister.gumroad.com/l/kpCdM](https://natemccallister.gumroad.com/l/kpCdM), [jordiob.com](https://jordiob.com/amazon-tools/storefront-stalker-pro/)). The current web version is a monitoring SaaS: **Basic $60/mo (10 storefronts), Professional $90/mo (20), Elite $140/mo (40)**, ~20% annual discount; rescans every 4 hours and emails alerts on new ASINs, dashboard shows ASIN/brand/monthly-sold/BSR/Buy Box price ([cleartheshelf.com/storefront-stalker-pro](https://cleartheshelf.com/storefront-stalker-pro/), [saecomfbapro.com](https://saecomfbapro.com/storefront-stalker-pro/)). Pricing is aggressive for what is essentially scheduled scraping + diffing.
- **SellerFuse** Storefront Tracker: tracks competitor ASINs and notifies when sellers list new ASINs, part of a broader OA toolkit ([sellerfuse.com](https://sellerfuse.com/find-an-amazon-storefront-stalking/)).
- **SellerSprite Storefront Tracker:** monitors competitor storefront updates, new listings (7/15/30/60-day windows) and price changes; SellerSprite plans: Free; Standard **$79/mo** or $790/yr; Advanced/VIP annual-only, limits scale by number of storefronts/keywords/products tracked ([sellersprite.com storefront guide](https://www.sellersprite.com/en/help/Storefront-Tracker-Guide), [sellersprite.com/en/price](https://www.sellersprite.com/en/price)).
- **Free ASIN grabbers:** ASINFetcher (asinzen, free) exports ASINs from any Amazon page ([chrome-stats.com](https://chrome-stats.com/d/eiiaminhipheiklkloadaapojkpgmdfm)); Seller Assistant ships an ASIN Grabber too ([sellerassistant.app/blog/asin-grabber](https://www.sellerassistant.app/blog/asin-grabber/)). Extraction is commoditized; *retention and diffing over time* is what's monetized.

### 1.12 Other notables (brief)

- **AMZScout:** PL-leaning research suite; Pro extension from **$16.49/mo** (lifetime $799); Sellers Bundle $44.99/mo or $379.99/yr; Product Tracker holds 150 products ([amzscout.net](https://amzscout.net/), [revenuegeeks.com/amzscout-pricing](https://revenuegeeks.com/amzscout-pricing/)).
- **AmzMonitor / SellerSonar:** listing-monitoring alert tools (Buy Box loss, hijackers, price/listing changes) aimed at protecting *your own* ASINs, not scouting competitors' storefronts ([amzmonitor.com](https://amzmonitor.com/), [sellersonar.com](https://sellersonar.com/)).
- **Sellerbility:** OA deal-stacking tool whose headline integration is "export your deal stack to Google Sheets with one click" — further evidence the segment's system-of-record is still a spreadsheet ([sellerbility.com](https://www.sellerbility.com/)).

---

## 2. Comparison table

| Tool | Form factor | Entry price (mo) | Storefront-wide scrape | Tracks storefront over time | Per-ASIN history | Profit calc | Notes |
|---|---|---|---|---|---|---|---|
| Keepa | Ext + web | €19 (free tier exists) | Seller Lookup snapshot/export | No (per-ASIN alerts only) | Best in class (years) | No | Data moat; dense UI |
| SellerAmp SAS | Ext + web + mobile | $19.95 | No | No | Via embedded charts | Yes | Single-product analyzer |
| Helium 10 | Web + ext | $99–129 | No | No | Yes (own listings focus) | Partial | PL suite; 2026 price hike backlash |
| Jungle Scout | Web + ext | $49 | No | Brand CI at $399/mo only | Product Tracker (~20 ASINs) | No | PL suite |
| Tactical Arbitrage / Seller 365 | Web | $69 (bundle) | Yes (Storefront Stalk) | No — fresh snapshots, manual diff | Via Keepa embed | Yes | CSV-heavy; billing complaints |
| AZInsight | Ext | ~$7.95 ($59.95/yr) | No (free ASINFetcher exports) | No | Via charts | Yes | Cheapest analyzer |
| Seller Assistant | Ext + web | $13.33 (Start, annual) | Yes (Storefront Widget + ASIN Grabber) | **Yes — Seller Spy, daily, from $79.99/mo tier** | Via charts | Yes | Closest competitor |
| ScanUnlimited | Web | Free / $70 | No (CSV lists only) | No | No | Yes | Wholesale lists only |
| BuyBotPro | Ext + mobile | $17.95 | No | No | Via charts | Yes | Judge-a-deal tool |
| SmartScout | Web + ext | $29 | Seller DB snapshots | History gated to enterprise | Yes (charts) | No | Wholesale prospecting |
| Storefront Stalker Pro (web) | Web SaaS | **$60 (10 storefronts)** | Yes | **Yes — 4-hr rescan, email alerts** | Partial (BSR/price shown) | No | Pure-play; pricey per storefront |
| SellerSprite | Web + ext | $79 | Yes (tracker) | Yes (7/15/30/60-day windows) | Yes | Partial | China-origin, PL-leaning |
| AMZScout | Web + ext | $16.49 (ext only) | No | No | Tracker (150 ASINs) | Partial | PL-leaning |

---

## 3. Gap analysis — where ProScan can win

### 3.1 (a) Storefront-wide scraping + month-over-month catalog tracking is a thin, expensive field

Almost everyone does **single-product analysis**; almost nobody does **persistent catalog memory**:

- **Keepa** has the history but is ASIN-centric; seller-level work is a one-shot export.
- **Tactical Arbitrage** scrapes storefronts at scale but has no memory — every Storefront Stalk is a new snapshot; diffing last month vs this month is the user's Excel problem.
- Only three products genuinely track a competitor storefront longitudinally: **Seller Spy** (inside Seller Assistant, gated at $79.99/mo Business), **Storefront Stalker Pro web** ($60/mo for just 10 storefronts), and **SellerSprite's Storefront Tracker** ($79/mo, PL-oriented, 60-day window). All three are priced at $60–80/mo minimum, and none of them combines tracking with offer-depth/price-spread statistics or an opportunity-scoring layer.
- Nobody tracks **rating/review-count deltas per tracked catalog item** as a first-class signal (Keepa has the raw data per ASIN; no one surfaces "this competitor's item gained 200 reviews this month" across a whole storefront).

ProScan's planned shape — free extension scrapes whole storefronts/search pages, cloud keeps every snapshot per user, dashboard diffs month-over-month price/rating/review changes and scores what to flip — is exactly the unserved intersection. The extension-side scrape (user's own browser, user's own session) also avoids the server-side scraping cost structure that forces SaaS competitors to charge $60+/mo and impose 10-storefront caps.

### 3.2 (b) Price-point gap

The market stratifies into: ~$8–30/mo single-product analyzers (AZInsight, SellerAmp, BuyBotPro, Keepa, SmartScout Basic) and $60–130/mo for anything that scans or tracks at catalog scale (TA/Seller 365 $69, Seller Spy tier $79.99, Storefront Stalker Pro $60–140, SellerSprite $79, ScanUnlimited $70). **There is no offering under ~$60/mo that tracks competitor storefronts over time.** A free tier (extension + limited cloud history, e.g. 2–3 storefronts / 30-day retention) with a paid tier in the **$15–29/mo** band undercuts every tracking product by 50–75% while sitting at the price level sellers already accept for analyzers. Also relevant: the 2025–26 repricing wave (Helium 10 +$1,000/yr entry jump, SellerAmp +~$2–10/mo, ScanUnlimited's announced increase, TA forced into a $69 bundle) has created visible resentment and churn-shopping ([sentrykit.com](https://sentrykit.com/blog/helium-10-price-increase-2026-starter-plan-removed/), [trustpilot.com TA reviews](https://www.trustpilot.com/review/tacticalarbitrage.com)) — good timing for a cheap entrant. Secondary lesson from Trustpilot across TA, Seller Assistant, SmartScout: billing/cancellation friction is the #1 reputation killer in this niche; transparent self-serve cancellation is a cheap differentiator.

### 3.3 (c) The Excel/CSV escape hatch is the industry's load-bearing wall

Every workflow in this space terminates in a spreadsheet, and vendors treat that as a feature rather than a failure:

- Tactical Arbitrage's entire pipeline is CSV-in/spreadsheet-out; reviewers describe triaging giant exports by hand ([cleartheshelf.com](https://cleartheshelf.com/tactical-arbitrage-review/)).
- Seller Spy's analysis path is "download the detailed Excel file to track what your competitors do" ([sellerassistant.app blog](https://www.sellerassistant.app/blog/seller-spy-by-seller-assistant/)).
- SellerAmp's flagship workflow integration is Google Sheets sync ([selleramp.com](https://selleramp.com/news/google-sheets-update/)); Sellerbility's headline is one-click export to Sheets ([sellerbility.com](https://www.sellerbility.com/)).
- SmartScout charges extra for the Excel download option and users complain about the price ([revenuegeeks.com/smartscout-review](https://revenuegeeks.com/smartscout-review/)).
- Threecolts' own marketing concedes the pain: "manual sourcing becomes a nightmare of spreadsheets" ([threecolts.com blog](https://www.threecolts.com/blog/best-online-arbitrage-tools/)).

The gap is not "export to XLSX" (ProScan already has that via SheetJS) — it's making the export unnecessary: an in-dashboard view that answers "what changed in this storefront since last month, what's worth flipping, what should I scrape next" without round-tripping through Excel. Keep XLSX export as the safety blanket; win by making people stop opening it.

### 3.4 Differentiators ProScan already has that the field lacks

- **Price-spread statistics per ASIN** (min/max/median/stdDev/CV/IQR across competing offers): no surveyed tool exposes offer-dispersion statistics as a sourcing signal; Keepa shows offer history, SellerAmp shows Buy Box analysis, but none compute spread/variation scores.
- **Composite Opportunity/Arbitrage scoring across a whole scraped catalog** — BuyBotPro scores one deal at a time; nobody scores a storefront's full inventory in one pass.
- **Client-side scraping economics**: competitors' COGS (proxies, server scraping, Keepa API tokens at €49+/mo) set their price floor; ProScan's marginal scrape cost is ~zero, so a free tier is sustainable where theirs is not.

### 3.5 Threats and honest caveats

- **Seller Assistant is moving fast** in exactly this direction (Seller Spy + Brand Analyzer + integrations) and has distribution; assume they will down-tier Seller Spy eventually.
- **Historical depth is a moat ProScan can't shortcut**: Keepa has years of data; ProScan's MoM tracking only becomes valuable after users have scraped for 1–2 months. Onboarding must deliver value on day one (spread stats + scores) while history accrues.
- **Estimated sales velocity is table stakes** for buy decisions (SellerAmp/SmartScout/JS all estimate sales); ProScan's rating×reviews proxy is weaker — expect users to keep a Keepa subscription, so embedding/linking Keepa charts rather than fighting them is the pragmatic play.
- **ToS/scraping risk**: client-side scraping of Amazon pages under the user's session is the same model SellerAmp/AZInsight/Keepa extensions use, but a cloud sync of scraped data at scale raises the profile; rate-limit politely and document it.

### 3.6 Positioning one-liner

"Keepa tracks products. ProScan tracks sellers." — a free storefront-scraping extension feeding a cheap cloud dashboard that remembers every competitor catalog you've ever scanned, diffs it month-over-month (price, rating, reviews, adds/drops), and scores what to flip — at $0–29/mo where the only three competitors charge $60–80/mo and hand you an Excel file.
