# REVAMP_PLAN.md — ProScan Web App Revamp

Forward plan to turn ProScan from "static landing page + local-only extension" into an authenticated web app where users sign in, save client/competitor data, and have the extension sync that data per-user. Opinionated and concrete. Read `CONTEXT.md` first for the current-state facts this plan builds on.

---

## 1. Recommended Stack

**Go Firebase-native.** Firebase Auth + Firestore + Firebase Hosting, with a **Vite + React** dashboard mounted at `/dashboard`, keeping the existing static landing page untouched at `/`.

One-line justification: the Firebase project `proscanbot` and Hosting already exist, one SDK (`firebase/auth` + `firebase/firestore`) runs in **both** the SPA and the MV3 service worker, Firestore security rules give per-user authz with no backend to operate, and `onSnapshot` gives free realtime sync — "scan a product, see it in the dashboard instantly."

Explicitly rejected: **Clerk + Firestore** (worst effort-to-benefit — Firestore rules expect Firebase Auth tokens, forcing custom-token minting or a full API). Clerk + Postgres + an API is the right call **only** if the product later goes B2B (team-shared lists, Clerk Organizations/RBAC) or needs relational analytics Firestore models poorly. Not now.

---

## 2. Target Architecture (text diagram)

```
[Amazon tab]
  content script (scraper.js / offer-fetcher.js) scrapes products
        │ chrome.runtime.sendMessage  (internal)
        ▼
[Extension service worker  (MV3, stateless)]
  - buffers scrapes as a QUEUE in chrome.storage.local
  - holds short-lived Firebase ID token in chrome.storage.session
  - chrome.alarms drives periodic flush (no setInterval, no daemon)
        │
        │  writes directly to Firestore using the Firebase Auth ID token
        ▼
┌───────────────────────────────────────────────┐
│  FIREBASE  (project: proscanbot)               │
│   • Firebase Auth      → identity (user_id)    │
│   • Cloud Firestore    → per-user data         │
│   • Security Rules     → authz (uid == path)   │
│   • Hosting            → / (landing) + /dashboard (SPA)
└───────────────────────────────────────────────┘
        ▲                         ▲
        │ onSnapshot (realtime)   │ Firebase Auth session
        │                         │
[Web dashboard  app: /dashboard (Vite+React)] ────┘
  - user signs in (Firebase Auth)
  - on load: pushes a short-lived ID token to the extension
        │ chrome.runtime.sendMessage(EXT_ID, {type:"SET_AUTH", token})
        ▼            via externally_connectable
[Extension]  validates sender.origin → stores token → state "linked"
```

Auth lives in **Firebase Auth**. Data lives in **Firestore**, keyed by user UID. Both the extension and the dashboard are thin clients of the same Firebase project — no separate backend server to run. Security rules are the authorization layer.

---

## 3. Per-User Data Model (Firestore)

Everything nests under the signed-in user's UID so ownership is implied by the path and one security rule covers it all.

```
users/{uid}
  profile: { displayName, email, plan, createdAt }

users/{uid}/clients/{clientId}
  { name, domain, notes, createdAt }

users/{uid}/competitors/{competitorId}
  { clientId, name, productUrl, sourceSite:"amazon", asin, createdAt, updatedAt }

users/{uid}/products/{productId}          // one doc per scraped product
  { competitorId, clientId,
    asin, name, price, rating, reviewCount, isPrime, url,
    scrapedAt, scrapeRunId,                // batch id per scrape event
    spread: {                             // optional, from offer-fetcher
      sellerPrices:[number], sellerCount, minPrice, maxPrice,
      meanPrice, medianPrice, stdDev, coefficientOfVariation,
      absoluteSpread, interquartileRange, fetchedAt
    },
    opportunityScore, arbitrageScore       // derived, optional
  }
```

Notes:
- Maps cleanly onto the existing extension `Product` + `SpreadData` shapes from `CONTEXT.md` — the extension keeps scraping the same fields and just adds `userId` (implicit via path), `clientId`/`competitorId`, and `scrapeRunId`.
- `where('clientId','==',X)` answers "all competitors/products for a client" without joins.
- Add a top-level collection written by a Cloud Function later if cross-user/global analytics is ever needed.

### Security rules (covers all subcollections)
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
Harden later with per-field validation (`request.resource.data.name is string`, etc.). Because the extension authenticates with the same Firebase Auth token, these rules protect extension writes identically — no separate API-key surface to secure.

---

## 4. Extension ↔ Signed-In Website: Auth Sharing & Sync

### Auth handoff (recommended path)
1. Add to the extension manifest:
   ```json
   "externally_connectable": { "matches": ["https://proscanbot.web.app/*", "https://<your-custom-domain>/*"] }
   ```
   (List each first-party origin explicitly; wildcards like `https://*/*` are rejected. Leave `ids` out.)
