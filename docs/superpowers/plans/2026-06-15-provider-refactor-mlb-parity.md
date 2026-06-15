# Provider Refactor + MLB Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a sport-provider abstraction (`sports/`) and move the existing MLB tool onto it, so `app.js` and the board become sport-agnostic — with **zero change to MLB's behavior or appearance**.

**Architecture:** A `SportProvider` interface encapsulates everything sport-specific (data fetching, metric→ramp-level, season length, labels, slot building). `app.js` keeps only generic concerns (the persistent board + ignite animation, search/suggestions, tooltip, nameplate, error/loading/empty states) and drives them through a single `currentProvider`. MLB becomes the first provider (`sports/mlb.js`) wrapping today's `statsapi.mlb.com` logic. Pure helpers stay in `lib.js`, unit-tested with `node --test`.

**Tech Stack:** Vanilla ES modules, no build step. Node's built-in test runner (`node --test`, run as `/opt/homebrew/bin/node`). Static site served locally for browser verification; screenshots via Chrome DevTools (headless min viewport 500px).

**Key references (current code, all on branch `feat/multi-sport`):**
- `app.js` — today's MLB app (board logic lines ~43-137, `buildSlots` ~143-174, `loadReferenceData` ~176-191, search ~198-288, `loadPlayer` ~315-389, tooltip ~391-451).
- `lib.js` — pure helpers: `TB_RAMP`, `levelForTotalBases`, `shadeForTotalBases`, `buildBattingLine`, `matchupLabel`, `normalizeGame`.
- `lib.test.js` — existing MLB tests (must stay green and unchanged).
- `index.html`, `styles.css` — unchanged in this plan (the league switcher + theming come in Plan 4; MLB stays green, subhead stays "total bases").

**Conventions:** run Node as `/opt/homebrew/bin/node`; commit after each task with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT modify `lib.test.js` (parity guarantee). Do NOT touch the `worker/` directory.

---

### Task 1: Generic `levelForValue(value, thresholds)` helper (TDD)

A sport-agnostic bucketer so every provider maps its metric to ramp levels 0–4 the same way. MLB's existing `levelForTotalBases` will be re-expressed with it (without changing results).

**Files:**
- Modify: `lib.js`
- Modify: `lib.test.js` — DO NOT touch existing tests; only APPEND new ones at the end.

- [ ] **Step 1: Append the failing test to `lib.test.js`**

```js
import { levelForValue } from './lib.js'; // add to the existing import line instead of a duplicate import

test('levelForValue: buckets by ascending thresholds into levels 0-4', () => {
  // thresholds = the inclusive upper bounds for levels 0..3; anything above => 4
  const t = [0, 2, 4, 6]; // MLB total bases: 0 / 1-2 / 3-4 / 5-6 / 7+
  assert.equal(levelForValue(0, t), 0);
  assert.equal(levelForValue(1, t), 1);
  assert.equal(levelForValue(2, t), 1);
  assert.equal(levelForValue(3, t), 2);
  assert.equal(levelForValue(6, t), 3);
  assert.equal(levelForValue(7, t), 4);
  assert.equal(levelForValue(99, t), 4);
});

test('levelForValue: missing/negative/NaN clamp to level 0', () => {
  const t = [0, 2, 4, 6];
  assert.equal(levelForValue(undefined, t), 0);
  assert.equal(levelForValue(null, t), 0);
  assert.equal(levelForValue(-5, t), 0);
});
```

