# Monetization & Positioning Research for ProScan

_Last updated: 2026-06-09 — produced by the planning fleet._

Scope: how comparable Amazon-seller tools monetize, a freemium shape for ProScan, the Stripe-on-Firebase payments path, scraping-tool risk/positioning, and a trust checklist for the website relaunch. Prices verified against vendor sites where possible on 2026-06-09. Nothing here is legal advice.

---

## 1. How comparable seller tools monetize

### Price points and gating at a glance

| Tool | Free tier | Trial | Entry paid | Mid | High | Primary gating axis |
|---|---|---|---|---|---|---|
| **Keepa** | Yes, forever (price history charts, price alerts, wishlist import; no sales-rank data, no Data toolset) | None (free tier instead) | ~€19/mo or ~€189/yr (≈€16/mo) single "Data" subscription | — | API: €49/mo (20 tokens/min) up to €4,499/mo (4,000 tokens/min) | One flat consumer tier; API metered by tokens/min |
| **SellerAmp SAS** | No | 14-day free trial, all plans | Getting Started $19.95/mo (~$199.50/yr) | Getting Serious $29.95/mo (~$279.50/yr) | Going Pro $49.95/mo (~$399.50/yr intro) | Usage limits (monthly lookups, # of extension/mobile installs), not feature access — all plans get the profit calculator, IP alerts, history charts, Buy Box analysis |
| **Seller Assistant** | No | 14-day free trial | Start $159.99/yr (≈$13.33/mo, annual-only; 3.5k lookups/mo) | Pro $29.99/mo ($24.99 annual; 2 seats, 10k lookups/mo) | Business $79.99/mo ($69.99 annual), Business Plus $189.99/mo (5 seats), Agency from $399.99/mo (unlimited seats, SSO, SLA) | Mixed: usage quotas (lookups, scans, checks) + seats + feature gates (Seller Spy, Brand Analyzer, integrations only on Business+); add-ons sold separately (extra seat $14.99/mo) |
| **Helium 10** | Yes, limited free plan | Free plan acts as trial | Platinum $129/mo ($99 annual) | Diamond $359/mo ($279 annual) | Enterprise from ~$1,499/mo | Usage limits (ASINs tracked: 20 vs 1,000 vs 5,000+; markets; Listing Analyzer uses) + seats + feature gates. Removed its $39 Starter plan in April 2026 and moved upmarket |

Sources: [selleramp.com/pricing](https://selleramp.com/pricing/), [sellerassistant.app/pricing](https://www.sellerassistant.app/pricing/), [helium10.com/pricing](https://www.helium10.com/pricing/), [revenuegeeks.com/keepa-pricing](https://revenuegeeks.com/keepa-pricing/), [fbamultitool.com Keepa guide](https://fbamultitool.com/keepa-subscription-pricing-quick-guide-for-amazon-sellers/), [revenuegeeks.com/seller-amp-price](https://revenuegeeks.com/seller-amp-price/), [sentrykit.com on Helium 10's 2026 price change](https://sentrykit.com/blog/helium-10-price-increase-2026-starter-plan-removed/), [selleramp.com Going Pro announcement](https://selleramp.com/news/selleramp-sass-brand-new-package-going-pro/).

### Patterns worth copying

- **The arbitrage-sourcing segment clusters at $13–$50/mo.** SellerAmp and Seller Assistant — ProScan's closest comps (extension-first, OA/wholesale sourcing) — both enter under $20/mo. Helium 10 is a different segment (private-label brand suite) and just abandoned the sub-$100 market entirely; don't anchor on it for pricing, only for gating mechanics.
- **14-day free trial is the segment standard** (SellerAmp, Seller Assistant), cancel-anytime, no contract. Keepa is the exception: no trial, but a genuinely useful forever-free tier that converts via withheld data (sales rank).
- **Annual = roughly 2 months free (15–20% off)** across all four. Seller Assistant pushes annual harder by making its cheapest tier annual-only.
- **Low tiers gate by usage quota, not by feature.** SellerAmp gives every plan every feature and differentiates on monthly lookups and device installs. Seller Assistant meters lookups/scans/checks. This keeps the marketing page simple ("everything included, pick your volume") and avoids crippling the first-run experience.
- **High tiers gate by seats + team/ops features** (Seller Assistant: 2 → 5 → unlimited seats, SSO, SLA, dedicated CSM). Per-seat monetization only appears at the wholesale/agency end — solo arbitrage sellers don't pay per seat.
- **Add-ons as an upgrade relief valve.** Seller Assistant sells extra seats and extra quota à la carte so users don't have to jump a whole tier.

---

## 2. A freemium shape for ProScan

### Principles

1. **Never paywall what the extension already does free today.** Scraping result pages, Opportunity/Arbitrage scores, price-spread stats, XLSX export, and the bring-your-own-key Gemini chatbot are the installed base's expectations and the Chrome-store rating depends on them. Clawing features back invites 1-star reviews.
2. **The paid product is the cloud platform, not the scraper.** Everything that requires Firestore (per-user persistence, history, cross-device, alerts) is new surface area with real COGS — that is the natural paid boundary, and it matches the forward architecture in REVAMP_PLAN.md (Auth + Firestore + /dashboard).
3. **ProScan's unique data is longitudinal self-collected snapshots + price-spread/variation analytics.** Unlike SellerAmp/Seller Assistant, ProScan doesn't license Keepa data, so it can't sell "history" it doesn't have on day one — it sells *retention and analysis of the user's own scrapes*. History depth is therefore the single best gate: it costs you storage, it compounds in value the longer someone pays, and it creates lock-in (cancel = lose your trendlines).
4. **Gate by quota at the low end, by feature only where the feature has ongoing cost** (alerts = scheduled function invocations; deep history = storage and reads).

### Natural paid gates, ranked

| Gate | Why it works | Suggested free limit |
|---|---|---|
| **History depth / snapshot retention** | Core of the month-over-month value prop; zero perceived loss for new users; compounds | 30 days of snapshots |
| **Tracked storefronts / tracked-ASIN count** | Maps directly to "what to scrape next" workflow; mirrors Helium 10's ASIN-tracking gate | 2 storefronts / ~100 tracked ASINs |
| **Alerts** (price-drop, new-offer, rating/review-velocity changes) | Recurring server cost; clearly "platform," not "extension" | None on free (or email digest only) |
| **Cloud sync volume** (scrapes synced per month) | Equivalent of SellerAmp lookups; protects Firestore bill | e.g. 1,000 synced products/mo |
| **Dashboard exports** (filtered/cohort XLSX/CSV from cloud data) | Fine to gate because *local* XLSX export from the extension stays free | Extension export free forever; dashboard bulk export paid |
| **Seats / shared workspace** | Only for a later wholesale/VA tier | 1 user |

### Candidate pricing ladders

**Ladder A — "Keepa-style two-tier" (recommended to start):**

| Tier | Price | Contents |
|---|---|---|
| Free | $0 forever | Full extension; cloud sync with 30-day history, 2 tracked storefronts, 1,000 synced products/mo |
| Pro | **$14.99/mo or $119/yr** (≈$9.92/mo) | Unlimited history, 25 storefronts, alerts, dashboard exports, trend charts, priority support |

Why: one decision for the buyer, undercuts SellerAmp's $19.95 entry while ProScan's dataset is still thinner than Keepa-backed competitors, and the steep annual discount (~33%) front-loads cash while the product matures.

**Ladder B — "Segment-standard three-tier":**

| Tier | Price | Contents |
|---|---|---|
| Free | $0 | As above |
| Starter | $9.99/mo ($99/yr) | 6-month history, 5 storefronts, 10 alerts, exports |
| Pro | $24.99/mo ($249/yr) | Unlimited history, 50 storefronts, unlimited alerts, API/Sheets export, early features |

Why: captures price-sensitive OA sellers at $9.99 (below every comp) and gives an upsell path. Risk: three tiers is more to build (entitlement matrix, two quota sets) for an unproven funnel.

**Ladder C — "Premium positioning + team tier" (later, not at launch):**

| Tier | Price | Contents |
|---|---|---|
| Free | $0 | As above |
| Pro | $19/mo ($190/yr) | Everything unlimited for one user |
| Team | $49/mo | 3 seats, shared storefront watchlists, CSV/Sheets feeds |

Why: matches SellerAmp's entry price once ProScan has 6+ months of history data and testimonials; Team mirrors where Seller Assistant makes its real money (wholesale teams). Premature today.

**Trial mechanics:** follow the segment — 14-day free trial of Pro on signup (card-optional if using Stripe Checkout's `trial_period_days` with `payment_method_collection: if_required`), then drop to Free, never delete data immediately (retain paid-tier history read-only for 30 days as a win-back lever).

---

## 3. Payments on Firebase (Stripe path)

### Option 1: Invertase "Run Payments with Stripe" Firebase extension

- The extension (`invertase/firestore-stripe-payments`) was officially transferred from Stripe to Invertase, which maintains it now; the old `stripe/firestore-stripe-payments` is unmaintained and users are told to migrate ([github.com/invertase/stripe-firebase-extensions](https://github.com/invertase/stripe-firebase-extensions), [old extension page](https://extensions.dev/extensions/stripe/firestore-stripe-payments)).
- Current version **0.3.12** on the Extensions Hub, publisher-verified by Firebase ([extensions.dev/extensions/invertase/firestore-stripe-payments](https://extensions.dev/extensions/invertase/firestore-stripe-payments)).
- What it does: creates Stripe Checkout sessions from Firestore writes, syncs customers/subscriptions/prices into Firestore (`customers/{uid}/subscriptions/...`), and can set a custom claim (e.g. `stripeRole`) on the Firebase Auth user — which is exactly what ProScan's extension token-handoff needs to read entitlements without extra round-trips.
- Caveats: the repo has ~143 open issues; it is community-maintained, not a Stripe product. Free-trial support has friction (relies on a deprecated Stripe feature for some trial flows — [issue #609](https://github.com/invertase/stripe-firebase-extensions/issues/609)). Versioning is pre-1.0.

### Option 2: Direct Stripe Checkout + one webhook Cloud Function

Roll your own: a callable function creates a Checkout Session (`mode: subscription`), a single HTTPS function verifies the `stripe-signature` webhook (events: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) and writes `users/{uid}/billing` + sets a custom claim. ~200 lines, no third-party dependency risk, full control over trials and the customer portal. Given ProScan needs exactly one subscription product, **this is the recommended path**; use the extension only if speed matters more than control.

### Costs and required setup

| Item | Cost |
|---|---|
| Stripe card processing (US) | 2.9% + $0.30 per transaction ([stripe.com/pricing](https://stripe.com/pricing)) |
| Stripe Billing (recurring) | +0.5% (Starter) / 0.8% (Scale) on recurring charges ([stripe.com/billing/pricing](https://stripe.com/billing/pricing)) — i.e. ~$0.85 total fees on a $14.99 charge |
| Firebase | Blaze (pay-as-you-go) plan required for any extension/function with outbound network; function + Firestore + Secret Manager usage is effectively pennies at small scale ([extension page](https://extensions.dev/extensions/invertase/firestore-stripe-payments)) |
| Chrome Web Store | No cut — CWS has no payments system; off-store web payment is the norm |

**Owner setup checklist:** (1) Stripe account + business verification; (2) create the Product and monthly/annual Prices in the Stripe dashboard; (3) restricted API key (write: Customers, Checkout Sessions, Customer portal; read: Subscriptions, Prices) stored in Secret Manager; (4) webhook endpoint + signing secret; (5) enable the Stripe **customer portal** so cancel/upgrade is self-serve (mandatory for low support load); (6) upgrade Firebase project to Blaze; (7) Firestore security rules so billing docs are server-write-only; (8) decide on Stripe Tax (adds automated VAT/sales-tax; ProScan can defer until revenue justifies it).

---

## 4. Risk & positioning notes (not legal advice)

### The ToS reality

- Amazon's Conditions of Use prohibit "any use of data mining, robots, or similar data gathering and extraction tools" and collection of product listings/prices for third-party benefit ([amazon.com Conditions of Use](https://www.amazon.com/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM), discussion: [scrapehero.com](https://www.scrapehero.com/is-scraping-amazon-legal/)). Every incumbent in section 1 operates despite this; scraping public pages is widely treated as a gray zone, while anything behind a login, credential capture, or bot-disguising is where Amazon actually litigates (e.g., Amazon v. Perplexity over an agent that "masks machine actions as human clicks", Nov 2025 — [aicerts.ai coverage](https://www.aicerts.ai/news/amazon-v-perplexity-ai-web-scraping-showdown/)).
- **New in 2026:** Amazon's updated Business Solutions Agreement (effective 2026-03-04) adds an Agent Policy for "automated software or AI agents" accessing Amazon Services: agents must identify themselves as automated, comply with the policy, and cease access on request ([ppc.land](https://ppc.land/amazons-new-ai-agent-rules-shake-up-sellers-before-march-4-deadline/)). The definition is ambiguous, but the safe side of the line is clear: **user-initiated, in-session page reading is a browsing assistant; autonomous background crawling is an agent.** ProScan's design (user navigates, extension parses the page they're already looking at) sits on the right side — keep it there.

### How incumbents position themselves

- SellerAmp, Seller Assistant, and the Keepa extension all market as **sourcing analysis / product research / price tracking** tools, never "scrapers." They lean on licensed or first-party data where possible — SellerAmp's history charts are Keepa-API data, and seller-account figures come via Amazon's official SP-API with user consent ([selleramp.com/features](https://selleramp.com/features/), [learnretailarbitrage.com review](https://learnretailarbitrage.com/selleramp-review/)). The page-level reading they do happens in the user's own browser session, user-initiated.
- Keepa has operated at massive scale for a decade with a public dataset and no known Amazon lawsuit (none found in 2024–2026 searches).

### Practical risk-reduction for ProScan

1. **Rename the public-facing identity away from "scraper."** The extension repo is `AmazonSellerScraper`; the Chrome-store listing, website copy, and manifest description should say "product research / storefront analytics for Amazon sellers." Listing copy is what CWS reviewers and Amazon lawyers read.
2. **User-initiated only.** No background crawling, no auto-pagination beyond the user's click, no scraping via `chrome.alarms` (alarms should only flush the *upload queue* to Firestore, per the agreed architecture — never fetch Amazon pages).
3. **Rate-limit the offer-fetcher** (the per-ASIN sellerPrices collector is the most bot-like behavior in the product): serialize requests, add jitter/delays, cap ASINs per run, and back off on 503/captcha.
4. **Never touch credentials or logged-in seller data.** No Seller Central pages, no buyer PII, no reviews-content harvesting. Public listing data only.
5. **Don't proxy Amazon traffic through your servers.** All page access stays in the user's browser with their IP; Firestore only receives derived product records. This keeps ProScan an analytics layer, not a scraping service.
6. **Chrome Web Store compliance:** single-purpose rule, no remotely hosted code (MV3 hard requirement), minimal host permissions, accurate data-disclosure fields in the dashboard, and Limited Use of any collected data — enforcement tightened January 2025 and policies were last updated May 2025 ([program policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [remote-code rules](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)). The Gemini chatbot is fine (API call, not remote code) but its key handling must be disclosed.
7. **Position alerts/tracking as analysis of the user's own collected data**, which it genuinely is — ProScan stores snapshots the user gathered, unlike services that crawl on the user's behalf.

---

## 5. Trust & credibility checklist for the website relaunch

| Item | Why / requirement | Notes for ProScan |
|---|---|---|
| **Privacy policy page** | Mandatory: CWS requires a privacy-policy URL for any extension handling user data, with disclosures matching the dashboard's data-use declarations ([user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)) | Must now cover Firebase Auth (email), Firestore (scrape data), Stripe (billing), Gemini key handling. Link it from site footer and the CWS listing |
| **Limited Use disclosure** | Required on the homepage or one click away for extensions using sensitive data ([Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)) | One paragraph: "ProScan's use of data complies with the Chrome Web Store User Data Policy, including Limited Use" |
| **Data-deletion story** | Differentiator + GDPR/CCPA hygiene | Self-serve "Delete my account and all data" in the dashboard (Firebase's Delete User Data extension or a callable function wiping `users/{uid}`). State retention windows explicitly, including the 30-day win-back retention |
| **"Your data stays yours" page** | Counters the natural suspicion of seller tools | Truthfully say: scraping happens in your browser, data is stored under your account only, never sold or shared — and that free-tier local mode keeps everything on-device |
| **Terms of service + refund policy** | Required by Stripe checkout best practice; reduces disputes | Cancel-anytime, prorated-or-no-refund stated plainly |
| **Chrome-store rating leverage** | Social proof you already own | Embed live install count + star rating from the CWS listing (id `bikgignfnljpbmchlemkbbpboigodgap`) on the landing page; deep-link "Add to Chrome" |
| **Testimonials / case study** | Segment buyers trust seller-community voices (every comp's site leads with them) | Recruit 3–5 beta users of the dashboard for quotes with first name + seller type ("OA seller, UK"); a single "found X profitable ASINs in one storefront scan" mini-case beats generic praise |
| **Identity & support** | Faceless tools convert poorly here | Real support email, a changelog page (proves active development), and an "about" line about who builds ProScan |
| **Security posture line** | Cheap credibility | "Auth by Firebase/Google, payments by Stripe — we never see your card number"; HTTPS-only, no Amazon credentials ever requested |
| **Pricing-page honesty** | Comp pages are simple; complexity reads as scammy | Show free-tier limits exactly, no "contact us" tiers, FAQ covering cancel/export/delete |

### Suggested sequencing

1. Privacy policy + ToS + Limited Use disclosure (blockers for everything else, and the CWS listing should link them now).
2. Pricing page with Ladder A + 14-day Pro trial wired to Stripe Checkout + customer portal.
3. CWS rating/install badge + 3 testimonials on the landing page.
4. Data-deletion self-serve flow before (not after) the first paid signup.
