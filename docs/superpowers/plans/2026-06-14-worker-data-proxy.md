# Cloudflare Worker (NHL proxy + NFL per-quarter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one small Cloudflare Worker that gives the static site browser-fetchable access to official data that is otherwise CORS-blocked: a transparent NHL proxy to `api-web.nhle.com`, and an NFL endpoint that mints an `api.nfl.com` token, aggregates weekly play-by-play into per-player **per-quarter** total yards, and caches it.

**Architecture:** A Workers ES-module Worker under `worker/`. Pure, framework-free logic (origin allow-list check, NFL play-by-play → per-quarter aggregation) lives in standalone modules unit-tested with the repo's existing `node --test`. The Worker glue (routing, CORS lockdown, token cache, edge cache) is verified by deploying and curling. The NFL endpoint returns only a compact per-player per-quarter payload so the browser never downloads raw play-by-play.

**Tech Stack:** Cloudflare Workers (ES modules), `wrangler` CLI (run via `npx --yes wrangler@latest`), Node's built-in test runner (`node --test`, run as `/opt/homebrew/bin/node`). No framework, no bundler config beyond wrangler defaults.

**Conventions for this plan:**
- Always run Node as `/opt/homebrew/bin/node` and npm/npx via the Homebrew toolchain (the nvm wrapper fails non-interactively).
- The Worker is deployed to the user's Cloudflare account (`*.workers.dev`, account `dewittl`). Deploy/login steps must be run by the user in their own shell (interactive OAuth) — the plan calls these out explicitly.
- Commit after every task.

---

### Task 1: Scaffold the Worker

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/src/config.js`
- Create: `worker/src/index.js`
- Create: `worker/README.md`
- Create: `worker/.gitignore`

- [ ] **Step 1: Create `worker/wrangler.toml`**

```toml
name = "lightitup-data"
main = "src/index.js"
compatibility_date = "2025-06-01"
# No bindings required for v1: token is cached in a module global, weekly
# play-by-play is cached with the Workers Cache API (caches.default).
```

- [ ] **Step 2: Create `worker/.gitignore`**

```gitignore
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 3: Create `worker/src/config.js`** (concrete config; pure)

```js
// Static site origins allowed to call this Worker. Keep this tight — it stops
// the Worker being an open proxy for the world.
export const ALLOWED_ORIGINS = [
  'https://whatadewitt.com',
  'https://www.whatadewitt.com',
];

// Default NFL season (the year the season starts).
export const NFL_SEASON = 2025;

// api.nfl.com public web client credentials (the same ones nfl.com itself uses
// on page load). Public, not secret — but keep them server-side anyway.
export const NFL_CLIENT_KEY = '4cFUW6DmwJpzT9L7LrG3qRAcABG5s04g';
export const NFL_CLIENT_SECRET = 'CZuvCL49d9OwfGsR';

// Return true if this Origin may use the Worker. Allow the configured origins,
// plus any localhost / 127.0.0.1 (dev), plus this Worker's own *.workers.dev.
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  let u;
  try { u = new URL(origin); } catch { return false; }
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  if (u.hostname.endsWith('.workers.dev')) return true;
  return false;
}
```

- [ ] **Step 4: Create a placeholder `worker/src/index.js`** (replaced in Task 7; here just so the project is valid)

```js
export default {
  async fetch() {
    return new Response('lightitup-data worker', { status: 200 });
  },
};
```

- [ ] **Step 5: Create `worker/README.md`**

```markdown
# lightitup-data Worker

Gives the static "Light it Up" site browser-fetchable access to official data that
is otherwise CORS-blocked.

## Routes
- `GET /nhl/<path>` — transparent CORS proxy to `https://api-web.nhle.com/<path>`.
- `GET /nfl/player/<gsisId>?season=2025` — per-player **per-quarter** total yards
  (passing + receiving + rushing), aggregated from official `api.nfl.com`
  play-by-play and cached at the edge.

## Develop / deploy
Run in your own shell (interactive Cloudflare login):

    cd worker
    npx --yes wrangler@latest login      # first time only
    npx --yes wrangler@latest deploy