Note: the existing top-of-file import is `import { shadeForTotalBases, levelForTotalBases, TB_RAMP, buildBattingLine, matchupLabel, normalizeGame } from './lib.js';`. Edit that line to also import `levelForValue` (don't add a second import statement).

- [ ] **Step 2: Run to verify it fails**

Run: `/opt/homebrew/bin/node --test`
Expected: FAIL — `levelForValue` is not exported.

- [ ] **Step 3: Implement `levelForValue` in `lib.js`**

Add near the top (after `TB_RAMP`):

```js
// Generic ramp bucketer shared by every sport. `thresholds` are the inclusive
// upper bounds for levels 0,1,2,3 (in ascending order); any value above the last
// threshold is level 4. Non-finite or <= 0 values clamp to level 0. Intensity is
// carried by luminance in the ramp, so this stays colorblind-safe per sport.
export function levelForValue(value, thresholds) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (n <= thresholds[i]) return i;
  }
  return thresholds.length; // one past the last threshold => top level (4)
}
```

- [ ] **Step 4: Re-express `levelForTotalBases` using it (results unchanged)**

Replace the body of the existing `levelForTotalBases` with a delegation, keeping its export and behavior identical:

```js
const MLB_TB_THRESHOLDS = [0, 2, 4, 6]; // 0 / 1-2 / 3-4 / 5-6 / 7+

// Map a game's total bases to a ramp level 0-4 (MLB-specific thresholds).
export function levelForTotalBases(tb) {
  return levelForValue(tb, MLB_TB_THRESHOLDS);
}
```

- [ ] **Step 5: Run the full suite**

Run: `/opt/homebrew/bin/node --test`
Expected: PASS — all existing `levelForTotalBases`/`shadeForTotalBases` tests still pass (behavior identical) plus the 2 new `levelForValue` tests.

- [ ] **Step 6: Commit**

```bash
git add lib.js lib.test.js
git commit -m "feat(lib): add generic levelForValue; re-express MLB level on it

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sport-provider interface + registry

**Files:**
- Create: `sports/provider.js` (interface contract as JSDoc — no runtime code)
- Create: `sports/index.js` (registry)

- [ ] **Step 1: Create `sports/provider.js`** (documentation/contract only)

```js
// The SportProvider interface. Each league exports one object with this shape.
// app.js / the board are sport-agnostic and drive everything through the
// currently-selected provider.
//
// @typedef {Object} Slot          One board cell.
//   @property {'played'|'missed'|'future'} state
//   @property {number} [value]     The metric for this box (e.g. total bases). played only.
//   @property {string} [opp]       Opponent abbrev (played/missed).
//   @property {boolean} [isHome]   Home game? (played/missed).
//   @property {string} [tooltipLine] Secondary tooltip text (e.g. batting line). played only.
//   @property {string} [date]      ISO date, if known.
//   @property {string} [label]     Box label for aria/tooltip (e.g. "Game 5", "Q3"). optional.
//
// @typedef {Object} SeasonResult
//   @property {Slot[]} slots        Ordered, one per box, length up to seasonBoxes.
//   @property {boolean} empty        True if the player has no data yet (show empty message).
//
// @typedef {Object} Stat            One nameplate stat.
//   @property {number|string} value
//   @property {string} label
//
// @typedef {Object} SportProvider
//   @property {string} id            'mlb'
//   @property {string} name          'MLB'
//   @property {string} accent        data-league key (theming, Plan 4). 'mlb'
//   @property {number} seasonBoxes   persistent board size (162)
//   @property {string} unit          box granularity label: 'game' | 'quarter'
//   @property {string} metricLabel   'total bases'
//   @property {(value:number)=>number} levelForValue   metric -> ramp level 0-4
//   @property {()=>Promise<Array<{id,fullName,teamId,teamAbbrev}>>} loadPlayers
//   @property {(player)=>Promise<SeasonResult>} loadPlayerSeason
//   @property {(slots:Slot[])=>Stat[]} nameplateStats
//   @property {(slot:Slot, ordinal:number)=>string} boxAria   full aria-label for a played box
export {};
```

- [ ] **Step 2: Create `sports/index.js`**

```js
import { mlb } from './mlb.js';

// Ordered league registry. MLB only for now; NHL/NFL/NBA added in Plan 3.
export const LEAGUES = [mlb];

export const DEFAULT_LEAGUE = 'mlb';

export function getProvider(id) {
  return LEAGUES.find((p) => p.id === id) || LEAGUES.find((p) => p.id === DEFAULT_LEAGUE);
}
```

- [ ] **Step 3: Syntax check** (will fail to import until Task 3 creates mlb.js — that's expected; just check provider.js)

Run: `/opt/homebrew/bin/node --check sports/provider.js`
Expected: exit 0. (Do not run `index.js` yet — it imports `mlb.js`, created next.)

- [ ] **Step 4: Commit**

```bash
git add sports/provider.js sports/index.js
git commit -m "feat(sports): provider interface contract + registry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: MLB provider (`sports/mlb.js`) + slot-builder test

Move the MLB-specific data + slot logic out of `app.js` into a provider. The pure `buildSlots` (currently `app.js:143-174`) moves here, parameterized by the team-abbrev map so it is testable.

**Files:**
- Create: `sports/mlb.js`
- Create: `sports/mlb.test.js`

- [ ] **Step 1: Create `sports/mlb.js`**

```js
import { levelForTotalBases, matchupLabel, normalizeGame } from '../lib.js';

const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = 2026;
const SEASON_GAMES = 162;

let teamAbbrev = {}; // id -> "NYY", populated by loadPlayers

async function getJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
  return resp.json();
}

// Pure: lay the season out across the board in schedule order, dropping the
// player's played games (by gamePk) into their real calendar positions. Returns
// generalized slots + how many played games were placed (so the caller can detect
// a mid-season trade and fall back). `abbrev` is the team-id -> abbrev map.
export function buildSlots(sched, teamId, playedByPk, abbrev) {
  const seen = new Set();
  const games = [];
  for (const d of sched.dates || []) {
    for (const g of d.games || []) {
      if (g.gamePk == null || seen.has(g.gamePk)) continue;
      seen.add(g.gamePk);
      games.push(g);
    }
  }
  const placed = new Set();
  const slots = games.map((g) => {
    const split = playedByPk.get(g.gamePk);
    if (split) {
      placed.add(g.gamePk);
      const ng = normalizeGame(split, abbrev, 0);
      return { state: 'played', value: ng.totalBases, opp: ng.opp, isHome: ng.isHome, tooltipLine: ng.line, date: ng.date };
    }
    const status = g.status || {};
    const isFinal = status.abstractGameState === 'Final' || status.codedGameState === 'F';
    const dead = /Cancelled|Postponed|Suspended/i.test(status.detailedState || '');
    const home = g.teams && g.teams.home && g.teams.home.team;
    const away = g.teams && g.teams.away && g.teams.away.team;
    const isHome = !!(home && home.id === teamId);
    const oppTeam = isHome ? away : home;
    const oppId = oppTeam && oppTeam.id;
    const opp = abbrev[oppId] || (oppTeam && oppTeam.name) || '???';
    if (isFinal && !dead) return { state: 'missed', opp, isHome };
    return { state: 'future', opp, isHome };
  });
  return { slots, placed: placed.size };
}

// Map raw game-log splits straight to played slots (fallback when schedule
// alignment can't place every game, e.g. a mid-season trade).
function slotsFromSplits(splits) {
  return splits.map((s) => {
    const ng = normalizeGame(s, teamAbbrev, 0);
    return { state: 'played', value: ng.totalBases, opp: ng.opp, isHome: ng.isHome, tooltipLine: ng.line, date: ng.date };
  });
}

export const mlb = {
  id: 'mlb',
  name: 'MLB',
  accent: 'mlb',
  seasonBoxes: SEASON_GAMES,
  unit: 'game',
  metricLabel: 'total bases',
  levelForValue: (v) => levelForTotalBases(v),

  async loadPlayers() {
    const [teamsData, playersData] = await Promise.all([
      getJSON(`${API}/teams?sportId=1`),
      getJSON(`${API}/sports/1/players?season=${SEASON}`),
    ]);
    teamAbbrev = {};
    for (const t of teamsData.teams || []) teamAbbrev[t.id] = t.abbreviation;
    return (playersData.people || [])
      // Hitting tool — drop pitchers, keep two-way players (e.g. Ohtani).
      .filter((p) => !p.primaryPosition || p.primaryPosition.type !== 'Pitcher')
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        teamId: p.currentTeam && p.currentTeam.id,
        teamAbbrev: teamAbbrev[p.currentTeam && p.currentTeam.id] || '',
      }));
  },

  async loadPlayerSeason(player) {
    const logUrl = `${API}/people/${player.id}/stats?stats=gameLog&season=${SEASON}&group=hitting`;
    const schedUrl = player.teamId
      ? `${API}/schedule?sportId=1&season=${SEASON}&teamId=${player.teamId}&gameType=R`
      : null;
    const [data, sched] = await Promise.all([
      getJSON(logUrl),
      schedUrl ? getJSON(schedUrl).catch(() => null) : Promise.resolve(null),
    ]);

    const splits = (data.stats && data.stats[0] && data.stats[0].splits) || [];
    if (!splits.length) return { slots: [], empty: true };

    const playedByPk = new Map();
    for (const s of splits) {
      const pk = s.game && s.game.gamePk;
      if (pk != null) playedByPk.set(pk, s);
    }

    let slots;
    if (sched && sched.dates) {
      const built = buildSlots(sched, player.teamId, playedByPk, teamAbbrev);
      slots = built.placed === playedByPk.size ? built.slots : slotsFromSplits(splits);
    } else {
      slots = slotsFromSplits(splits);
    }
    return { slots, empty: false };
  },

  nameplateStats(slots) {
    const played = slots.filter((s) => s.state === 'played');
    const totalTB = played.reduce((sum, s) => sum + (s.value || 0), 0);
    const best = played.reduce((m, s) => Math.max(m, s.value || 0), 0);
    return [
      { value: played.length, label: 'Games' },
      { value: totalTB, label: 'Total Bases' },
      { value: best, label: 'Best Game' },
    ];
  },

  boxAria(slot, ordinal) {
    const matchup = matchupLabel(slot.isHome, slot.opp);
    const bases = slot.value === 1 ? '1 total base' : `${slot.value} total bases`;
    return `Game ${ordinal}, ${matchup}: ${bases}. ${slot.tooltipLine}`;
  },
};
```

- [ ] **Step 2: Create `sports/mlb.test.js`** (covers the pure `buildSlots`, which was previously untested)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots } from './mlb.js';

