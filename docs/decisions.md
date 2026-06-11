# ProScan Decision Register

_Last updated: 2026-06-10. Every decision only the owner can make, in one place — with a default, the options, the consequence, and the milestone by which it must be locked (milestones defined in `ROADMAP.md`). Decisions marked ⏳ block work when their milestone arrives; nothing before that milestone is blocked._

**How to use this:** reply with something as short as "D1 yes, D3 ladder A, D4 option a" and everything else proceeds on defaults.

| # | Decision | Default (what happens if you just say "go") | Lock by |
|---|---|---|---|
| D1 | **Blaze billing consent** | Upgrade `proscanbot` to Blaze (attach card) + $10/mo budget alert | M3 |
| D2 | **Canonical domain** for `externally_connectable` + Hosting | `proscanbot.web.app` now; custom domain can be added later via a manifest update + re-review | M3 |
| D3 | **Pricing ladder** | Ladder A: Free forever + Pro $14.99/mo or $119/yr | M6 |
| D4 | **Chatbot fate at Gemini-key rotation** | (a) Build the BYO-key settings UI in the same release that removes the shared key | M3 (rotation itself: ASAP) |
| D5 | **"Variation analysis" meaning** | Statistical spread (already MVP) **plus** the cheap parent-ASIN variation-hint selector in v1 | M5 |
| D6 | **Dropping the "clients" concept** from the data model | Approve: storefronts/sources replace clients/competitors | M2 |
| D7 | **BSR / product-page fetch deferral** | Accept deferral; revisit after v1 ships | M5 review |
| D8 | **Public rename away from "scraper"** | Keep "ProScan" branding everywhere public; CWS listing copy de-emphasizes "scraper" at the next listing edit | M3 |
| D9 | **Import existing users' local scrape history on first link** | Yes — one-time synthetic `source.type:'import'` run | M3 |
| D10 | **Extension-only sign-in (OAuth fallback)** | Defer — dashboard token handoff only | M3 |
| D11 | **`unlimitedStorage` permission in the sync release** | Add it (queue + cached history can exceed the 10 MB cap) | M3 |
| D12 | **Firestore database location** | Cheap **single-region** `us-central1`, not the `nam5` multi-region the docs assumed | M2 (location is **irreversible** at creation) |

---

## Details

### D1 — Blaze billing consent ⏳ (blocks extension sync at M3)
The final architecture needs exactly one Cloud Function: `mintExtensionToken`, the callable that turns the dashboard's session into a custom token the extension can sign in with (`signInWithCustomToken`). Cloud Functions require the Blaze plan, which requires a billing account (credit card).
- **Cost reality:** Blaze includes the same free allowances as Spark; expected bill ~$0 until hundreds of active users (~$5–8/mo at 100 users, ~$25–70/mo at 1,000 — authoritative model in `docs/architecture/data-model.md` §7). A $10/mo budget alert gets set the same day.
- **If declined:** the extension falls back to a pushed raw ID token that dies after ~1 hour — background sync stops whenever the dashboard isn't being reopened. Everything else (auth, dashboard, manual flows) still works on Spark.

### D2 — Canonical domain ⏳ (hardcoded in the extension manifest at M3)
`externally_connectable.matches` must list exact origins. Default is `https://proscanbot.web.app/*` (+ `firebaseapp.com` twin). If you ever want `app.proscan.something`, that's: buy domain → Hosting custom-domain setup (console) → manifest update → CWS re-review. Adding later is fine; changing later costs one extension release.

### D3 — Pricing ladder (M6; no code depends on it before then)
Three costed ladders in `docs/research/monetization-and-positioning.md`:
- **A (default):** Free forever (2 storefronts, 30-day history) + **Pro $14.99/mo / $119/yr** (unlimited storefronts, full history, alerts/digest, bulk exports).
- **B:** $9.99 / $24.99 three-tier.
- **C:** $19 / $49 with a team tier (pairs with VA Seats, currently parked).
Free-tier limits (2 storefronts / 30 days / ~1,000 synced products/mo) are part of this decision; enforcement design is in `data-model.md` ("Plan-quota enforcement design note") — honest caveat: free-tier gates are primarily dashboard-read-path enforced; a determined client can over-sync.