## Tests
Pure logic is unit-tested from the repo root with `node --test`
(`worker/src/*.test.js`).
```

- [ ] **Step 6: Syntax-check and commit**

Run: `/opt/homebrew/bin/node --check worker/src/config.js && /opt/homebrew/bin/node --check worker/src/index.js`
Expected: no output, exit 0.

```bash
git add worker/
git commit -m "feat(worker): scaffold lightitup-data Worker"
```

---

### Task 2: Origin allow-list check (TDD)

**Files:**
- Test: `worker/src/config.test.js`
- Modify: `worker/src/config.js` (already implemented in Task 1 — this task locks it with tests)

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from './config.js';

test('isAllowedOrigin: allows configured production origins', () => {
  assert.equal(isAllowedOrigin('https://whatadewitt.com'), true);
  assert.equal(isAllowedOrigin('https://www.whatadewitt.com'), true);
});

test('isAllowedOrigin: allows localhost and 127.0.0.1 for dev', () => {
  assert.equal(isAllowedOrigin('http://localhost:8000'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5500'), true);
});

test('isAllowedOrigin: allows *.workers.dev', () => {
  assert.equal(isAllowedOrigin('https://lightitup-data.dewittl.workers.dev'), true);
});

test('isAllowedOrigin: rejects unknown origins and junk', () => {
  assert.equal(isAllowedOrigin('https://evil.example.com'), false);
  assert.equal(isAllowedOrigin(''), false);
  assert.equal(isAllowedOrigin(null), false);
  assert.equal(isAllowedOrigin('not a url'), false);
});
```

- [ ] **Step 2: Run the test to verify it passes** (implementation already exists from Task 1)

Run: `/opt/homebrew/bin/node --test worker/src/config.test.js`
Expected: PASS (all assertions). If any fail, fix `isAllowedOrigin` in `worker/src/config.js` until green.

- [ ] **Step 3: Commit**

```bash
git add worker/src/config.test.js
git commit -m "test(worker): cover origin allow-list"
```

---

### Task 3: NFL play-by-play → per-quarter aggregation (TDD with a real fixture)

This is the highest-risk logic (undocumented stat codes), so it is pure and tested
against a real captured game.

**Files:**
- Create: `worker/fixtures/nfl-week1-dalphi.json` (captured real data)
- Create: `worker/src/nfl-aggregate.js`
- Test: `worker/src/nfl-aggregate.test.js`

- [ ] **Step 1: Capture a real single-game fixture**

Run these in a shell (needs network; creds are public web creds):

```bash
DEVICE_INFO=$(/opt/homebrew/bin/node -e 'console.log(Buffer.from(JSON.stringify({model:"desktop",version:"Chrome",osName:"Windows",osVersion:"10.0"})).toString("base64"))')
TOKEN=$(curl -s -X POST https://api.nfl.com/identity/v3/token \
  -H 'Content-Type: application/json' \
  -d "{\"clientKey\":\"4cFUW6DmwJpzT9L7LrG3qRAcABG5s04g\",\"clientSecret\":\"CZuvCL49d9OwfGsR\",\"deviceId\":\"plan-fixture-0001\",\"deviceInfo\":\"$DEVICE_INFO\",\"networkType\":\"other\"}' \
  | /opt/homebrew/bin/node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).accessToken))')
curl -s "https://api.nfl.com/football/v2/experience/weekly-game-details?season=2025&type=REG&week=1&includeStandings=false&includeDriveChart=true&includeReplays=false" \
  -H "Authorization: Bearer $TOKEN" > /tmp/nfl_w1_full.json
/opt/homebrew/bin/node -e 'const j=require("/tmp/nfl_w1_full.json"); const games=j.games??j.data?.games??[]; console.log("top-level game keys path used; games found:",games.length); const has=t=>JSON.stringify(t).includes("PHI")&&JSON.stringify(t).includes("DAL"); const g=games.find(x=>has(x)); require("fs").writeFileSync("worker/fixtures/nfl-week1-dalphi.json", JSON.stringify(g,null,1)); console.log("wrote DAL@PHI game; driveChart plays:", (g.driveChart?.plays||[]).length);'
```

If `games found: 0`, inspect `/tmp/nfl_w1_full.json` for the array key wrapping the games and update **both** the one-liner above and the `games` line in Step 3, then re-run. Confirm the fixture file exists and has a non-zero `driveChart.plays` count.