const abbrev = { 111: 'BOS', 147: 'NYY' };

function sched(games) { return { dates: [{ games }] }; }

test('buildSlots: played game placed by gamePk with generalized shape', () => {
  const playedByPk = new Map([[1, {
    date: '2026-04-01', isHome: true, opponent: { id: 111, name: 'Boston Red Sox' },
    stat: { hits: 2, atBats: 4, doubles: 1, totalBases: 3 },
  }]]);
  const { slots, placed } = buildSlots(
    sched([{ gamePk: 1, status: { abstractGameState: 'Final' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, playedByPk, abbrev,
  );
  assert.equal(placed, 1);
  assert.deepEqual(slots[0], { state: 'played', value: 3, opp: 'BOS', isHome: true, tooltipLine: '2 / 4, 2B', date: '2026-04-01' });
});

test('buildSlots: final game the player missed => missed slot', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 2, status: { abstractGameState: 'Final' }, teams: { home: { team: { id: 111 } }, away: { team: { id: 147 } } } }]),
    147, new Map(), abbrev,
  );
  assert.deepEqual(slots[0], { state: 'missed', opp: 'BOS', isHome: false });
});

test('buildSlots: not-yet-final game => future slot', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 3, status: { abstractGameState: 'Preview' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, new Map(), abbrev,
  );
  assert.deepEqual(slots[0], { state: 'future', opp: 'BOS', isHome: true });
});