### D4 — Chatbot fate at key rotation (rotation is urgent regardless)
The published extension ships a base64-hardcoded Gemini API key used by **all** users — the README's claimed BYO-key settings UI does not exist. The key must be rotated (owner action B4 in `TASKS.md`); the decision is what happens to the chatbot when it dies:
- **(a) default:** build the small settings UI (S effort) so users paste their own key — no feature clawback.
- **(b):** disable the chatbot with a changelog note until the server-side Catalog Copilot (parked) replaces it.
- **(c):** defer rotation — **not recommended**; it's a live shared-key incident with your billing/quota attached.

**2026-06-10 note:** Google cut Gemini API free-tier quotas ~50–80% on 2025-12-07 — 2.5 Flash reportedly as low as 20–250 req/day free, 2.5 Flash-Lite ~15 RPM / ~1,000 req/day — and the official limits table moved to the per-account AI Studio dashboard (https://ai.google.dev/gemini-api/docs/rate-limits). Consequence for option (a): the M3 BYO-key chatbot must default to a Flash-Lite-class model and handle 429s gracefully; re-verify the live quotas in AI Studio when building the settings UI.

### D5 — "Variation analysis": you said it, two readings exist
- *Statistical variation* — price-spread CV/IQR across sellers: **in MVP** (Spread & Max Buy).
- *Product variations* — parent/child ASINs ("+5 colors" hints, twister matrix): the cheap SERP variation-hint selector lands in v1 under the default; the full per-variation matrix stays deferred with the product-page fetch (D7).
If you only meant the statistical kind, say so and the selector gets dropped from v1.

### D6 — Dropping "clients" (sign-off on a quiet change)
Your original plan (`REVAMP_PLAN.md` §3) modeled `clients/` and `competitors/`. The research showed sellers organize by *storefront watched*, not by *client served*, and the final model (`data-model.md`) uses `workspaces/{wid}/sources/...`. This was reasoned but never explicitly approved — flagging it because the fleet dropped a concept you originally framed the product around. If you actually serve agency clients, say so and a `clientTag` lands on sources.

### D7 — BSR fetch deferral (a real product trade-off)
BSR/category is sellers' #1 buying input and ProScan doesn't capture it (it needs one product-page fetch per ASIN — a new scraping surface with Amazon Agent Policy exposure). The fleet's call: defer past v1, lean on review-velocity as the proxy, link Keepa per-ASIN. Accepting the default means accepting that gap consciously; the alternative is scheduling the PDP-fetch spike earlier and accepting the risk posture.

### D8 — Public rename
The repo is `AmazonSellerScraper`; the risk research recommends the public identity lead with "ProScan" and de-emphasize "scraper" framing. Repo rename is cosmetic and autonomous; CWS listing copy is an owner edit at the next submission.

### D9 — Local-history import
Existing users may have months of scrapes in `chrome.storage.local`. Default: on first account link, offer one-click import as a synthetic run through the standard upsert path. Declining means existing users start at zero, which undercuts the "history compounds" pitch.

### D10 — OAuth fallback
Should the extension work for users who never open the dashboard? Default: no (token handoff only; "Open dashboard to connect"). Adding `launchWebAuthFlow` sign-in later is additive.

### D11 — `unlimitedStorage`
The sync queue + local seen-set can brush the 10 MB `chrome.storage.local` cap on big storefronts. Adding the permission is one manifest line in the same M3 submission; it may contribute to a longer CWS review (covered in the release-engineering plan).

### D12 — Firestore database location ⏳ (irreversible the moment B1 clicks "create"; verified against live pricing 2026-06-10)
The docs assumed the `nam5` US multi-region; the default is now a cheap **single-region** location (`us-central1`). Owner task B1 in `TASKS.md` creates the database, and the location **cannot be changed afterward** — short of a full export/import migration to a new database.
- **Why:** single-region operation pricing runs roughly 30–45% below `nam5` ($0.06/100k reads, $0.18/100k writes at `nam5`; single-region cheaper — exact table at https://cloud.google.com/firestore/pricing). The entire cost model in `architecture/data-model.md` §7 is priced at `nam5` rates, so the single-region default shaves ~$20–25/mo off the worst case at 1,000 users — and the saving compounds forever.
- **Trade-off:** single-region availability SLA is 99.99% vs `nam5`'s 99.999%. For a $0-revenue product, acceptable.
- The `data-model.md` §7 numbers are **not** being re-derived; they stand as conservative upper bounds.