- [ ] **Step 2: Write the failing test** (expected per-quarter **totals** = pass+rush+rec, derived from verified splits: Hurts pass [14,79,18,41]+rush [11,37,8,6]; Barkley rush [20,29,11,0]+rec [0,11,0,13]; Lamb rec [76,10,11,13])

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregateWeek } from './nfl-aggregate.js';

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL('../fixtures/nfl-week1-dalphi.json', import.meta.url)), 'utf8'));

// aggregateWeek takes the FULL week blob ({games:[...]}); wrap our single game.
const agg = aggregateWeek({ games: [fixture] });
const byName = (name) => Object.values(agg.players).find((p) => p.name.includes(name));

test('aggregateWeek: sums pass+rush+rec total yards per quarter for a QB', () => {
  const hurts = byName('Hurts');
  assert.ok(hurts, 'Hurts present');
  // total/quarter = pass + rush per quarter
  assert.deepEqual(hurts.quarters, [25, 116, 26, 47]); // 152 pass + 62 rush = 214
  assert.equal(hurts.quarters.reduce((a, b) => a + b, 0), 214);
});

test('aggregateWeek: RB total = rush + receiving per quarter', () => {
  const barkley = byName('Barkley');
  assert.deepEqual(barkley.quarters, [20, 40, 11, 13]); // 60 rush + 24 rec = 84
});

test('aggregateWeek: WR total = receiving per quarter', () => {
  const lamb = byName('Lamb');
  assert.deepEqual(lamb.quarters, [76, 10, 11, 13]); // 110 rec
});