test('buildSlots: postponed final is treated as future, not missed', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 4, status: { abstractGameState: 'Final', detailedState: 'Postponed' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, new Map(), abbrev,
  );
  assert.equal(slots[0].state, 'future');
});

test('buildSlots: dedupes repeated gamePk (suspended/resumed)', () => {
  const g = { gamePk: 5, status: { abstractGameState: 'Preview' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } };
  const { slots } = buildSlots(sched([g, g]), 147, new Map(), abbrev);
  assert.equal(slots.length, 1);
});
```

- [ ] **Step 3: Run the suite**

Run: `/opt/homebrew/bin/node --test`
Expected: PASS — existing tests + the 5 new `buildSlots` tests. Also run `/opt/homebrew/bin/node --check sports/index.js` (now resolves) — exit 0.

- [ ] **Step 4: Commit**

```bash
git add sports/mlb.js sports/mlb.test.js
git commit -m "feat(sports): MLB provider on statsapi with tested slot builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Make `app.js` sport-agnostic (provider-driven)

Rewire `app.js` to drive everything through `currentProvider`. This removes the MLB constants and the MLB fetch/slot code (now in the provider) and replaces sport-specific bits in the board/nameplate/aria with provider calls. **No visible behavior change for MLB.**

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace the imports + constants block (top of `app.js`, lines 1-9)**

