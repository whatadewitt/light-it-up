# MLB Total-Bases Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page app to search an active MLB player (typeahead) and view a GitHub-style heatmap of their total bases per game for the 2026 season, with per-game tooltips showing opponent and batting line.

**Architecture:** Static client-side app, no backend. Pure logic (batting-line string, color-shade mapping, game normalization) lives in `lib.js` and is unit-tested with `node --test`. The DOM/fetch/tooltip glue lives in `app.js`, imports `lib.js`, and is verified manually against the live MLB StatsAPI. Served over http via `python3 -m http.server` (no build step).

**Tech Stack:** Vanilla JS (ES modules), Tailwind CSS (CDN), MLB StatsAPI (`statsapi.mlb.com`, public, no key), Node.js `node --test` for unit tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | `{"type":"module"}` so `.js` files are ES modules in Node and the browser. |
| `lib.js` | Pure functions: `shadeForTotalBases`, `buildBattingLine`, `matchupLabel`, `normalizeGame`. No DOM, no fetch. |
| `lib.test.js` | `node --test` unit tests for `lib.js`. |
| `index.html` | Markup, Tailwind, styles, mount points; loads `app.js` as a module. |
| `app.js` | Orchestration: load reference data, typeahead, fetch game log, render heatmap, tooltip, states. Imports `lib.js`. |
| `index-cohere.html` | Untouched reference prototype. |

**Shared types (used across tasks — names are fixed):**