test('aggregateWeek: ignores situational duplicate stat codes (no double-count)', () => {
  const lamb = byName('Lamb');
  // If 1xx codes were summed, Lamb would exceed his 110 receiving total.
  assert.equal(lamb.quarters.reduce((a, b) => a + b, 0), 110);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `/opt/homebrew/bin/node --test worker/src/nfl-aggregate.test.js`
Expected: FAIL with `Cannot find module './nfl-aggregate.js'`.

- [ ] **Step 4: Implement `worker/src/nfl-aggregate.js`**

```js
// Pure: official api.nfl.com weekly-game-details blob -> per-player per-quarter
// TOTAL yards (passing + receiving + rushing). No Worker/Node APIs here.

// statType codes that carry yardage we want. Pass=15(+16 on TD), rush=10(+11),
// rec=21(+22). The 1xx codes (111,113,115,...) are situational duplicates
// (YAC, air yards, targets) and MUST NOT be summed.
const YARD_CODES = new Set([10, 11, 15, 16, 21, 22]);

// Returns { players: { [gsisPlayerId]: { name, quarters: [q1,q2,q3,q4] } } }
export function aggregateWeek(blob) {
  const games = blob?.games ?? blob?.data?.games ?? [];
  const players = {};
  for (const game of games) {
    const plays = game?.driveChart?.plays ?? [];
    for (const play of plays) {
      const q = Math.min(Number(play?.quarter) || 0, 4); // OT (5) folds into Q4
      if (q < 1) continue;
      for (const st of play?.stats ?? []) {
        if (!YARD_CODES.has(Number(st?.statType))) continue;
        const pid = st?.gsisPlayerId;
        if (pid == null) continue;
        const yards = Number(st?.yards) || 0;
        const p = players[pid] || (players[pid] = {
          name: st?.gsisPlayerName ?? '',
          quarters: [0, 0, 0, 0],
        });
        p.quarters[q - 1] += yards;
      }
    }
  }
  return { players };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `/opt/homebrew/bin/node --test worker/src/nfl-aggregate.test.js`
Expected: PASS. If totals are off, the captured fixture's field paths differ from the documented shape — fix the `games`/`driveChart.plays`/`stats` access in `aggregateWeek` to match the fixture, then re-run.

- [ ] **Step 6: Confirm the repo-wide test run still passes**

Run: `/opt/homebrew/bin/node --test`
Expected: PASS (existing `lib.test.js` + new worker tests).

- [ ] **Step 7: Commit**

```bash
git add worker/fixtures/nfl-week1-dalphi.json worker/src/nfl-aggregate.js worker/src/nfl-aggregate.test.js
git commit -m "feat(worker): per-quarter NFL yard aggregation with verified fixture"
```

---

### Task 4: NFL token mint + cache

**Files:**
- Create: `worker/src/nfl-token.js`
- Test: `worker/src/nfl-token.test.js`

- [ ] **Step 1: Write the failing test** (tests the cache logic with injected `now` and `mint`, so it needs no network)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTokenCache } from './nfl-token.js';

test('makeTokenCache: mints once, reuses until near expiry', async () => {
  let calls = 0;
  let now = 1000_000; // ms
  const mint = async () => { calls += 1; return { accessToken: `t${calls}`, ttlMs: 3600_000 }; };
  const cache = makeTokenCache({ mint, now: () => now });

  assert.equal(await cache.get(), 't1');
  assert.equal(await cache.get(), 't1'); // reused
  assert.equal(calls, 1);

  now += 3600_000; // jump past TTL (minus the 60s safety margin)
  assert.equal(await cache.get(), 't2'); // re-minted
  assert.equal(calls, 2);
});

test('makeTokenCache: invalidate() forces a re-mint (e.g. after a 401)', async () => {
  let calls = 0;
  const mint = async () => { calls += 1; return { accessToken: `t${calls}`, ttlMs: 3600_000 }; };
  const cache = makeTokenCache({ mint, now: () => 0 });
  assert.equal(await cache.get(), 't1');
  cache.invalidate();
  assert.equal(await cache.get(), 't2');
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/opt/homebrew/bin/node --test worker/src/nfl-token.test.js`
Expected: FAIL with `Cannot find module './nfl-token.js'`.

- [ ] **Step 3: Implement `worker/src/nfl-token.js`**

```js
import { NFL_CLIENT_KEY, NFL_CLIENT_SECRET } from './config.js';

const SAFETY_MS = 60_000; // re-mint a minute before real expiry

// Base64 of a fixed desktop deviceInfo blob (atob/btoa exist in Workers).
function deviceInfoB64() {
  return btoa(JSON.stringify({ model: 'desktop', version: 'Chrome', osName: 'Windows', osVersion: '10.0' }));
}

// Real network mint against api.nfl.com. Returns { accessToken, ttlMs }.
export async function mintToken(deviceId = crypto.randomUUID()) {
  const resp = await fetch('https://api.nfl.com/identity/v3/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientKey: NFL_CLIENT_KEY,
      clientSecret: NFL_CLIENT_SECRET,
      deviceId,
      deviceInfo: deviceInfoB64(),
      networkType: 'other',
    }),
  });
  if (!resp.ok) throw new Error(`token mint failed: ${resp.status}`);
  const json = await resp.json();
  return { accessToken: json.accessToken, ttlMs: 3600_000 };
}

// Cache wrapper. Inject `mint`/`now` for tests; defaults use the real mint + Date.
export function makeTokenCache({ mint = mintToken, now = () => Date.now() } = {}) {
  let token = null;
  let expiresAt = 0;
  return {
    async get() {
      if (token && now() < expiresAt - SAFETY_MS) return token;
      const { accessToken, ttlMs } = await mint();
      token = accessToken;
      expiresAt = now() + ttlMs;
      return token;
    },
    invalidate() { token = null; expiresAt = 0; },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `/opt/homebrew/bin/node --test worker/src/nfl-token.test.js`
Expected: PASS. (Note: `btoa`/`crypto.randomUUID` are referenced only inside functions the test does not call, so they won't error under Node.)

- [ ] **Step 5: Commit**

```bash
git add worker/src/nfl-token.js worker/src/nfl-token.test.js
git commit -m "feat(worker): NFL token mint with expiry cache"
```

---

### Task 5: NFL endpoint handler (fetch weeks, edge-cache, filter to one player)

**Files:**
- Create: `worker/src/nfl.js`

- [ ] **Step 1: Implement `worker/src/nfl.js`**

```js
import { NFL_SEASON } from './config.js';
import { makeTokenCache } from './nfl-token.js';
import { aggregateWeek } from './nfl-aggregate.js';

const WEEKS = 18; // NFL regular season weeks (a team plays 17 + one bye)
const tokenCache = makeTokenCache();

function weekUrl(season, week) {
  return `https://api.nfl.com/football/v2/experience/weekly-game-details` +
    `?season=${season}&type=REG&week=${week}&includeStandings=false` +
    `&includeDriveChart=true&includeReplays=false`;
}

// Fetch + aggregate one week, cached at the edge (data for a finished season is
// static; 6h TTL is plenty and keeps upstream calls rare).
async function getAggregatedWeek(season, week) {
  const cacheKey = new Request(`https://cache.lightitup/nfl/${season}/${week}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();

  const fetchWeek = async () => {
    const token = await tokenCache.get();
    return fetch(weekUrl(season, week), { headers: { Authorization: `Bearer ${token}` } });
  };
  let resp = await fetchWeek();
  if (resp.status === 401) { tokenCache.invalidate(); resp = await fetchWeek(); }
  if (!resp.ok) throw new Error(`weekly-game-details ${week} failed: ${resp.status}`);

  const agg = aggregateWeek(await resp.json());
  await cache.put(cacheKey, new Response(JSON.stringify(agg), {
    headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=21600' },
  }));
  return agg;
}

// GET /nfl/player/<gsisId>?season=2025 -> { gsisId, season, weeks: { "<n>": { quarters:[..] } } }
export async function handleNfl(pathParts, searchParams) {
  if (pathParts[0] !== 'player' || !pathParts[1]) {
    return new Response(JSON.stringify({ error: 'use /nfl/player/<gsisId>' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  const gsisId = decodeURIComponent(pathParts[1]);
  const season = Number(searchParams.get('season')) || NFL_SEASON;

  const weeks = {};
  for (let w = 1; w <= WEEKS; w++) {
    const agg = await getAggregatedWeek(season, w);
    const p = agg.players[gsisId];
    if (p) weeks[w] = { quarters: p.quarters };
  }
  return new Response(JSON.stringify({ gsisId, season, weeks }), {
    headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 2: Syntax-check**

Run: `/opt/homebrew/bin/node --check worker/src/nfl.js`
Expected: no output, exit 0. (Runtime behavior is verified after deploy in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add worker/src/nfl.js
git commit -m "feat(worker): NFL per-player per-quarter endpoint with edge cache"
```

---

### Task 6: NHL passthrough handler

**Files:**
- Create: `worker/src/nhl.js`

- [ ] **Step 1: Implement `worker/src/nhl.js`**

```js
// GET /nhl/<path> -> transparent proxy to https://api-web.nhle.com/<path>.
// Locked to that single upstream host (not an open proxy).
export async function handleNhl(pathParts, searchParams) {
  const path = pathParts.map(encodeURIComponent).join('/');
  const qs = searchParams.toString();
  const upstream = `https://api-web.nhle.com/${path}${qs ? `?${qs}` : ''}`;
  const resp = await fetch(upstream, { headers: { accept: 'application/json' } });
  // Re-wrap so we control the headers (CORS is added by the caller in index.js).
  return new Response(resp.body, {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') || 'application/json' },
  });
}
```

- [ ] **Step 2: Syntax-check**

Run: `/opt/homebrew/bin/node --check worker/src/nhl.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add worker/src/nhl.js
git commit -m "feat(worker): NHL transparent proxy handler"
```

---

### Task 7: Router + CORS lockdown (`index.js`)

**Files:**
- Modify: `worker/src/index.js` (replace the Task 1 placeholder)

- [ ] **Step 1: Replace `worker/src/index.js`**

```js
import { isAllowedOrigin } from './config.js';
import { handleNhl } from './nhl.js';
import { handleNfl } from './nfl.js';

function corsHeaders(origin) {
  const h = { 'Vary': 'Origin' };
  if (isAllowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return h;
}

function withCors(resp, origin) {
  const merged = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) merged.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: merged });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return withCors(new Response('method not allowed', { status: 405 }), origin);
    }
    // Lockdown: only allowed origins may read responses. Browsers send Origin on
    // cross-origin fetches; block early so we are not an open proxy.
    if (origin && !isAllowedOrigin(origin)) {
      return new Response('forbidden origin', { status: 403 });
    }

    const parts = url.pathname.split('/').filter(Boolean); // ['nhl', ...]
    const [scope, ...rest] = parts;
    try {
      if (scope === 'nhl') return withCors(await handleNhl(rest, url.searchParams), origin);
      if (scope === 'nfl') return withCors(await handleNfl(rest, url.searchParams), origin);
      return withCors(new Response(JSON.stringify({ routes: ['/nhl/<path>', '/nfl/player/<gsisId>'] }),
        { headers: { 'content-type': 'application/json' } }), origin);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: String(err) }),
        { status: 502, headers: { 'content-type': 'application/json' } }), origin);
    }
  },
};
```

- [ ] **Step 2: Syntax-check**

Run: `/opt/homebrew/bin/node --check worker/src/index.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.js
git commit -m "feat(worker): router with CORS origin lockdown"
```

---

### Task 8: Deploy + verify live (user-run login/deploy)

**Files:** none (verification only).

- [ ] **Step 1: Deploy** — run in your own shell (interactive Cloudflare OAuth):

```
! cd worker && npx --yes wrangler@latest deploy
```

Expected: prints `https://lightitup-data.dewittl.workers.dev`. Note the URL.