Old:
```js
import { levelForTotalBases, matchupLabel, normalizeGame } from './lib.js';

const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = 2026;
const SEASON_GAMES = 162;      // full regular season — the board is always this many slots
const MAX_SUGGESTIONS = 8;
const REVEAL_STEP_MS = 4;      // per-cell stagger
const REVEAL_CAP_MS = 640;     // never take longer than this to light all 162
const MIN_FADE_MS = 240;       // ensure the old lights read as "fading out" before the new sweep
```

New:
```js
import { matchupLabel } from './lib.js';
import { getProvider, DEFAULT_LEAGUE } from './sports/index.js';

let currentProvider = getProvider(DEFAULT_LEAGUE);

const MAX_SUGGESTIONS = 8;
const REVEAL_STEP_MS = 4;      // per-cell stagger
const REVEAL_CAP_MS = 640;     // never take longer than this to light the whole board
const MIN_FADE_MS = 240;       // ensure the old lights read as "fading out" before the new sweep
```

- [ ] **Step 2: Drive board size from the provider**

Replace the `ensureBoard(SEASON_GAMES);` call (≈line 73) with:
```js
ensureBoard(currentProvider.seasonBoxes);
```
And in `lightUpBoard` (≈line 117), replace `ensureBoard(Math.max(SEASON_GAMES, slots.length));` with:
```js
ensureBoard(Math.max(currentProvider.seasonBoxes, slots.length));
```

- [ ] **Step 3: Make `applySlot` provider-driven**

Replace the whole `applySlot` function (≈lines 89-113) with this generalized version (uses `slot.value`, `provider.levelForValue`, `provider.boxAria`):

```js
function applySlot(c, slot, ordinal) {
  if (slot.state === 'played') {
    const matchup = matchupLabel(slot.isHome, slot.opp);
    c.dataset.state = 'played';
    c.dataset.level = String(currentProvider.levelForValue(slot.value));
    c.dataset.matchup = matchup;
    c.dataset.line = slot.tooltipLine || '';
    c.tabIndex = 0;
    c.removeAttribute('aria-hidden');
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', currentProvider.boxAria(slot, ordinal));
  } else if (slot.state === 'missed') {
    c.dataset.state = 'missed';
    c.removeAttribute('data-level');
    c.dataset.matchup = matchupLabel(slot.isHome, slot.opp);
    c.dataset.line = 'Did not play';
    c.tabIndex = -1;
    c.removeAttribute('role');
    c.removeAttribute('aria-label');
    c.setAttribute('aria-hidden', 'true');
  } else {
    resetCell(c); // future socket
  }
}
```