- A `stat` object (from the API split's `.stat`) has numeric fields: `atBats`, `hits`, `doubles`, `triples`, `homeRuns`, `baseOnBalls`, `hitByPitch`, `totalBases`. Any may be missing/undefined → treat as `0`.
- A normalized **game record**: `{ index: number, date: string, opp: string, isHome: boolean, totalBases: number, line: string }`.
- `teamAbbrev`: a plain object mapping team `id` (number) → abbreviation string (e.g. `{147: "NYY"}`).

---

### Task 1: Project scaffold + module config

**Files:**
- Create: `package.json`
- Create: `lib.js` (empty placeholder with a comment)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tbgraph",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `lib.js` placeholder**

```js
// Pure helpers for the MLB total-bases heatmap. No DOM, no fetch.
```

- [ ] **Step 3: Verify Node runs the empty test suite**

Run: `node --test`
Expected: exits 0 with "tests 0" (no test files yet) — confirms Node + ESM config work.

- [ ] **Step 4: Commit**

```bash
git add package.json lib.js
git commit -m "chore: scaffold module config and lib placeholder"
```

---

### Task 2: `shadeForTotalBases` (TDD)

Maps a game's total bases to a GitHub-style green hex shade.

**Files:**
- Modify: `lib.js`
- Test: `lib.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadeForTotalBases } from './lib.js';

test('shadeForTotalBases maps total bases to GitHub green shades', () => {
  assert.equal(shadeForTotalBases(0), '#ebedf0');
  assert.equal(shadeForTotalBases(1), '#9be9a8');
  assert.equal(shadeForTotalBases(2), '#9be9a8');
  assert.equal(shadeForTotalBases(3), '#40c463');
  assert.equal(shadeForTotalBases(4), '#40c463');
  assert.equal(shadeForTotalBases(5), '#30a14e');
  assert.equal(shadeForTotalBases(6), '#30a14e');
  assert.equal(shadeForTotalBases(7), '#216e39');
  assert.equal(shadeForTotalBases(12), '#216e39');
});

test('shadeForTotalBases treats missing/negative as empty', () => {
  assert.equal(shadeForTotalBases(undefined), '#ebedf0');
  assert.equal(shadeForTotalBases(null), '#ebedf0');
  assert.equal(shadeForTotalBases(-1), '#ebedf0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `shadeForTotalBases` is not exported (SyntaxError / undefined import).

- [ ] **Step 3: Write minimal implementation**

Append to `lib.js`:

```js
export function shadeForTotalBases(tb) {
  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return '#ebedf0';
  if (n <= 2) return '#9be9a8';
  if (n <= 4) return '#40c463';
  if (n <= 6) return '#30a14e';
  return '#216e39';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib.js lib.test.js
git commit -m "feat: add total-bases color shade mapping"
```

---

### Task 3: `buildBattingLine` (TDD)

Builds the tooltip's batting-line string from a `stat` object.

**Files:**
- Modify: `lib.js`
- Modify: `lib.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib.test.js`:

```js
import { buildBattingLine } from './lib.js';

const stat = (o = {}) => ({
  atBats: 0, hits: 0, doubles: 0, triples: 0,
  homeRuns: 0, baseOnBalls: 0, hitByPitch: 0, ...o,
});

test('buildBattingLine: hits/atBats only when no events', () => {
  assert.equal(buildBattingLine(stat({ hits: 0, atBats: 4 })), '0 / 4');
});

test('buildBattingLine: example 1/3 with a double and a walk', () => {
  assert.equal(
    buildBattingLine(stat({ hits: 1, atBats: 3, doubles: 1, baseOnBalls: 1 })),
    '1 / 3, 2B, BB'
  );
});

test('buildBattingLine: counts >1 are prefixed, order 2B/3B/HR/BB/HBP', () => {
  assert.equal(
    buildBattingLine(stat({ hits: 2, atBats: 4, doubles: 2, homeRuns: 1, baseOnBalls: 1 })),
    '2 / 4, 2 2B, HR, BB'
  );
  assert.equal(
    buildBattingLine(stat({ hits: 3, atBats: 4, triples: 1, homeRuns: 2, hitByPitch: 1 })),
    '3 / 4, 3B, 2 HR, HBP'
  );
});

test('buildBattingLine: a walk with no hits', () => {
  assert.equal(buildBattingLine(stat({ hits: 0, atBats: 3, baseOnBalls: 1 })), '0 / 3, BB');
});

test('buildBattingLine: missing fields treated as zero', () => {
  assert.equal(buildBattingLine({}), '0 / 0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `buildBattingLine` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib.js`:

```js
export function buildBattingLine(stat = {}) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const head = `${n(stat.hits)} / ${n(stat.atBats)}`;
  const events = [
    ['2B', n(stat.doubles)],
    ['3B', n(stat.triples)],
    ['HR', n(stat.homeRuns)],
    ['BB', n(stat.baseOnBalls)],
    ['HBP', n(stat.hitByPitch)],
  ];
  const tokens = events
    .filter(([, count]) => count > 0)
    .map(([label, count]) => (count > 1 ? `${count} ${label}` : label));
  return tokens.length ? `${head}, ${tokens.join(', ')}` : head;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all batting-line tests).

- [ ] **Step 5: Commit**

```bash
git add lib.js lib.test.js
git commit -m "feat: add batting-line string builder"
```

---

### Task 4: `matchupLabel` + `normalizeGame` (TDD)

`matchupLabel` formats the tooltip's matchup line. `normalizeGame` turns a raw API split into a game record.

**Files:**
- Modify: `lib.js`
- Modify: `lib.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib.test.js`:

```js
import { matchupLabel, normalizeGame } from './lib.js';

test('matchupLabel: vs for home, @ for away', () => {
  assert.equal(matchupLabel(true, 'NYY'), 'vs. NYY');
  assert.equal(matchupLabel(false, 'NYY'), '@ NYY');
});

test('normalizeGame: maps a split into a game record', () => {
  const split = {
    date: '2026-04-01',
    isHome: false,
    opponent: { id: 147, name: 'New York Yankees' },
    stat: { hits: 1, atBats: 3, doubles: 1, baseOnBalls: 1, totalBases: 2 },
  };
  const teamAbbrev = { 147: 'NYY' };
  assert.deepEqual(normalizeGame(split, teamAbbrev, 5), {
    index: 5,
    date: '2026-04-01',
    opp: 'NYY',
    isHome: false,
    totalBases: 2,
    line: '1 / 3, 2B, BB',
  });
});

test('normalizeGame: falls back to opponent name when abbrev missing', () => {
  const split = {
    date: '2026-04-02',
    isHome: true,
    opponent: { id: 999, name: 'Mystery Team' },
    stat: { hits: 0, atBats: 4, totalBases: 0 },
  };
  const g = normalizeGame(split, {}, 0);
  assert.equal(g.opp, 'Mystery Team');
  assert.equal(g.totalBases, 0);
  assert.equal(g.line, '0 / 4');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `matchupLabel` / `normalizeGame` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib.js`:

```js
export function matchupLabel(isHome, abbrev) {
  return `${isHome ? 'vs.' : '@'} ${abbrev}`;
}

export function normalizeGame(split, teamAbbrev = {}, index = 0) {
  const stat = split.stat || {};
  const oppId = split.opponent && split.opponent.id;
  const opp = teamAbbrev[oppId] || (split.opponent && split.opponent.name) || '???';
  const tb = Number(stat.totalBases);
  return {
    index,
    date: split.date || '',
    opp,
    isHome: Boolean(split.isHome),
    totalBases: Number.isFinite(tb) ? tb : 0,
    line: buildBattingLine(stat),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all lib tests).

- [ ] **Step 5: Commit**

```bash
git add lib.js lib.test.js
git commit -m "feat: add matchup label and game normalization"
```

---

### Task 5: HTML shell

Static markup, Tailwind, tooltip element, and mount points. No behavior yet.

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MLB Total Bases — 2026</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .hidden { display: none; }
    .spinner {
      border: 3px solid rgba(0,0,0,.1);
      width: 28px; height: 28px;
      border-left-color: #30a14e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .suggestion-item:hover, .suggestion-item.active { background:#e5e7eb; cursor:pointer; }
    .cell { width:14px; height:14px; border-radius:3px; outline:none; }
    .cell:focus { box-shadow:0 0 0 2px #1f6feb; }
    #tooltip { position:fixed; z-index:50; pointer-events:none; }
  </style>
</head>
<body class="bg-gray-100 text-gray-800 p-4 sm:p-6">
  <div class="max-w-4xl mx-auto bg-white rounded-lg shadow p-5 sm:p-8">
    <h1 class="text-2xl font-bold mb-1">MLB Total Bases — 2026</h1>
    <p class="text-sm text-gray-500 mb-5">Search an active player to see total bases per game.</p>

    <div class="relative">
      <label for="player-search" class="block text-sm font-medium mb-1">Search Player</label>
      <input id="player-search" type="text" autocomplete="off"
             placeholder="e.g., Aaron Judge"
             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600">
      <div id="suggestions"
           class="absolute left-0 right-0 mt-1 border border-gray-300 rounded-md bg-white max-h-60 overflow-y-auto hidden shadow z-10"></div>
    </div>

    <div id="loading" class="hidden justify-center mt-6"><div class="spinner"></div></div>
    <div id="error-msg" class="text-red-600 mt-4 hidden"></div>

    <div id="result" class="mt-6 hidden">
      <div id="player-header" class="mb-3"></div>
      <div id="grid" class="flex flex-wrap gap-[3px]"></div>
      <div class="flex items-center gap-1 mt-4 text-xs text-gray-500">
        <span>Less</span>
        <span class="cell" style="background:#ebedf0"></span>
        <span class="cell" style="background:#9be9a8"></span>
        <span class="cell" style="background:#40c463"></span>
        <span class="cell" style="background:#30a14e"></span>
        <span class="cell" style="background:#216e39"></span>
        <span>More</span>
      </div>
    </div>
  </div>

  <div id="tooltip" class="hidden bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
    <div id="tooltip-matchup" class="font-semibold"></div>
    <div id="tooltip-line"></div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify it loads**

Run: `python3 -m http.server 8000` then open `http://localhost:8000/`.
Expected: heading, search box, color legend hidden inside the (hidden) result block. Console shows a 404/empty for `app.js` (created next) — that's fine.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML shell, tooltip, and legend"
```

---

### Task 6: Load reference data (teams + players)

On load, fetch the team-abbreviation map and the active-player list in parallel; cache in memory.

**Files:**
- Create: `app.js`

- [ ] **Step 1: Write `app.js` with reference loading + element refs**

```js
import { shadeForTotalBases, matchupLabel, normalizeGame } from './lib.js';

const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = 2026;

const el = {
  search: document.getElementById('player-search'),
  suggestions: document.getElementById('suggestions'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error-msg'),
  result: document.getElementById('result'),
  header: document.getElementById('player-header'),
  grid: document.getElementById('grid'),
  tooltip: document.getElementById('tooltip'),
  tipMatchup: document.getElementById('tooltip-matchup'),
  tipLine: document.getElementById('tooltip-line'),
};

let teamAbbrev = {};   // id -> "NYY"
let players = [];      // [{ id, fullName, teamId }]

function show(node, on) { node.classList.toggle('hidden', !on); }
function showError(msg) { el.error.textContent = msg; show(el.error, true); }
function clearError() { el.error.textContent = ''; show(el.error, false); }

async function getJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
  return resp.json();
}

async function loadReferenceData() {
  const [teamsData, playersData] = await Promise.all([
    getJSON(`${API}/teams?sportId=1`),
    getJSON(`${API}/sports/1/players?season=${SEASON}`),
  ]);
  teamAbbrev = {};
  for (const t of teamsData.teams || []) teamAbbrev[t.id] = t.abbreviation;
  players = (playersData.people || []).map((p) => ({
    id: p.id,
    fullName: p.fullName,
    teamId: p.currentTeam && p.currentTeam.id,
  }));
  console.log(`Loaded ${players.length} players, ${Object.keys(teamAbbrev).length} teams`);
}

loadReferenceData().catch((err) => {
  console.error(err);
  showError('Could not load player list. Refresh to try again.');
});
```

- [ ] **Step 2: Verify reference data loads**

Run: serve and open `http://localhost:8000/`. In the console expect: `Loaded 1210 players, 30 teams` (counts will vary slightly).
Expected: no error banner; both fetches succeed.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: load team and active-player reference data"
```

---

### Task 7: Typeahead

Filter cached players client-side; render suggestions; select via click or keyboard.

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add typeahead logic**

Append to `app.js`:

```js
let activeIndex = -1;   // highlighted suggestion
let matches = [];

function renderSuggestions() {
  if (!matches.length) { show(el.suggestions, false); return; }
  el.suggestions.innerHTML = matches
    .map((p, i) => `
      <div class="suggestion-item px-4 py-2 border-b last:border-b-0 ${i === activeIndex ? 'active' : ''}"
           data-i="${i}">
        <span class="font-medium">${p.fullName}</span>
        <span class="text-xs text-gray-500">${teamAbbrev[p.teamId] || ''}</span>
      </div>`)
    .join('');
  show(el.suggestions, true);
  el.suggestions.querySelectorAll('.suggestion-item').forEach((node) => {
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectPlayer(matches[Number(node.dataset.i)]);
    });
  });
}

function updateMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) { matches = []; activeIndex = -1; show(el.suggestions, false); return; }
  matches = players
    .filter((p) => p.fullName.toLowerCase().includes(q))
    .slice(0, 8);
  activeIndex = matches.length ? 0 : -1;
  renderSuggestions();
}

el.search.addEventListener('input', (e) => updateMatches(e.target.value));

el.search.addEventListener('keydown', (e) => {
  if (!matches.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % matches.length; renderSuggestions(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % matches.length; renderSuggestions(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectPlayer(matches[activeIndex]); }
  else if (e.key === 'Escape') { show(el.suggestions, false); }
});

document.addEventListener('click', (e) => {
  if (!el.search.contains(e.target) && !el.suggestions.contains(e.target)) {
    show(el.suggestions, false);
  }
});

function selectPlayer(player) {
  el.search.value = player.fullName;
  show(el.suggestions, false);
  matches = [];
  loadPlayer(player);
}

// Temporary stub until Task 8 implements the real loader.
async function loadPlayer(player) {
  console.log('selected', player);
}
```

- [ ] **Step 2: Verify typeahead**

Serve and open the page. Type "judge".
Expected: dropdown lists Aaron Judge with team "NYY"; ArrowDown/ArrowUp move the highlight; Enter or click logs `selected {id: 592450, ...}` to the console and fills the input.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add client-side player typeahead"
```

---

### Task 8: Fetch game log + render heatmap

Replace the `loadPlayer` stub: fetch the game log, normalize, and render the box grid.

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace the `loadPlayer` stub**

In `app.js`, delete the temporary `loadPlayer` stub (the `// Temporary stub...` block) and append:

```js
async function loadPlayer(player) {
  clearError();
  show(el.result, false);
  show(el.loading, true);
  try {
    const url = `${API}/people/${player.id}/stats?stats=gameLog&season=${SEASON}&group=hitting`;
    const data = await getJSON(url);
    const splits = (data.stats && data.stats[0] && data.stats[0].splits) || [];
    if (!splits.length) {
      showError(`No ${SEASON} games for ${player.fullName} yet.`);
      return;
    }
    const games = splits.map((s, i) => normalizeGame(s, teamAbbrev, i));
    renderHeatmap(player, games);
  } catch (err) {
    console.error(err);
    showError('Could not load game log. Please try again.');
  } finally {
    show(el.loading, false);
  }
}

function renderHeatmap(player, games) {
  const teamAbbr = teamAbbrev[player.teamId] || '';
  el.header.innerHTML = `
    <span class="text-lg font-semibold">${player.fullName}</span>
    <span class="text-sm text-gray-500">${teamAbbr} · ${games.length} games</span>`;

  el.grid.innerHTML = '';
  for (const g of games) {
    const box = document.createElement('div');
    box.className = 'cell';
    box.tabIndex = 0;
    box.style.background = shadeForTotalBases(g.totalBases);
    box.dataset.matchup = matchupLabel(g.isHome, g.opp);
    box.dataset.line = g.line;
    el.grid.appendChild(box);
  }
  show(el.result, true);
}
```

- [ ] **Step 2: Verify the heatmap renders**

Serve, open page, select "Aaron Judge".
Expected: header shows "Aaron Judge — NYY · ~59 games"; grid shows ~59 boxes in varying green shades (0-TB games are empty gray). Inspect a box in devtools — it has `data-matchup` (e.g. `@ SF`) and `data-line` (e.g. `0 / 5`). Cross-check one box's `data-line` against the raw API JSON for that date.

- [ ] **Step 3: Verify empty state**

Pick a player unlikely to have 2026 games (e.g. type a recently-signed minor leaguer, or temporarily change `SEASON` to a future year and reload).
Expected: "No 2026 games for {name} yet." message; no grid. (Revert `SEASON` to 2026 if changed.)

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: fetch game log and render total-bases heatmap"
```

---

### Task 9: Tooltip wiring

Show opponent + batting line on hover and keyboard focus; position near the cell.

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add tooltip handlers**

Append to `app.js`:

```js
function showTooltip(box, x, y) {
  el.tipMatchup.textContent = box.dataset.matchup || '';
  el.tipLine.textContent = box.dataset.line || '';
  show(el.tooltip, true);
  const pad = 12;
  const rect = el.tooltip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
  if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
  el.tooltip.style.left = `${Math.max(4, left)}px`;
  el.tooltip.style.top = `${Math.max(4, top)}px`;
}

function hideTooltip() { show(el.tooltip, false); }

el.grid.addEventListener('mouseover', (e) => {
  const box = e.target.closest('.cell');
  if (box) showTooltip(box, e.clientX, e.clientY);
});
el.grid.addEventListener('mousemove', (e) => {
  const box = e.target.closest('.cell');
  if (box) showTooltip(box, e.clientX, e.clientY);
});
el.grid.addEventListener('mouseout', (e) => {
  if (e.target.closest('.cell')) hideTooltip();
});
el.grid.addEventListener('focusin', (e) => {
  const box = e.target.closest('.cell');
  if (box) {
    const r = box.getBoundingClientRect();
    showTooltip(box, r.left, r.bottom);
  }
});
el.grid.addEventListener('focusout', hideTooltip);
```

- [ ] **Step 2: Verify tooltips**

Serve, select Aaron Judge, hover boxes.
Expected: tooltip follows the cursor with two lines, e.g. `@ SF` / `0 / 5`, or `vs. BOS` / `1 / 3, 2B, BB`. Tab into the grid — focusing a box shows its tooltip; the tooltip stays on-screen near edges.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add per-game tooltip with matchup and batting line"
```

---

### Task 10: Final verification + README

Run the full test suite and walk the manual checklist; add brief run instructions.

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run unit tests**

Run: `node --test`
Expected: PASS — all `lib.js` tests green.

- [ ] **Step 2: Walk the manual checklist** (from the spec's Testing section)

Serve via `python3 -m http.server 8000`, then verify:
1. Typeahead populated; "judge" → Aaron Judge.
2. Select Aaron Judge → ~59 boxes, varied shades.
3. Hover a known game → matchup + batting line match the box score (cross-check one game vs raw API JSON).
4. Hover a 0-hit game → `0 / N`, empty-gray box.
5. Player with no 2026 games → empty-state message.
6. Offline / blocked fetch (devtools → Network → Offline, reload) → error banner, no crash.

- [ ] **Step 3: Write `README.md`**

```markdown
# tbgraph — MLB Total Bases Heatmap

Search an active MLB player and see a GitHub-style heatmap of their total bases
per game for the 2026 season. Hover a box for the opponent and batting line.

## Run

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

A static server is required (browsers won't load JS modules over `file://`).

## Test

```bash
node --test
```

## Data

Public MLB StatsAPI (`statsapi.mlb.com`), no API key. See
`docs/superpowers/specs/2026-06-12-mlb-total-bases-heatmap-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with run and test instructions"
```

---

## Self-Review Notes

- **Spec coverage:** typeahead (Task 7) · current-season-only 2026 (`SEASON` constant) · sequential game grid (Task 8) · 5-shade scale (Task 2) · tooltip `vs.`/`@` + batting line (Tasks 4, 9) · loading/empty/error states (Tasks 6, 8) · manual test checklist (Task 10). All spec sections map to a task.
- **Type consistency:** `teamAbbrev` (id→string), game record shape `{index,date,opp,isHome,totalBases,line}`, and `players` item `{id,fullName,teamId}` are used identically across Tasks 4–9.
- **No placeholders:** every code step contains complete code; the only stub (Task 7's `loadPlayer`) is explicitly created and then explicitly removed in Task 8.