2. On dashboard load, the signed-in page reads/refreshes its Firebase ID token and calls `chrome.runtime.sendMessage(EXT_ID, { type:"SET_AUTH", token })`. The page must know the published `EXTENSION_ID` and feature-detect with a ping/timeout to know if the extension is installed.
3. The extension listens with `chrome.runtime.onMessageExternal` (NOT `onMessage`), **validates `sender.origin`** as defense-in-depth, and stores the token in `chrome.storage.session`. State flips to "linked".
4. **Firebase persistence in the worker:** set Auth persistence to `indexedDBLocalPersistence` so the session survives service-worker restarts. Re-push the token on every dashboard load; before expiry, the extension refreshes via the Firebase SDK. On refresh failure (logged out) the extension shows "Open dashboard to reconnect".
5. Fallback only if the extension must work without the user ever opening the site: `chrome.identity.getAuthToken` (Google) or `launchWebAuthFlow` → `GoogleAuthProvider.credential(...)` → `signInWithCredential`.

Principle: never store long-lived refresh tokens or passwords in `chrome.storage.local` (readable from disk/devtools). Short-lived ID tokens only, in `chrome.storage.session`.

### Data sync (direct, background-safe)
- **Path A — extension writes Firestore directly** using the Firebase ID token. The extension buffers scrapes as a queue in `chrome.storage.local`, then flushes documents under `users/{uid}/...` on a `chrome.alarms` schedule (every 1–5 min) and immediately after large scrapes, using idempotency (doc id derived from `asin`+`scrapeRunId`) so retries are safe. Remove from queue on success.
- The dashboard reads the same per-user docs via `onSnapshot` → instant appearance, no polling, no open-tab requirement for writes.
- **MV3 discipline:** all listeners (`onMessageExternal`, `onAlarm`, `onInstalled`) registered synchronously at top level; no reliance on in-memory globals; rehydrate token + queue from storage on each wakeup; assume the worker dies between events; `chrome.alarms` not `setInterval`.

---

## 5. Phased Build Plan (landing page stays live throughout)

**Phase 0 — Website hygiene (no behavior change).** Stop editing `dist/` by hand. Create `src/`, move `index.html` / `style.css` / extracted inline JS there, add `package.json` + Vite. Keep building the existing landing page to `dist/`. Deploy still works; nothing user-visible changes. Brand the `404.html`.

**Phase 1 — Hosting layout for coexistence.** Configure Hosting so the static landing page owns `/` and a SPA owns `/dashboard/**`:
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [{ "source": "/dashboard/**", "destination": "/dashboard/index.html" }]
  }
}
```
Landing page (`public/index.html`) served at `/`; Vite app built with `base:'/dashboard/'` output to `public/dashboard/`. Same domain, one deploy, no CORS.

**Phase 2 — Auth + empty dashboard.** Stand up Vite + React + React Router at `/dashboard`. Add Firebase Auth (email + Google sign-in). Unauthenticated visitors to `/dashboard` see the sign-in screen; landing page links to `/dashboard`. Define Firestore + the single security rule above. No data UI yet.

**Phase 3 — Client/competitor CRUD.** Build dashboard UI to create clients, competitors, and view products, reading/writing the Firestore model from §3 via `onSnapshot`. This is usable even before the extension is wired.

**Phase 4 — Extension linking.** Add `externally_connectable` + `onMessageExternal` to the extension; implement the dashboard→extension token push and the "linked/unlinked" UI state. Add Firebase SDK to the service worker with `indexedDBLocalPersistence`.

**Phase 5 — Extension sync.** Refactor the extension's local scrape store into a queue; replace the old unauthenticated `localhost:8000` `POST` with direct authenticated Firestore writes under `users/{uid}/...`, alarm-driven and idempotent. Verify realtime appearance in the dashboard.

**Phase 6 — Hardening.** Per-field security-rule validation, rate/size caps on writes, token-refresh edge cases, error/empty states, retire the experimental `server/` folder, brand-match all pages, CI: `npm run build` → `firebase deploy --only hosting`.

Each phase ships independently; the marketing site at `/` is never taken down.

---

## 6. Open Decisions (user must choose)

1. **Stack fork — confirm Firebase-native vs. Clerk.** Recommendation is Firebase Auth + Firestore. Choose Clerk + Postgres + API **only** if you expect near-term B2B/team-shared competitor lists (Clerk Organizations) or heavy relational analytics. Picking Clerk means committing to a backend API and abandoning the working Firebase setup. *Default: Firebase-native.*

2. **Where source lives / build tool.** Confirm the `src/` → `dist/` (or `public/`) split with **Vite**, ending the "source in `dist/`" footgun. Alternative bundlers (webpack/Parcel) are viable but Vite is recommended. *Default: Vite, source in `src/`.*

3. **Domain for `externally_connectable` + Hosting.** Decide the canonical first-party origin(s) to whitelist — `proscanbot.web.app` / `proscanbot.firebaseapp.com` only, or a custom domain (e.g. `app.proscan.…`). This must be fixed before Phase 4 because it is hardcoded in the manifest and the dashboard's `EXTENSION_ID` handoff. *Needs a decision.*

4. **Extension auth model — token-handoff vs. independent OAuth.** Default is dashboard→extension token push (user visits the site once to link). Decide whether the extension must also work for users who never open the dashboard; if yes, additionally implement `chrome.identity.launchWebAuthFlow` / `signInWithCredential`. *Default: token-handoff only, OAuth fallback deferred.*