- [ ] **Step 4: Remove the MLB-specific `buildSlots` from `app.js`**

Delete the entire `buildSlots` function (≈lines 139-174) — it now lives in `sports/mlb.js`. (Its block comment moves with it.)

- [ ] **Step 5: Replace reference-data loading with the provider**

Replace `loadReferenceData` + its invocation (≈lines 176-196) and the `teamAbbrev`/`players` module vars (≈lines 25-26). Remove `let teamAbbrev = {};` (no longer used in app.js — opponent abbrevs now arrive inside slots/suggestions). Keep `let players = [];`. New loader:

```js
async function loadPlayers() {
  players = await currentProvider.loadPlayers();
}

loadPlayers().catch((err) => {
  console.error(err);
  showError('Could not load the player list. Refresh to try again.');
});
```

- [ ] **Step 6: Fix the suggestion team abbrev to use the player record**

In `renderSuggestions` (≈line 232), the suggestion currently reads `teamAbbrev[p.teamId]`. Change it to use the abbrev now carried on the player object:
```js
        <span class="suggestion__team">${escapeHtml(p.teamAbbrev || '')}</span>
```

- [ ] **Step 7: Rewrite `loadPlayer` to use the provider**

Replace the whole `loadPlayer` function (≈lines 315-389) with:

