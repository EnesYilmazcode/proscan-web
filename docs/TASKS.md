# ProScan Task Breakdown — by who has to do it

_Last updated: 2026-06-10. Organized the way the owner asked: by how much of it needs him. Milestones (M1–M7) are defined in `ROADMAP.md`._

**The headline:** of everything in the roadmap, the owner's total required involvement is roughly **15 minutes of console clicks, two Chrome Web Store submission approvals, one Stripe account setup at monetization time, and the decisions in `decisions.md` (all of which have defaults)**. Everything else is autonomous agent work.

---

## Tier A — Fully autonomous (zero owner involvement)

The Firebase CLI on this machine is already logged in as the owner, so even deploys are autonomous. Per-milestone:

### Can start immediately (M1 — nothing blocks any of this)
- [ ] `firebase.json` rewrites for `/dashboard/**`; React + Vite + TypeScript SPA scaffold built to `dist/dashboard/`
- [ ] Firebase Emulator Suite (Auth + Firestore + Functions) in dev scripts; fixture data seeded to `data-model.md` shapes
- [ ] Extension hygiene: delete dead `server/` tree + `syncToServer()` localhost POST; remove legacy v1 root files; esbuild pipeline + allowlisted zip packaging (build fails if legacy files appear); Jest suite green on new layout
- [ ] Selector + AOD verification spike (~1 day, time-boxed): live-DOM verify every planned selector, fresh Jest fixtures first, empirical AOD throttle test at 2s+jitter
- [ ] Draft privacy policy + ToS as site pages (CWS hard prerequisite for M3)
- [ ] Brand `404.html`; one deploy through the new pipeline (site stays byte-identical)
- [ ] Attempt `firebase firestore:databases:create --location nam5` via CLI — if the disabled-API 403 blocks it, that becomes owner task B1

### M2 (after B1 + B2 unlock)
- [ ] Auth screens (email + Google), profile menu, session handling
- [ ] Security rules v1 with per-field validation + composite indexes + index exemptions; `firebase deploy --only firestore`; `@firebase/rules-unit-testing` suite
- [ ] First-sign-in `workspaces/{wid}` bootstrap; empty states; landing→dashboard links

### M3 (after D1/B3 Blaze; ends in B5 store submission)
- [ ] Extension prerequisites: `scrapeRun` entity, numeric price, ASIN dedup + sponsored flag + organic rank, spread-correctness fixes, `spreadResults` reset
- [ ] BYO-key Gemini settings UI (D4 default) — pairs with owner key rotation B4
- [ ] Sync writer: queue → `firebase/firestore/lite`, per-page `writeBatch`, `prev`/`delta` stamping from local `lastValues`, `chrome.alarms` flush
- [ ] `mintExtensionToken` callable + `signInWithCustomToken` handoff + `externally_connectable` + linked/unlinked UI
- [ ] Local-history import as synthetic run (D9)
- [ ] CWS package: zip, listing copy, data-disclosure answers, staged-rollout plan — everything up to the owner's upload click
- [ ] Enable Firestore PITR / weekly export once Blaze is on

### M4 (parallel with M3, against the emulator)
- [ ] All six MVP dashboard features (run inbox, watchlist, delta board + history drawer, spread + Max Buy, XLSX export) per `product/feature-catalog.md`

### M5–M7
- [ ] Everything in the v1/v2/Later tiers except the owner gates listed below — including the second (and final planned) extension batch for M5

---

## Tier B — One-time owner actions (with exact steps)

| # | Action | When | Time | Steps |
|---|---|---|---|---|
| **B1** | **Create Firestore database** (only if my CLI attempt 403s) | M2 gate | ~2 min | [console.firebase.google.com](https://console.firebase.google.com) → `proscanbot` → Build → Firestore Database → Create database → location **nam5** → production mode (I deploy the real rules) |
| **B2** | **Enable Auth providers** | M2 gate | ~3 min | Console → Authentication → Get started → Sign-in method → enable **Email/Password** and **Google** (pick your support email) |
| **B3** | **Upgrade to Blaze + $10 budget alert** (decision D1) | M3 gate | ~5 min | Console → bottom-left Spark "Upgrade" → attach billing account (card) → then Billing → Budgets & alerts → $10/mo. Expected bill ~$0 at current scale |
| **B4** | **Gemini key check + rotation** | Check **now**; rotate with the M3 release (see note) | ~5 min | [aistudio.google.com](https://aistudio.google.com) → API keys → check usage for anomalies today. Rotation kills the chatbot for all ~233 current users until the BYO-key release ships, so default timing is: rotate the moment the M3 extension version is live (or immediately if usage looks abused — your call, decision D4) |
| **B5** | **CWS submission approvals** (×2: M3 batch a, M5 batch b) | M3, M5 | ~10 min each | I hand you a built zip + listing copy + exact data-disclosure answers; you upload in the [CWS developer dashboard](https://chrome.google.com/webstore/devconsole), set staged rollout, submit |
| **B6** | **Share CWS dashboard stats** (weekly actives, install trend) | Anytime, informs D3 | ~2 min | Developer dashboard → ProScan → Stats screenshot. Public listing already verified: 233 users, 4.9★/8 ratings, v2.0 |
| **B7** | **Stripe setup** | M6 gate | ~30 min | Create Stripe account → restricted API key + webhook signing secret to me → enable customer portal. I build Checkout, the webhook Function, and the pricing page |
| **B8** | **Firestore TTL toggle** (or approve a gcloud install and I script it) | M6 | ~2 min | Console → Firestore → TTL → policy on `expireAt` for the two cold collections (exact names in `data-model.md` §8) |
| **B9** | *(Optional)* **Custom domain** (decision D2) | Before M3 if ever | varies | Buy domain → console Hosting custom-domain flow → tell me; I update manifest + configs (costs one extra CWS review) |

**Bottleneck note:** B1+B2 are the only things between "now" and a working sign-in. B3 is the only thing between sign-in and extension sync. Everything else can proceed around you.

---

## Tier C — Decisions only the owner can make

All eleven live in **`decisions.md`** with defaults — D1 (Blaze), D2 (domain), D3 (pricing ladder), D4 (chatbot fate), D5 (variation meaning), D6 (dropping "clients"), D7 (BSR deferral), D8 (rename), D9 (history import), D10 (OAuth fallback), D11 (unlimitedStorage). A one-line reply ("defaults, except D3 = ladder B") unblocks everything decision-gated.

---

## Suggested immediate sequence

1. **Me, today, no input needed:** the whole M1 list above.
2. **You, ~5 min when convenient:** B1 + B2 (Firestore + Auth providers) → unlocks M2 auth.
3. **You, ~7 min:** B3 (Blaze) + B4 usage check → unlocks M3 sync.
4. **Me:** M2 → M3 + M4 in parallel → hand you the B5 zip.
5. MVP live; M5 begins.
