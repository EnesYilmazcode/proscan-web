# Billing Runbook — alerts, the kill switch, and the hygiene rules that prevent the surprise bill

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** This entire runbook is moot. The owner will never attach a credit card to Firebase — there is NO Blaze plan and NO Cloud Functions, so there are no budget alerts to set, no billing kill switch, and no `mintExtensionToken`/B3. The project stays on Spark; the extension authenticates to Firebase directly via extension-native `firebase/auth/web-extension`. Owner gates are B1+B2 only (B3 removed). Kept for history; ignore the procedures below.

_Last updated: 2026-06-10 (verified against live pricing). Companion to decisions D1/D12 and owner task B3 in `TASKS.md`. The authoritative cost model is `architecture/data-model.md` §7; this page is what keeps reality at or below it._

## 1. Layered budget alerts (set the day Blaze goes on — B3)

Console path: [console.cloud.google.com](https://console.cloud.google.com) → Billing → **Budgets & alerts** → Create budget, scoped to the `proscanbot` project. Set **three** budgets, not one:

| Budget | Type | What it means when it fires |
|---|---|---|
| **$5** | Actual spend | Something is non-zero — look this week |
| **$10** | Actual spend | The cost model is wrong — look today |
| **$25** | Forecast | Projected month-end spend will blow past expectations — look **now** |

The forecast alert is the early-warning layer: it fires when the trajectory crosses the line, typically days before actual spend gets there.

## 2. The kill switch (read this before you ever need it)

**Budget alerts notify; they never stop billing.** No threshold, however configured, caps spend by itself. The hard stop is detaching the billing account from the project:

> Console → Billing → **Account management** → find `proscanbot` → ⋮ → **Disable billing on project**

The app goes down (Functions and everything Blaze-gated stop working) — acceptable; that is the point of a kill switch.

Optional automated backstop: Google's documented budget → Pub/Sub → Cloud Function recipe that auto-detaches billing when a threshold is crossed (cloud.google.com/billing/docs/how-to/notify, "disable billing" example). If set up, put it at **~$50** — far above any alert, so it only ever fires on a genuine runaway.

## 3. `onSnapshot` hygiene (the surprise-bill class)

Every dashboard listener is metered Firestore reads; a leaked or duplicated listener is exactly how hobby projects produce three-digit bills. Rules for **all** dashboard code:

- **One listener per mounted view.** Not per component instance, per view.
- **Always detach on unmount** — return the unsubscribe function from the effect.
- **Never attach a listener in render**, or in an effect without a dependency array.
- **One-shot `getDocs`** for non-realtime surfaces (Run Inbox, Seller Discovery) — they don't need live updates.
- **`getDoc`** for history/charts — date-keyed history docs don't change retroactively.
- **Log snapshot read counts in dev builds** so a regressed listener is visible before it ships.
- **Never subscribe to the whole `products` collection.** Queries are always scoped (watchlist, run, source).

## 4. M3 Functions deploy hygiene

- **Enable the Firebase CLI's Artifact Registry cleanup policy on the first `functions` deploy** (the CLI offers it; accept). Without it, stale container images accumulate storage charges indefinitely.
- **Never create a default Cloud Storage bucket.** Nothing in the architecture needs one.
- **Cloud Scheduler's free tier is 3 jobs per *billing account*** — shared across every project on the card, not per project. Budget scheduled jobs accordingly.

## 5. Bundle budget (Hosting transfer)

Hosting's free transfer is **360 MB/day**. Defenses:

- Keep the `/dashboard` route bundle **code-split** — the marketing site must not pay for the dashboard's JS and vice versa.
- Hashed assets stay on **immutable cache** (already configured in `firebase.json`), so repeat visitors cost ~nothing.
- If Recharts pushes the bundle over budget, **`lightweight-charts`** (~45 KB) is the documented fallback (`research/technical-firebase.md`).
