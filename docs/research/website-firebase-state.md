# Website & Firebase State Audit (post-Phase-0)

_Last updated: 2026-06-09 — produced by the planning fleet. Amended 2026-06-10 after completeness review (Blaze requirement, gcloud/TTL exception)._

Audit of `proscan-web` (the website repo) and the `proscanbot` Firebase project, taken with the Firebase CLI on the owner's machine. No mutating commands were run — every probe below was read-only.

---

## 1. Repo state

`C:\Users\galax\Downloads\Projects\proscan-web`, branch `main`, working tree clean, remote `https://github.com/EnesYilmazcode/proscan-web.git`.

| Commit | Date | Subject |
|---|---|---|
| `18c2fe7` | 2026-06-09 23:10 | Merge remote-tracking branch 'origin/main' |
| `0429cc3` | 2026-06-09 23:10 | Phase 0: relocate site into version control + Vite build pipeline |
| `f70e9a0` | 2026-06-09 23:08 | Initial commit |

### Files that matter

| File | State |
|---|---|
| `package.json` | name `proscan-web` v0.1.0, `"type": "module"`. Scripts: `dev`, `build`, `preview`, `deploy` (= `vite build && firebase deploy --only hosting`). **Only dependency: `vite ^6.0.0` (dev).** No React, no `firebase` SDK, nothing else. |
| `vite.config.js` | Minimal: `build.outDir = 'dist'`, `emptyOutDir: true`. Single-entry (root `index.html`). |
| `firebase.json` | Hosting only: `"public": "dist"` + default ignores. **No rewrites, no `firestore` section, no rules/indexes references.** |
| `.firebaserc` | `{ "projects": { "default": "proscanbot" } }` |
| `index.html` | Static marketing landing page (hero with animated browser mockup, features, CTA). All CTAs link to the Chrome Web Store listing (`bikgignfnljpbmchlemkbbpboigodgap`). Loads `/src/main.js` as module. No auth, no dashboard, no Firebase SDK anywhere. |
| `src/main.js` | 127 lines: hero scan-animation loop (IntersectionObserver + setInterval) and smooth-scroll for `#` anchors. Pure DOM, no framework. |
| `src/style.css` | ~389 lines of plain CSS for the landing page. |
| `public/` | `icon128.png`, `404.html`, `googlec345eb80712acc64.html` (Google site verification) — copied verbatim to `dist/`. |
| `CONTEXT.md`, `REVAMP_PLAN.md` | Current-state reference and the agreed forward plan (Firebase Auth + Firestore + Vite/React SPA at `/dashboard`, extension token handoff). |
| `.gitignore` | Ignores `dist/`, `.firebase/`, `node_modules/`, `.env`. `.firebaserc` is tracked. |

Phase 0 is exactly as advertised: a real `src/ -> dist/` pipeline around the unchanged static page. **Nothing auth- or Firestore-related exists in the repo yet** — no `firestore.rules`, no `firestore.indexes.json`, no SDK config module, no `/dashboard` entry.

