# ProScan Firestore Data Model

_Last updated: 2026-06-09 — produced by the planning fleet._

The definitive Firestore schema for the ProScan platform. Companion to `docs/architecture/platform-architecture.md` (system design, sync pipeline, auth). Supersedes REVAMP_PLAN §3. Hard limits this design is shaped around: 1 MiB max document size (https://firebase.google.com/docs/firestore/quotas), the 40,000-index-entries-per-document ceiling and per-element index write amplification on map/array fields (https://firebase.google.com/docs/firestore/best-practices), and per-document read billing regardless of doc size (https://firebase.google.com/docs/firestore/pricing).

---

## 1. Design principles

1. **ASIN is the entity; a scrape is an observation.** One canonical doc per ASIN per workspace, upserted forever. Runs record observations in per-page chunks; they never create per-product docs.
2. **Three storage temperatures per ASIN:** hot (`products/{asin}`: latest + prev + delta + lead state, ~1.5 KB, 1 read per table row), warm (`history/daily`: one date-keyed map doc, 1 read per chart), cold (run page chunks + raw offer snapshots, full fidelity, TTL 400 days).
3. **Write-only extension, value-complete writes.** Every extension write is `set(..., {merge:true})` of absolute values or `arrayUnion` — idempotent under at-least-once retry. No `increment()` anywhere in the sync path. Anything needing "previous value" knowledge is computed at enqueue time from the extension's local `lastValues` map and frozen into the queue entry.
4. **Sponsored placements are recorded, never aggregated.** Page chunks keep every placement (`sp` flag + rank) for diff/rank fidelity; product and history docs get exactly one write per ASIN per run, first organic occurrence wins.
5. **Scoped reads only.** The dashboard never subscribes to the whole `products` collection (at the 60-storefront reference scale that is ~24k docs ≈ 36 MB). Every table view is a scoped query (per source, per lead stage, top-N movers); `history` docs are fetched one-shot on drawer/chart open.
6. **Root is `workspaces/{wid}`, `wid == owner uid` today** — so VA Seats (Later tier) becomes a rules change, not a data migration.

---

## 2. Path tree

```
users/{uid}                                        profile + workspace pointer (tiny)

workspaces/{wid}                                   settings, tagMeta, plan mirror; wid == owner uid
workspaces/{wid}/sources/{sourceId}                watchlist spine: storefronts + keywords
workspaces/{wid}/runs/{runId}                      scrape-run header (small, listable)
workspaces/{wid}/runs/{runId}/pages/{p####}        per-page observation chunk        [TTL 400d]
workspaces/{wid}/products/{asin}                   canonical ASIN doc: latest/prev/delta/spread/lead
workspaces/{wid}/products/{asin}/history/daily     date-keyed time-series map doc    [index-exempt]
workspaces/{wid}/products/{asin}/history/monthly   v2 downsampler output (reserved)
workspaces/{wid}/products/{asin}/offerSnapshots/{runId}   raw AOD offers             [TTL 400d]
workspaces/{wid}/products/{asin}/events/{eventId}  lead activity trail (dashboard-written, append-only)
workspaces/{wid}/sellers/{sellerId}                seller-discovery aggregate (v1)
workspaces/{wid}/rules/{ruleSetId}                 buy-criteria rule sets (v1)
workspaces/{wid}/views/{viewId}                    saved filters / smart views (v1)
workspaces/{wid}/alerts/{alertId}                  v2 alert rules (path reserved, not built at MVP)
```

---

## 3. Doc-ID derivation — the dedup/idempotency scheme

| Collection | Doc ID | Derivation | Idempotency effect |
|---|---|---|---|
| `sources` | `s_{sellerId}` / `k_{slug}` | Amazon seller ID from the `me=` URL param; normalized keyword slug from `k=` | One doc per storefront/keyword no matter how many runs hit it; extension auto-creates via merge |
| `runs` | `{sourceKey}_{startEpochMs}` e.g. `s_A3K9XELT4QZ6M2_1749477731000` | Minted **once** at run start, persisted in `chrome.storage.local` before the first page | Tab death / retries / pagination resume never fork a run; time-sortable, human-greppable |
| `runs/{id}/pages` | `p0001`, zero-padded page number | Page number within the run | Retrying a page flush rewrites the identical doc |
| `products` | the ASIN, e.g. `B0C8XL4N2P` (field `mk:"US"`; other marketplaces would prefix `{mk}_{asin}` — amazon.com-only today, decide before any international launch) | From `data-asin` | Cross-run dedup is structural; `setDoc(merge:true)` retries are no-ops |
| `history` | fixed `daily` / `monthly` | — | One read fetches the whole series; `merge:true` deep-merges the date map, same-day rewrite is last-write-wins |
| `offerSnapshots` | the `runId` whose spread fetch produced it | — | One spread fetch per ASIN per run; retries collapse |
| `sellers` | Amazon seller ID | From AOD `seller=` href | Aggregates across all spread fetches via `arrayUnion` |
| `events` | `{epochMs}_{rand4}` | Dashboard-minted | Dashboard writes are single-shot; collision-proof enough |

Invariants (enforced by construction, see architecture doc §5):

1. Queue entries are **value-complete** — `prev`, `delta`, `firstSeen`, counters are computed at enqueue and frozen; flush is pure replay.
2. Retried batches rewrite byte-identical documents.
3. The only non-`set` operation in the sync path is `arrayUnion` (idempotent).
4. Two same-day runs collapse to one history point (accepted; per-run fidelity lives in page chunks).
5. Reinstall loses `lastValues`: the next run omits `prev`/`delta` and re-stamps `firstSeenAt` once; the dashboard heals deltas from the history doc; the run after is correct again.

---

## 4. Document schemas with examples

All money fields are **integer cents**. All timestamps are Firestore `timestamp` (shown as ISO strings here). Compact point keys are shared across `latest`, `prev`, `history.d` values, and `pages.items` values:

> `p` price ¢ (absent if parse failed) · `lp` list/strike price ¢ · `r` rating 0–5 · `v` reviewCount · `pr` prime 0/1 · `sp` sponsored 0/1 (pages only) · `rk` organic rank within the run · `b` "N+ bought past month" lower bound · `st` "Only X left" stock count · spread-day extras: `sc` sellerCount, `mn`/`mx`/`md` min/max/median ¢, `cv` coefficient of variation, `oc` total offer count, `fba` FBA offer count, `az` Amazon-on-listing 0/1.

### 4.1 `users/{uid}`

```jsonc
{
  "displayName": "Enes",
  "email": "enesyilmaz5157@gmail.com",
  "defaultWorkspace": "9f8aKq2WLxYpB3vN7cE5dRm1tUo2",   // == uid today
  "createdAt": "2026-04-02T10:00:00Z"
}
```

### 4.2 `workspaces/{wid}` — `wid == owner uid`

```jsonc
{
  "ownerUid": "9f8aKq2WLxYpB3vN7cE5dRm1tUo2",
  "name": "Enes's workspace",
  "plan": "free",                       // display mirror only; entitlement enforced via custom claims
  "settings": { "defaultRoiPct": 30, "feeHeuristicPct": 25, "marketplace": "US" },
  "tagMeta": { "kitchen": { "color": "#f0c14b" }, "tier-A": { "color": "#2e7d32" } },
  "lastReviewedAt": "2026-06-08T19:00:00Z",   // v2 What-Changed feed baseline (reserved)
  "createdAt": "2026-04-02T10:00:00Z"
}
```

### 4.3 `sources/{s_A3K9XELT4QZ6M2}` — watchlist entry

Auto-created (merge) by the extension when a run starts from a recognizable `me=`/`k=` URL; `watched`/`nickname`/`cadenceDays`/`tags` are dashboard-set.

```jsonc
{
  "sourceId": "s_A3K9XELT4QZ6M2",
  "type": "storefront",                 // "storefront" | "keyword"
  "sellerId": "A3K9XELT4QZ6M2",         // null for keyword sources
  "keyword": null,
  "nickname": "BrickHouse Deals (kitchen)",
  "url": "https://www.amazon.com/s?me=A3K9XELT4QZ6M2",
  "watched": true,
  "cadenceDays": 7,                     // Rescan Queue: staleness = now − lastScrapedAt vs cadence
  "tags": ["kitchen", "tier-A"],
  "catalogSize": 412,                   // getTotalResults(), finally wired
  "lastRunId": "s_A3K9XELT4QZ6M2_1749477731000",
  "lastScrapedAt": "2026-06-09T14:19:40Z",
  "notes": "",
  "createdAt": "2026-04-02T10:05:00Z"
}
```

### 4.4 `runs/{s_A3K9XELT4QZ6M2_1749477731000}`

```jsonc
{
  "runId": "s_A3K9XELT4QZ6M2_1749477731000",
  "sourceId": "s_A3K9XELT4QZ6M2",       // top-level copy for the composite index
  "source": { "type": "storefront", "sellerId": "A3K9XELT4QZ6M2", "keyword": null,
              "url": "https://www.amazon.com/s?me=A3K9XELT4QZ6M2" },
  "mk": "US",
  "dayKey": "2026-06-09",               // UTC date of startedAt; ALL history points of this run use it
  "startedAt": "2026-06-09T14:02:11Z",
  "finishedAt": "2026-06-09T14:19:40Z", // null while active
  "status": "complete",                 // active | complete | stopped | dead (dashboard marks dead after 30 min silence)
  "pagesDone": 9, "pagesPlanned": 9,
  "totalResultsOnSerp": 412,
  "counters": {                         // ABSOLUTE values from extension-local run state — never increment()
    "placements": 442,                  // every card seen, incl. sponsored repeats
    "uniqueAsins": 408,
    "sponsored": 34,
    "priceParseFailures": 3,            // feeds v2 Scrape Health
    "newSeen": 12                       // ASINs absent from lastValues at enqueue time
  },
  "label": null                         // user-renamable run card
}
```

### 4.5 `runs/{runId}/pages/{p0003}` — page observation chunk (cold, TTL)

The per-page persistence unit (tab-death tolerance) and the input to Run-to-Run Diff. `items` is index-exempt. ~60–100 B per item → a 48-placement page ≈ 4–5 KB.

```jsonc
{
  "page": 3,
  "scrapedAt": "2026-06-09T14:04:53Z",
  "expireAt": "2027-07-14T14:04:53Z",   // startedAt + 400 days → TTL policy target
  "count": 48,
  "items": {
    "B0C8XL4N2P": { "p": 2399, "lp": 3299, "r": 4.6, "v": 1873, "pr": 1, "sp": 0, "rk": 108, "b": 400 },
    "B0B7QK9M1T": { "p": 1899, "r": 4.2, "v": 76, "pr": 1, "sp": 1, "rk": 97 },   // sponsored repeat: recorded, not aggregated
    "B0DQZJ8R4W": { "r": 4.1, "v": 233, "pr": 0, "sp": 0, "rk": 111 }             // price parse failed → p omitted
  }
}
```

### 4.6 `products/{B0C8XL4N2P}` — canonical ASIN doc (hot; one read renders one row)

```jsonc
{
  "asin": "B0C8XL4N2P", "mk": "US",
  "name": "Stanley Quencher H2.0 Tumbler 40oz",
  "img": "https://m.media-amazon.com/images/I/71abcDEFgh._AC_UL320_.jpg",
  "url": "https://www.amazon.com/dp/B0C8XL4N2P",

  // ── observation pair + deltas: all extension-written from the queue entry ──
  "latest": { "p": 2399, "lp": 3299, "r": 4.6, "v": 1873, "pr": 1, "rk": 12, "b": 400,
              "at": "2026-06-09T14:04:53Z", "runId": "s_A3K9XELT4QZ6M2_1749477731000", "dayKey": "2026-06-09" },
  "prev":   { "p": 2599, "r": 4.5, "v": 1701, "rk": 18,
              "at": "2026-06-02T13:58:20Z", "runId": "s_A3K9XELT4QZ6M2_1748872700000", "dayKey": "2026-06-02" },
  "delta":  { "p": -200, "pPct": -7.7, "r": 0.1, "v": 172, "days": 7 },   // sortable scalars → server-side Movers

  // ── latest spread summary (raw offers live in offerSnapshots) ──
  "spread": { "sc": 14, "mn": 1849, "mx": 3399, "md": 2245, "mean": 2310, "sd": 412, "cv": 0.21, "iqr": 380,
              "oc": 14, "fba": 9, "fbm": 5, "az": false,
              "bb": { "p": 2245, "sellerId": "A9XK2M4L1P8Q", "fba": true },
              "at": "2026-06-09T14:11:02Z", "runId": "s_A3K9XELT4QZ6M2_1749477731000" },
  "scores": { "opportunity": 7.2, "arbitrage": 6.1, "combined": 6.8,
              "maxBuy": 1310,             // median − fee heuristic − target ROI (settings-driven)
              "at": "2026-06-09T14:11:02Z" },

  // ── dashboard-written ──
  "verdict": { "status": "warn", "ruleSetId": "default", "fired": "9 FBA sellers > max 8",
               "at": "2026-06-09T18:02:00Z" },                            // rules-engine cache
  "lead": { "stage": "reviewing",         // new | reviewing | approved | purchased | rejected | archived
            "stageChangedAt": "2026-06-08T19:30:00Z",
            "rejectedReason": null, "notes": "check Walmart clearance",
            "buyPrice": null, "qty": null, "supplier": null, "orderRef": null,
            "recheckAt": null },          // v2 Re-Check Due Queue (field reserved)
  "tags": ["kitchen", "q3"],

  // ── provenance ──
  "sourceIds": ["s_A3K9XELT4QZ6M2"],      // arrayUnion — "which storefronts carry it"
  "firstSeenAt": "2026-04-07T11:20:09Z",
  "firstRunId": "s_A3K9XELT4QZ6M2_1743938400000"
}
```

~1.5 KB. Deliberately **not** stored: full offer/seller arrays (cold), times-seen (= history key count), 30-day deltas (computed from history where needed; `delta` covers vs-previous-observation, which at weekly cadence is the working delta).

### 4.7 `products/{asin}/history/daily` — the time-series doc (warm; the whole MoM feature)

One point per UTC `dayKey` per ASIN; spread-day points carry spread fields merged into the same entry. Field `d` is index-exempt. ~80–160 B/point → 3 years of weekly-to-daily points ≈ 30–170 KB, comfortably under 1 MiB (https://firebase.google.com/docs/firestore/quotas).

```jsonc
{
  "asin": "B0C8XL4N2P",
  "d": {
    "2026-04-07": { "p": 2799, "r": 4.4, "v": 1103, "rk": 22 },
    "2026-05-05": { "p": 2649, "r": 4.5, "v": 1190, "rk": 15,
                    "sc": 11, "md": 2399, "cv": 0.14, "oc": 11, "fba": 7, "az": 0 },
    "2026-06-09": { "p": 2399, "lp": 3299, "r": 4.6, "v": 1873, "rk": 12, "b": 400,
                    "sc": 14, "mn": 1849, "mx": 3399, "md": 2245, "cv": 0.21, "oc": 14, "fba": 9, "az": 0 }
  }
}
```

This one doc powers: 90-day Recharts sparklines (1 read), the History Drawer (1 read), exact "vs ~30 days ago" comparisons (nearest point ≤30d back, client-side), Review-Velocity/Rating-Delta badges (v1), and Spread Sentinel history (v2) — no precompute, no Functions.

### 4.8 `products/{asin}/offerSnapshots/{runId}` — raw spread capture (cold, TTL)

```jsonc
{
  "at": "2026-06-09T14:11:02Z",
  "expireAt": "2027-07-14T14:11:02Z",
  "prices": [1849, 1999, 1999, 2199, 2245, 2399, 2450, 2599, 2799, 3399],  // condition=new only; NOT deduped (Set() bug fixed)
  "totalOfferCount": 14,                 // AOD header count — AOD renders only ~10 offers; header is truth
  "offers": [                            // v1 Offer Intelligence: parsed from AOD HTML already downloaded
    { "sid": "A9XK2M4L1P8Q", "name": "KitchenDealsCo", "p": 2245, "ship": 0,   "fba": 1, "bb": 1, "cond": "new" },
    { "sid": "A2QW8R5T9Y3Z", "name": "ToyLiquidators", "p": 1849, "ship": 499, "fba": 0, "bb": 0, "cond": "new" }
  ]
}
```

### 4.9 `sellers/{A2QW8R5T9Y3Z}` — seller-discovery aggregate (v1)

```jsonc
{
  "sellerId": "A2QW8R5T9Y3Z",
  "name": "ToyLiquidators",
  "asins": ["B0C8XL4N2P", "B0B7QK9M1T"],   // arrayUnion; overlap rank = asins.length, computed client-side
  "storefrontUrl": "https://www.amazon.com/s?me=A2QW8R5T9Y3Z",
  "lastSeenAt": "2026-06-09T14:11:02Z",
  "watchlisted": false                      // one-click "Add to watchlist" creates sources/s_{sid}
}
```

No `increment()` counters (idempotency invariant); FBA/FBM mix is derived from offer snapshots when a seller row is expanded.

### 4.10 Small docs

```jsonc
// rules/{default}  — buy-criteria rule set (v1)
{ "name": "Cautious first flip", "preset": "cautious-first-flip", "autoReject": false,
  "conditions": [ { "field": "latest.p",  "op": ">=", "value": 1500 },
                  { "field": "latest.p",  "op": "<=", "value": 5000 },
                  { "field": "latest.r",  "op": ">=", "value": 4.0 },
                  { "field": "latest.v",  "op": ">=", "value": 50 },
                  { "field": "spread.fba","op": "<=", "value": 8 },
                  { "field": "spread.az", "op": "==", "value": false },
                  { "field": "spread.cv", "op": ">=", "value": 0.15 } ] }

// views/{v_greens}  — saved filter (v1)
{ "name": "Maria's queue", "filterSpec": { "verdict.status": "pass", "lead.stage": "reviewing" },
  "columns": ["name","latest.p","delta.pPct","spread.md","scores.maxBuy"], "pinned": true }

// products/{asin}/events/{1749500000000_k3xq}  — append-only lead trail (v1; feeds v2 Ledger)
{ "type": "stageChange", "from": "new", "to": "reviewing",
  "at": "2026-06-08T19:30:00Z", "note": "good CV, crowded but watch" }
```

---

## 5. Security rules (per-field validation)

The extension authenticates as the same Firebase user (custom-token session), so one rule set covers both clients — no separate API surface. `plan` entitlement is enforced via **custom claims**; the doc field is a display mirror that clients cannot escalate.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function member(wid) {
      return signedIn() && request.auth.uid == wid;
      // Later (VA Seats): || request.auth.uid in get(/databases/$(db)/documents/workspaces/$(wid)).data.members
    }

    match /users/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    match /workspaces/{wid} {
      allow read: if member(wid);
      allow create: if member(wid)
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.get('plan', 'free') == 'free';
      allow update: if member(wid)
        && request.resource.data.ownerUid == resource.data.ownerUid
        && request.resource.data.get('plan', 'free') == resource.data.get('plan', 'free');
      allow delete: if false;

      match /sources/{sourceId} {
        allow read, delete: if member(wid);
        allow create, update: if member(wid)
          && request.resource.data.type in ['storefront', 'keyword']
          && request.resource.data.get('cadenceDays', 7) is int;
      }

      match /runs/{runId} {
        allow read, delete: if member(wid);
        allow create, update: if member(wid)
          && request.resource.data.status in ['active', 'complete', 'stopped', 'dead']
          && request.resource.data.dayKey is string
          && request.resource.data.sourceId is string;

        match /pages/{pageId} {
          allow read, delete: if member(wid);
          allow create, update: if member(wid)
            && request.resource.data.items is map
            && request.resource.data.items.size() <= 120     // Amazon pages carry ≤60 placements; 2× headroom
            && request.resource.data.expireAt is timestamp;  // TTL field is mandatory on cold docs
        }
      }

      match /products/{asin} {
        allow read, delete: if member(wid);
        allow create, update: if member(wid)
          && request.resource.data.asin == asin              // doc id == payload ASIN (dedup axis)
          && (!('latest' in request.resource.data) || (
                request.resource.data.latest.dayKey is string
                && (!('p' in request.resource.data.latest) || request.resource.data.latest.p is int)
                && (!('v' in request.resource.data.latest) || request.resource.data.latest.v is int)))
          && (!('lead' in request.resource.data)
              || request.resource.data.lead.stage in
                 ['new', 'reviewing', 'approved', 'purchased', 'rejected', 'archived']);

        match /history/{seriesId} {
          allow read: if member(wid);
          allow write: if member(wid) && seriesId in ['daily', 'monthly'];
        }
        match /offerSnapshots/{snapId} {
          allow read, delete: if member(wid);
          allow create, update: if member(wid)
            && request.resource.data.prices is list
            && request.resource.data.expireAt is timestamp;
        }
        match /events/{eventId} {
          allow read, create: if member(wid);
          allow update, delete: if false;                    // append-only activity trail
        }
      }

      match /sellers/{sellerId} { allow read, write: if member(wid); }
      match /rules/{ruleSetId}  { allow read, write: if member(wid); }
      match /views/{viewId}     { allow read, write: if member(wid); }
      match /alerts/{alertId}   { allow read, write: if member(wid); }
    }
  }
}
```

Notes: with `set(..., {merge:true})`, `request.resource.data` is the **post-merge** document state, so validations apply to the merged result — the extension's first write of a doc must therefore carry the required fields (it does: queue entries are value-complete). Tighten further at Phase 6 (e.g. typed checks on `sources.sellerId`, `runs.counters`) only if abuse shows up; the load-bearing checks (plan immutability, ASIN-id match, chunk size cap, TTL field presence, append-only events) ship at launch.

---

## 6. Indexes

### 6.1 Composite indexes (`firestore.indexes.json`)

```json
{
  "indexes": [
    { "collectionGroup": "runs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "sourceId", "order": "ASCENDING" },
      { "fieldPath": "startedAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "lead.stage", "order": "ASCENDING" },
      { "fieldPath": "lead.stageChangedAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "sourceIds", "arrayConfig": "CONTAINS" },
      { "fieldPath": "latest.at", "order": "DESCENDING" } ] },

    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "sourceIds", "arrayConfig": "CONTAINS" },
      { "fieldPath": "delta.pPct", "order": "ASCENDING" } ] },

    { "collectionGroup": "products", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
      { "fieldPath": "latest.at", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": [
    { "collectionGroup": "pages",          "fieldPath": "items",  "indexes": [] },
    { "collectionGroup": "history",        "fieldPath": "d",      "indexes": [] },
    { "collectionGroup": "offerSnapshots", "fieldPath": "offers", "indexes": [] },
    { "collectionGroup": "offerSnapshots", "fieldPath": "prices", "indexes": [] },
    { "collectionGroup": "sellers",        "fieldPath": "asins",  "indexes": [] }
  ]
}
```

| Index | Serves |
|---|---|
| `runs(sourceId, startedAt desc)` | Run history of one storefront; diff picker ("latest vs ~30 days ago") |
| `products(lead.stage, lead.stageChangedAt desc)` | Lead Pipeline lanes |
| `products(sourceIds contains, latest.at desc)` | Per-storefront product board — the default table view |
| `products(sourceIds contains, delta.pPct asc)` | Per-storefront price-drop Movers |
| `products(tags contains, latest.at desc)` | Tag-filtered views |

Global Movers (`orderBy('delta.pPct').limit(100)`) and the Run Inbox (`orderBy('startedAt','desc').limit(30)`) ride **automatic single-field indexes** — no composite needed. Reserve (add only when the feature ships): `products(lead.stage, lead.recheckAt asc)` for the v2 Re-Check Due Queue.

### 6.2 Exemptions are mandatory, not optimizations

A `d` map with 1,000+ dates × several subfields, or page `items` with 60 ASINs × 9 subfields, would race toward the 40,000-index-entries-per-document limit and amplify every write with per-element index updates (https://firebase.google.com/docs/firestore/best-practices). All five exemptions above ship with the first deploy.

All queries are collection-scoped (never collection-group) so the Later-tier `workspaces` membership change touches rules only.

---

## 7. Read/write cost analysis

Pricing (nam5, verified 2026-06 in `docs/research/technical-firebase.md`): reads $0.06/100k, writes $0.18/100k, deletes $0.02/100k, storage ~$0.18/GiB-mo; free per project per day: 50k reads / 20k writes / 20k deletes, 1 GiB storage (https://firebase.google.com/pricing, https://firebase.google.com/docs/firestore/pricing). Auth free to 50k MAU — never a line item.

**This section is the authoritative cost model.** It supersedes the per-user estimate in `docs/research/technical-firebase.md` §2 (~215 writes/day/user), which predates the final write-amplified schema (per-page observation chunks + dual product/history writes per ASIN, ~92 writes per SERP page).

Reference profiles:

- **Median user:** 10 storefronts × 300 products, weekly cadence, 200 spread fetches/mo, 2 sessions/week. ~3,000 tracked ASINs.
- **Power user (the judging scale):** 60 storefronts × 400 products, weekly, 800 spread fetches/mo, ~daily sessions, 12 months. ~20–24k tracked ASINs.

### 7.1 Writes per activity

| Activity | Formula | Writes |
|---|---|---|
| One SERP page flush (48 placements, ~45 upserts) | 1 chunk + 45 product + 45 history + 1 run + 0–1 source | ~92 |
| 300-product / 7-page run | 2P + 2pg + 2 | ~616 |
| 400-product / 9-page run | 2P + 2pg + 2 | ~820 |
| Spread fetch, per ASIN | product + history + snapshot + ~3 sellers | ~6 |
| Triage session (50 stage changes) | 50 product + 50 events | 100 |

| Profile | Writes/month | Writes/day avg | Blaze cost |
|---|---|---|---|
| Median | 616 × 10 × 4.33 + 200 × 6 + ~1k triage ≈ **29k** | ~960 | $0.05/mo |
| Power | 820 × 60 × 4.33 + 800 × 6 + ~2k triage ≈ **219k** | ~7,300 | $0.39/mo |

A power user costs ≈ **$0.50–0.60/mo all-in** (writes + reads + storage) — irrelevant against a $14.99 Pro price (monetization research, Ladder A).

### 7.2 Reads per dashboard screen (cold worst case; `persistentLocalCache` makes warm sessions bill only changed docs)

| Screen | Query | Median (3k ASINs) | Power (24k ASINs) |
|---|---|---|---|
| Run Inbox (30 runs) | `runs orderBy startedAt desc limit 30` — `counters.newSeen` is on the header | 30 | 30 |
| Storefront board (one source) | `sourceIds contains + latest.at desc`; Δ columns come from `delta` **on the doc — zero history reads** | ~300 | ~400 |
| Global Movers / Flip Radar top-100 | `orderBy delta.pPct asc limit 100` (or client-rank over a scoped set) | ~100 | ~100 |
| Lead Pipeline lane | `lead.stage == X + stageChangedAt desc` | 50–200 | 200–500 |
| History Drawer (one ASIN) | `history/daily` + latest `offerSnapshot` + first events page | 2–4 | 2–4 |
| Exact "vs ~30 days ago" board for one storefront | board + 1 history doc per visible row | ~600 | ~800 |
| Run-to-Run Diff (two runs) | 2 headers + pages of both (7–9 pages each) | ~16 | ~20 |
| Watchlist / Rescan Queue | whole `sources` collection, staleness sorted client-side | ≤10 | ≤60 |
| Seller Discovery | whole `sellers` collection, ranked client-side by `asins.length` | ~300 | 1–3k (cold, once; cached after) |
| Portfolio header stats | aggregation queries, 1 read per 1,000 index entries (https://firebase.google.com/docs/firestore/query-data/aggregation-queries) | ~3/stat | ~24/stat |
| XLSX export of any filtered view | exports the already-loaded view via the reusable `exporter.js` | 0 | 0 |

The structural rule that keeps the power profile viable: **never subscribe to the whole `products` collection** (24k docs ≈ 36 MB transfer and 24k reads). The `prev`/`delta` fields on the product doc exist precisely so that no table or movers view ever needs N history reads; history docs are drawer/chart material.

Estimated session: median ~3.2k reads/weekly review (~14k/mo); power ~8.5k reads/session (~110k/mo ≈ $0.07/mo).

### 7.3 Fleet-level fit (conservative: 100% of users median-active; real MAU/registered is lower)

| Scale | Writes/day | Reads/day | Storage (yr 1) | Verdict |
|---|---|---|---|---|
| 10 users | ~9.6k | ~5k | ~0.4 GB | **Spark fits** (Functions excepted — Blaze flips at Phase 4 with ~$0 expected bill) |
| 100 users | ~96k | ~47k | ~4 GB | Blaze: writes (96k−20k)×30 ≈ 2.3M billable ≈ $4.2; reads ≈ free; storage ≈ $0.7 → **≈ $5–8/mo** |
| 1,000 users | ~960k | ~470k | ~40 GB | Writes ≈ $51, reads ≈ $8, storage ≈ $7, egress ≈ $5 → **≈ $70/mo upper bound; ≈ $25–40 at realistic 30–40% active.** Resend's first paid tier (~$20/mo) becomes the largest single line item when the v2 digest ships |

Storage growth ≈ 40 MB/user/yr median, ~250 MB/yr power (products one-time ~1.5 KB/ASIN; history ~4 KB/ASIN/yr at weekly cadence; pages + snapshots are a rolling 400-day window). The ~500 writes/sec ceiling on sequentially-indexed collections (https://firebase.google.com/docs/firestore/best-practices) is two orders of magnitude away from any per-workspace burst.

---

## 8. Retention / TTL policy

| Data | Policy | Mechanism |
|---|---|---|
| `products/{asin}`, `history/*`, `runs` headers, `sources`, `sellers`, config docs | **Never expire — paid workspaces.** This is the compounding longitudinal moat and it is cheap (~$0.18/GiB-mo). **Free workspaces:** history beyond the 30-day plan gate gets plan-stamped expiry / read-path gating per §10 | — (free gating: §10) |
| `runs/{id}/pages/*` | Delete 400 days after run start (paid stamp; free plans stamp the 30-day plan window — §10) | TTL policy on collection group `pages`, field `expireAt` (written by the extension on every chunk from day 1) |
| `products/{asin}/offerSnapshots/*` | Delete 400 days after fetch (paid stamp; free: 30 days — §10) | TTL policy on collection group `offerSnapshots`, field `expireAt` |
| `history/daily` points older than 365 days | v2: folded into `history/monthly` by the scheduled downsampler — capacity insurance only; a 3-year daily doc is still ~170 KB vs the 1 MiB limit | Cloud Function (v2) |

Enable both TTL policies at Phase 5 launch. **Default path: the Firestore console UI** (Firestore → "Time-to-live" → create policy per collection group, field `expireAt`; requires Owner, ~2 min for both) — `gcloud` is not installed on this machine and isn't needed for this (see `docs/research/website-firebase-state.md`). Scripted alternative where gcloud exists: `gcloud firestore fields ttls update expireAt --collection-group=pages --enable-ttl`, same for `offerSnapshots`. TTL deletes bill as normal deletes ($0.02/100k — negligible) and expired docs can linger in query results up to ~24h (https://firebase.google.com/docs/firestore/ttl); the diff UI filters `expireAt > now` defensively. User-initiated run deletion cascade-deletes its pages client-side (≤ a dozen docs, batched). 400 days = 13 months — preserves a full year-over-year diff window before raw fidelity drops to the history summaries.

---

## 9. Capacity escape hatches and v2 schema seams

**Escape hatches (documented, not built):**

- `history/daily` approaching ~700 KB (≈ a decade of daily points): shard to `history/daily-{year}`; the v2 downsampler makes this moot first.
- Tracked-ASIN counts far beyond 24k: views are already scoped; the global Movers query is top-N regardless of collection size.
- International marketplaces: `mk` field exists everywhere; product doc IDs would become `{mk}_{asin}` — decide before any non-`.com` launch, currently moot.

**v2 features already expressible with zero schema changes:**

| v2 feature | Reads what exists | Net-new |
|---|---|---|
| Change Alerts & Weekly Digest | `runs`, `products`, `history` slices | `alerts/{alertId}` docs (path reserved) + Scheduler + Resend |
| What-Changed Home Feed | `runs where startedAt > lastReviewedAt` + page-chunk diffs | uses the reserved `lastReviewedAt` workspace field |
| Already-Evaluated Ledger | `lead.*` on product docs + `events` trail | UI only |
| Spread Sentinel | `offerSnapshots` series + spread fields in `history.d` | client-side change-point math |
| Delisted/Dropped Tracker | diff "removed" sets from page chunks | UI only (optional tiny diff-cache docs if recompute annoys) |
| Re-Check Due Queue | `lead.recheckAt` (reserved field) | one reserved composite index |
| Storefront Scorecards | aggregations over `runs`/`products` (~1 read per 1k index entries) | UI only |
| Excel Workbook Import | — | synthetic run with `source.type:"import"` through the identical upsert path |
| Scrape Health Center | `runs.counters` + chunk provenance | UI only |
| VA Workspaces (Later) | everything, unchanged paths | `members` map on the workspace doc + the commented rules branch in §5 |

---

## 10. Plan-quota enforcement design note

_Added 2026-06-10 after completeness review._

The monetization plan (`docs/research/monetization-and-positioning.md`, Ladder A) gates the Free plan on **30-day history depth, 2 tracked storefronts, and ~1,000 synced products/month**. None of those gates falls out of the schema by itself: §8 retains data indefinitely, Firestore security rules **cannot count documents** in a collection, and the writer is the extension — a client. The mechanism, per gate:

1. **Plan source of truth.** The plan lives in **custom claims** (set by the billing webhook via Admin SDK) and is mirrored into `workspaces/{wid}.plan` for display only (§4.2, §5 — clients cannot escalate the mirror). Rules read `request.auth.token.plan`; both clients read it off the ID token.
2. **History depth (free = 30 days).** The extension stamps a **per-plan `expireAt`** onto cold docs (`pages`, `offerSnapshots`) from the plan claim: free = `startedAt + 30d`, paid = `+400d`; the §8 TTL policies then do the deleting unchanged. The `history/daily` map doc cannot be TTL'd per-point — its 30-day gate is the dashboard read path (point 5) plus the later server-side pruner.
3. **Tracked storefronts (free = 2).** A counter doc `workspaces/{wid}/counters/sources` (`{ count: int }`) maintained **transactionally by the dashboard** alongside every source create/delete; the `sources` create rule validates `get(…/counters/sources).data.count <= plan limit`. The extension's auto-create of a source (§4.3) flows through the same rule — a free user's third storefront scan is denied at the source write and the extension surfaces "storefront limit reached".
4. **Monthly sync volume (free ≈ 1,000 products/mo).** A monthly write-budget counter doc `workspaces/{wid}/counters/{YYYY-MM}` that the extension **increments once per run** (by the run's `uniqueAsins`); product/page write rules enforce a rules-side ceiling against the current month's counter. This is the one sanctioned `increment()` outside the idempotent sync path (§1 principle 3) — a retried increment can over-count, which errs toward stricter metering and is accepted.
5. **Honest limits of the design.** These are client-stamped quotas: **a determined client (modified extension, raw REST with the user's own token) can bypass them** — stamp a paid-length `expireAt`, skip the counter increment, under-report `uniqueAsins`. Rules enforce ceilings on what they can see per request; they cannot prove the stamps are honest. The realistic enforcement point is the **dashboard read path**: a free dashboard renders only the last 30 days of `history.d` and hides deeper charts/exports regardless of what is stored. Hard enforcement — a scheduled Function that re-stamps/deletes over-quota data and reconciles counters — is a later server-side cleanup job, deferred with the rest of the Functions surface (Blaze, Phase 4+). A free user who hacks themselves longer retention costs cents of storage and gains nothing in the UI; this is an accepted product risk, not a security boundary.