- [ ] **Step 2: Verify the NHL proxy returns official data**

Run (curl sends an allowed Origin to pass lockdown):
```bash
curl -s -H "Origin: https://whatadewitt.com" \
  "https://lightitup-data.dewittl.workers.dev/nhl/v1/player/8478402/game-log/20252026/2" \
  -D - -o /tmp/nhl.json | grep -i access-control-allow-origin
head -c 200 /tmp/nhl.json; echo
```
Expected: an `access-control-allow-origin: https://whatadewitt.com` header, and JSON starting `{"seasonId":20252026,...`.

- [ ] **Step 3: Verify the NFL per-quarter endpoint** (use a known gsisId — capture one from the fixture)

```bash
HURTS=$(/opt/homebrew/bin/node -e 'const g=require("./worker/fixtures/nfl-week1-dalphi.json");const ps=(g.driveChart?.plays||[]).flatMap(p=>p.stats||[]);const h=ps.find(s=>(s.gsisPlayerName||"").includes("Hurts"));process.stdout.write(h.gsisPlayerId)')
echo "Hurts gsisId=$HURTS"
curl -s -H "Origin: https://whatadewitt.com" \
  "https://lightitup-data.dewittl.workers.dev/nfl/player/$HURTS?season=2025" | /opt/homebrew/bin/node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("week1 quarters:",j.weeks["1"]);})'
```
Expected: `week1 quarters: { quarters: [ 25, 116, 26, 47 ] }` (matches the fixture test). A second call should be faster (edge-cached week).