One timing note: the live Hosting release is dated **2026-02-10**, while the Phase 0 commit landed **2026-06-09**. The Phase-0-built `dist/` has not been deployed yet (the page content is intentionally byte-identical, so this is cosmetic, but the first `npm run deploy` will be the pipeline's first real deploy).

---

## 2. Firebase tooling & project state (exact command results)

All commands run 2026-06-09 (local) on the owner's machine, non-interactive.

| Command | Result |
|---|---|
| `firebase --version` | `15.8.0` |
| `firebase login:list` | `Logged in as enesyilmaz5157@gmail.com` |
| `firebase projects:list` | 10 projects on the account; **`proscanbot` exists**, project number `886322190589`, Resource Location ID `[Not specified]` |
| `firebase apps:list --project proscanbot` | Exactly one app: `proscanbot`, WEB, App ID `1:886322190589:web:496bad0e5793cf90eec694` |
| `firebase apps:sdkconfig WEB 1:886322190589:web:496bad0e5793cf90eec694 --project proscanbot` | Succeeds — full config below |
| `firebase firestore:databases:list --project proscanbot` | **FAILS, HTTP 403**: "Cloud Firestore API has not been used in project proscanbot before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=proscanbot" |
| `firebase auth:export <tmp> --project proscanbot` | **FAILS, HTTP 400 `CONFIGURATION_NOT_FOUND`** — Firebase Auth has never been initialized on this project (no providers ever enabled) |
| `firebase hosting:sites:list --project proscanbot` | One site: `proscanbot`, default URL `https://proscanbot.web.app`, linked to the web app above |
| `firebase hosting:channel:list --site proscanbot` | `live` channel, last release **2026-02-10 17:06:50**, never expires |
| `HEAD https://proscanbot.web.app` (Invoke-WebRequest) | `200`, `Content-Length: 15113`, `Last-Modified: Tue, 10 Feb 2026` — the landing page is live |
| `gcloud --version` | **Not installed** (CommandNotFoundException) — `gcloud services enable ...` is not an available path on this machine |

### Web SDK config (already registered — retrievable by CLI, no console visit needed)

```json
{
  "projectId": "proscanbot",
  "appId": "1:886322190589:web:496bad0e5793cf90eec694",
  "storageBucket": "proscanbot.firebasestorage.app",
  "apiKey": "AIzaSyAp0HrcvFwpMxrlqbxa9xjUvwGoTa7QpUU",
  "authDomain": "proscanbot.firebaseapp.com",
  "messagingSenderId": "886322190589",
  "measurementId": "G-0G9RNLMFR9"
}
```

Notes on this config:

- This is **public client config**, safe to commit in source (Firebase web API keys are identifiers, not secrets; access control comes from security rules — https://firebase.google.com/docs/projects/api-keys).
- `measurementId` is present, so Google Analytics was linked when the app was registered.
- `authDomain: proscanbot.firebaseapp.com` works for the agreed dashboard-side sign-in; `proscanbot.web.app` and `proscanbot.firebaseapp.com` are on Auth's authorized-domains list by default once Auth is enabled.

### Interpretation

- **Hosting: fully working** (project, site, a live release, deploy auth all in place). `npm run deploy` should work today.
- **Firestore: does not exist.** The API is disabled and no database has been created. The project also has **no default GCP resource location**, so a location must be chosen at database creation time (`nam5` US multi-region is the sensible default for this product).
- **Auth: never initialized.** `CONFIGURATION_NOT_FOUND` means not a single sign-in provider has ever been enabled.
- **CLI session:** the machine is already logged in as the project owner, so agent-run `firebase` commands against `proscanbot` authenticate without any interactive step.

---

## 3. Readiness table

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** The "Blaze upgrade" row below and **note (c)** (and §4 bottom-line item 3) are dropped. There is NO Blaze plan and NO Cloud Functions, so the `mintExtensionToken` callable does not exist. The extension authenticates to Firebase **directly** via extension-native `firebase/auth/web-extension`, holding its own refresh token — no token mint, no Function, no billing account. The owner's one-time list collapses to the two console toggles (create Firestore + enable Email/Password & Google). Ignore every Blaze/Function reference in this section.

Legend: **Exists** = verified working today. **Agent** = an autonomous coding agent can do it alone on this machine (CLI/code only, no browser). **Owner** = requires the owner in the Firebase console (or an interactive CLI session).

| Item | Exists today | Agent can do alone | Owner must do |
|---|---|---|---|
| Firebase project `proscanbot` | Yes | — | — |
| Firebase CLI installed + logged in (owner account) | Yes (v15.8.0, enesyilmaz5157@gmail.com) | — | — |
| Hosting site + live landing page | Yes (`proscanbot.web.app`, release 2026-02-10) | Redeploys via `npm run deploy` | — |
| Web App registration + SDK config object | Yes (`1:...:web:496bad...`) | Retrieve any time via `firebase apps:sdkconfig` | — |
| Enable Cloud Firestore API | **No** (403) | Maybe — see note (a) | One click on the enable URL if the CLI path fails |
| Create Firestore database `(default)` + pick location | **No** | Maybe — `firebase firestore:databases:create "(default)" --location nam5`, see note (a) | Console fallback: Build → Firestore → Create database (~2 min; creating in console also enables the API) |
| Firestore security rules + indexes | No (no files in repo) | Yes — write `firestore.rules`/`firestore.indexes.json`, add `firestore` block to `firebase.json`, `firebase deploy --only firestore` (after DB exists) | — |
| Initialize Firebase Auth (first provider) | **No** (`CONFIGURATION_NOT_FOUND`) | No — see note (b) | **Yes**: console → Build → Authentication → Get started |
| Enable Email/Password provider | No | Not practically — note (b) | **Yes** (console toggle, ~1 min) |
| Enable Google sign-in provider | No | No — console auto-provisions the OAuth client; REST path requires manual OAuth client setup, note (b) | **Yes** (console toggle, ~1 min) |
| Auth authorized domains for `*.web.app` / `*.firebaseapp.com` | n/a until Auth exists | — | Nothing — defaults cover both; only a future custom domain needs adding (console) |
| Blaze upgrade (attach billing account + $10/mo budget alert) | Not done | — | **Yes** — the final architecture's one callable Function (`mintExtensionToken`) requires it — see note (c) |
| Vite+React SPA at `/dashboard` (multi-entry build, rewrites in `firebase.json`) | No | Yes — pure code + `firebase deploy --only hosting` | — |
| Firebase JS SDK wiring (auth + firestore) in site and extension | No | Yes — config object above is already in hand | — |
| Extension `externally_connectable` + token handoff + queue (other repo) | No | Yes (code), but ships only via Chrome Web Store review | **Yes** — owner submits the new extension version to CWS |
| `gcloud` CLI | Not installed | Not needed for the critical path — one exception: Firestore TTL policies, see note (d). Agent can install gcloud for the two TTL commands if the owner approves the install | Alternative: enable TTL from the Firestore console UI instead (~2 min, no install) |
| Firestore TTL policies (`expireAt` on `pages` + `offerSnapshots` collection groups) — Phase 5 | No | Only via `gcloud` (two commands), after owner approves the install — note (d) | Console alternative: Firestore → TTL → add policy per collection group (~2 min) |

### Notes — what is scriptable vs console-only

**(a) Firestore creation.** `firebase firestore:databases:create` exists in CLI 15.8.0 (verified via `--help`; requires `--location`, e.g. `nam5`). Untested here because this audit made no mutations. Recent firebase-tools versions attempt to enable required Google APIs automatically when the signed-in account has permission (the logged-in account is the project owner, so it does); if the command still surfaces the 403, the owner clicks the enable URL from §2 once and the agent re-runs the command. Either way this is a minutes-scale, one-time step, and the **console "Create database" flow enables the API as a side effect**, making it the zero-ambiguity fallback.

**(b) Auth providers are effectively console-only.** There is no `firebase` CLI command to enable sign-in providers. Email/password is technically togglable via the Identity Toolkit Admin v2 REST API (`projects.updateConfig`, https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig) and Google via `projects.defaultSupportedIdpConfigs.create` (https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects.defaultSupportedIdpConfigs/create), but the REST path for Google requires supplying an OAuth client ID/secret that the **console flow auto-provisions for you**. For a one-time, two-toggle task the console is strictly less work and less error-prone. Owner's whole Auth checklist: open https://console.firebase.google.com/project/proscanbot/authentication, click Get started, enable **Email/Password**, enable **Google** (pick the support email when prompted). ~3 minutes total.

**(c) Blaze is required — by exactly one Cloud Function.** _(Amended 2026-06-10 after completeness review — an earlier draft claimed no Blaze was needed.)_ The final architecture (`docs/architecture/platform-architecture.md`) requires **one callable Cloud Function, `mintExtensionToken`** (Admin SDK `createCustomToken(uid)`, ~20 lines), for the extension auth handoff — and Cloud Functions of any gen are Blaze-only (https://firebase.google.com/pricing). Everything else remains client-SDK-only (Auth + Firestore + Hosting, all Spark-eligible). Blaze includes the same no-cost allowances as Spark — Firestore's 1 GiB storage and 50K reads / 20K writes / 20K deletes per day — so the **expected bill is ~$0 at current scale**; the owner should set a **$10/month budget alert** when attaching the billing account. **If the owner declines Blaze:** the custom-token handoff is impossible, so the extension falls back to a pushed raw ID token that **expires after ~1 hour** — background sync dies whenever the dashboard isn't being opened regularly. Everything else (auth, dashboard, manual flows) still works on Spark.

**(d) Firestore TTL policies — the one `gcloud` exception.** `docs/architecture/data-model.md` §8 enables TTL on the `pages` and `offerSnapshots` collection groups at Phase 5 via `gcloud firestore fields ttls update expireAt --collection-group=pages --enable-ttl` (and the same for `offerSnapshots`). The firebase CLI has no TTL command, so the blanket "do not install gcloud" guidance has exactly this exception: either the **owner enables both policies from the Firestore console UI** (Firestore → TTL, ~2 minutes), or the **agent installs gcloud and runs the two commands** — agent-doable if the owner approves the install. _Added 2026-06-10 after completeness review._

---

## 4. Bottom line

> ⚠️ **SUPERSEDED (2026-06-13, no-card pivot):** Item 3 below (Blaze upgrade for `mintExtensionToken`) is dropped — no card, no Blaze, no Cloud Functions. The extension authenticates directly via extension-native `firebase/auth/web-extension`. The owner's real list is **two items (~5 min)**: create Firestore + enable Auth providers. Ignore item 3.

Owner's one-time to-do list is **three items (~10 minutes)**:

1. **Create the Firestore database** (Build → Firestore → Create database, location `nam5`) — or approve the agent attempting `firebase firestore:databases:create "(default)" --location nam5` first and only intervene if the API-enable 403 blocks it.
2. **Enable Auth providers** (Build → Authentication → Get started → Email/Password + Google).
3. **Upgrade the project to Blaze** by attaching a billing account, and set a **$10/month budget alert** — required for the `mintExtensionToken` callable Function (note (c)). Blaze keeps the same free allowances; expected bill ~$0 at current scale. Declining this degrades only the extension auth handoff: a pushed raw ID token expiring after ~1 hour, so background sync dies without regular dashboard visits — auth, dashboard, and manual flows still work on Spark.

One later, minor toggle at Phase 5: enable the two Firestore TTL policies from the console (~2 minutes), unless the owner approves a one-time `gcloud` install so the agent can run the two commands (note (d)).

Everything else in the REVAMP_PLAN critical path — React/Vite dashboard, SDK config wiring, security rules authoring and deploy, hosting rewrites, hosting deploys, and all extension-side code — is doable by an autonomous agent on this machine with the already-authenticated CLI. The only other owner-gated step in the whole program is outside Firebase entirely: publishing the updated extension through Chrome Web Store review.