```js
async function loadPlayer(player) {
  const requestId = ++currentRequestId;
  clearError();
  show(el.nameplate, true);
  renderNameplateLoading(player);
  hideTooltip();
  fadeBoardOff();

  try {
    const { slots, empty } = await currentProvider.loadPlayerSeason(player);
    if (requestId !== currentRequestId) return;

    if (empty) {
      show(el.nameplate, false);
      show(el.legend, false);
      showError(`No ${currentProvider.name} games for ${player.fullName} yet — check back later.`);
      return;
    }

    const playedCount = slots.filter((s) => s.state === 'played').length;
    const teamGamesSoFar = slots.filter((s) => s.state !== 'future').length || playedCount;

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : MIN_FADE_MS) - fadeStart;
    const wait = Math.max(0, MIN_FADE_MS - elapsed);

    const apply = () => {
      if (requestId !== currentRequestId) return;
      renderNameplate(player, slots);
      show(el.legend, true);
      el.grid.setAttribute('aria-label',
        `${player.fullName}'s ${currentProvider.name} season — played ${playedCount} of the team's ${teamGamesSoFar} games so far, ${currentProvider.metricLabel} per ${currentProvider.unit}`);
      el.status.textContent =
        `${player.fullName}: played ${playedCount} of the team's ${teamGamesSoFar} games so far.`;
      lightUpBoard(slots, requestId);
    };
    if (wait > 0) setTimeout(apply, wait); else apply();
  } catch (err) {
    if (requestId !== currentRequestId) return;
    console.error(err);
    show(el.nameplate, false);
    show(el.legend, false);
    showError('Could not load that season. Please try again.');
  }
}
```

- [ ] **Step 8: Make the nameplate provider-driven**

Replace `renderNameplate` (≈lines 302-313) so it renders the provider's stat cluster. Keep `renderNameplateLoading` as-is.

```js
function renderNameplate(player, slots) {
  const teamAbbr = player.teamAbbrev || '';
  const stats = currentProvider.nameplateStats(slots);
  const statsHtml = stats.map((s, i) =>
    `<div class="stat"><span class="stat__value">${escapeHtml(String(s.value))}</span><span class="stat__label">${i === 0 && teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}${escapeHtml(s.label)}</span></div>`
  ).join('');
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">${statsHtml}</div>`;
}
```

Also update `renderNameplateLoading` (≈line 293) to use `player.teamAbbrev` instead of `teamAbbrev[player.teamId]`:
```js
function renderNameplateLoading(player) {
  const teamAbbr = player.teamAbbrev || '';
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">
      <span class="nameplate__loading">${teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}Loading season…</span>
    </div>`;
}
```

- [ ] **Step 9: Syntax check + full test suite**

Run: `/opt/homebrew/bin/node --check app.js && /opt/homebrew/bin/node --test`
Expected: app.js parses; all tests pass (app.js itself has no unit tests — it's DOM/fetch glue verified in the browser next).

- [ ] **Step 10: Commit**

```bash
git add app.js
git commit -m "refactor(app): drive board/search/nameplate through currentProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Browser parity verification (MLB unchanged)

Confirm the refactor produced **no visible change** for MLB.

**Files:** none (verification only).

- [ ] **Step 1: Serve the site locally**

Run (background): `/opt/homebrew/bin/node --version >/dev/null; cd /Users/ldewitt/code/Personal/tbgraph && python3 -m http.server 8099`
(Any static server on a localhost port works; the app uses relative paths + ES modules so it must be served over http, not file://.)

- [ ] **Step 2: Load and exercise it in a real browser** (Chrome DevTools MCP; viewport ≥ 500px)

- Navigate to `http://localhost:8099/`.
- Confirm: masthead "Light it Up", subhead "total bases", search field present, no console errors, the board renders as a grid of dark sockets.
- Type a known active hitter (e.g. "Aaron Judge"), pick the suggestion.
- Confirm: nameplate shows Name + Games / Total Bases / Best Game; the board ignites in schedule order (played = green ramp, missed = slate, future = dark socket); hovering a played cell shows the tooltip (matchup + batting line); focus ring works on keyboard tab.

- [ ] **Step 3: Capture screenshots** desktop (≥1000px wide) and mobile (500px wide) of: the empty/initial state and a loaded player. Save under `/tmp/` and confirm they match the pre-refactor look (phosphor-green scoreboard, same layout).

- [ ] **Step 4: Verify the three states + error path**

- A player with missed games shows slate cells; a future/early-season player shows dark sockets.
- Searching a name with no results shows "No players found"; an invalid/no-data player shows the empty message.

- [ ] **Step 5: Stop the server and report**

Note any deviation from the previous MLB behavior. If parity holds, Plan 2 is complete. No code commit (verification only); if a bug is found, fix it in the relevant file with a TDD test where possible, then re-verify.

---

## Self-Review (completed)

**Spec coverage** (spec §4 architecture, §8 nameplate/tooltip): provider interface + registry → Tasks 2; MLB provider wrapping statsapi with generalized slots → Task 3; `app.js`/board sport-agnostic and provider-driven → Task 4; generic `levelForValue` pure helper → Task 1; nameplate/aria via provider → Task 4/3; pure helpers stay unit-tested → Tasks 1/3 (+ `lib.test.js` untouched for MLB parity). Theming, the league switcher, NHL/NFL/NBA, and `docs/data-sources.md` are explicitly later plans.

**Placeholder scan:** none. Every step shows the actual code or exact command.

**Type/name consistency:** the generalized `Slot` shape `{state, value, opp, isHome, tooltipLine, date}` is produced by `mlb.buildSlots`/`loadPlayerSeason` (Task 3) and consumed by `applySlot`/`nameplateStats`/`boxAria`/`loadPlayer` (Task 4) identically. `loadPlayerSeason` returns `{slots, empty}` (Task 3) and `loadPlayer` destructures exactly that (Task 4). `loadPlayers()` returns records with `teamAbbrev`, consumed by suggestions + nameplate (Task 4). `levelForValue(value, thresholds)` signature is consistent between Task 1 (lib) and its MLB use. Provider props (`seasonBoxes`, `unit`, `metricLabel`, `name`, `accent`, `levelForValue`, `boxAria`, `nameplateStats`) match between `mlb.js` (Task 3) and `app.js` usage (Task 4).

**Parity guarantee:** MLB ramp thresholds, fetch URLs, three-state logic, reveal animation, and tooltip content are carried over verbatim; `lib.test.js` is untouched; Task 5 verifies the visible result is unchanged.