- [ ] **Step 4: Verify the origin lockdown rejects a random origin**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: https://evil.example.com" \
  "https://lightitup-data.dewittl.workers.dev/nhl/v1/player/8478402/game-log/20252026/2"
```
Expected: `403`.

- [ ] **Step 5: Record the deployed URL**

Add the production URL to `worker/README.md` (replace the example URL with the real one) and commit:

```bash
git add worker/README.md
git commit -m "docs(worker): record deployed URL"
```

---

## Self-Review (completed)

**Spec coverage** (spec §3 The Cloudflare Worker): NHL transparent proxy → Task 6/7; NFL token mint + cache → Task 4; NFL weekly aggregation + edge cache + compact per-player output → Tasks 3/5; lockdown (host-scoped routes + Origin allow-list) → Task 2/7; lives in `worker/` with `wrangler.toml` → Task 1; deploy + verify → Task 8. The site-side URL constant is consumed in Plan 3 (NHL/NFL providers), not here.

**Placeholder scan:** the only intentional placeholder is the Task 1 `index.js`, explicitly replaced in Task 7. The Task 3 fixture step names the exact capture commands and an explicit fallback if the top-level `games` key differs. No "TODO/handle edge cases" left.

**Type/name consistency:** `aggregateWeek(blob) -> { players: { id: { name, quarters } } }` used identically in Tasks 3 and 5; `makeTokenCache().get()/invalidate()` used in Tasks 4 and 5; `handleNhl(pathParts, searchParams)` / `handleNfl(pathParts, searchParams)` signatures match Task 5/6 ↔ Task 7; `isAllowedOrigin` used in Tasks 2 and 7. Output shape `{ gsisId, season, weeks }` is what Plan 3's NFL provider will consume.

**Known approximation (carried from spec §5):** an NFL player who was active but recorded zero pass/rush/rec yards in a game will be absent from that week's aggregation and read as "missed" by the client. Accepted for v1; documented in `docs/data-sources.md` during Plan 4.
