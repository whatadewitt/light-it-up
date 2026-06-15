# New League Providers (NHL · NFL · NBA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NBA, NHL, and NFL as `SportProvider`s alongside MLB, each implementing the existing interface so the board "just works" — NBA per-game points (ESPN, direct), NHL per-game points (official, via the Worker), NFL per-quarter total yards (official play-by-play via the Worker + Sleeper for the player list + nflverse for the schedule). The leagues are registered but only reachable in the UI once Plan 4 adds the switcher; this plan verifies each via a temporary default-league override.

**Architecture:** Each league is one module under `sports/` exporting a provider object with the same shape as `sports/mlb.js`. Pure slot-builders / parsers live in those modules and are unit-tested with `node --test`; the network glue (`loadPlayers`/`loadPlayerSeason`) is verified live in a real browser. A shared `sports/config.js` holds the deployed Worker base URL.

**Verified endpoint facts (real-browser CORS + curl shapes, 2026-06-15):**
- **NBA (ESPN, direct):** `site.api.espn.com/.../nba/teams/{id}/roster` ✅ and `.../teams/{id}/schedule?season=2026&seasontype=2` ✅ and `site.web.api.espn.com/.../nba/athletes/{id}/gamelog` ✅ are all CORS-open in-browser. The `.../nba/teams` LIST endpoint is CORS-**blocked**, so the 30 team IDs are hardcoded. Gamelog: `names[13]="points"` (labels[13]="PTS"); `seasonTypes[]` has `"2025-26 Regular Season"` (filter `/Regular/`); each event `{eventId, stats[14]}`, `stats[13]`=points. Schedule: `events[]` (82), each `{id, date, seasonType.type, competitions[0].status.type.completed, competitions[0].competitors[].team.abbreviation + homeAway}`.
- **NHL (official via Worker):** all through `https://lightitup-data.dewittl.workers.dev/nhl/...`. `roster/{tri}/current` → `{forwards[],defensemen[],goalies[]}` each `{id, firstName.default, lastName.default, positionCode}`. `club-schedule-season/{tri}/20252026` → `games[]` (incl. `gameType` 1/2/3, `gameState` FINAL/OFF/FUT, `homeTeam.abbrev`, `awayTeam.abbrev`, `id`, `gameDate`). `player/{id}/game-log/20252026/2` → `gameLog[]` each `{gameId, points, goals, assists, opponentAbbrev, homeRoadFlag('H'/'R'), gameDate}`. 32 tricodes captured.
- **NFL (official via Worker + Sleeper + nflverse):** `https://api.sleeper.app/v1/players/nfl` (player list, ~14.6MB, keyed by id; each `{player_id, full_name, team, position, active, gsis_id}`) ✅. `https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv` (schedule, ~2.1MB CSV; cols incl. `season, game_type, week, home_team, away_team, result`) ✅. Per-quarter yards from the Worker: `GET /nfl/player/{gsisId}?season=2025` → `{ weeks: { "<week>": { quarters:[q1,q2,q3,q4] } } }` (only weeks the player recorded a stat). Join Worker↔Sleeper on `gsis_id`; join schedule by week.

**Conventions:** run Node as `/opt/homebrew/bin/node`; commit after each task with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT modify `app.js`, `styles.css`, `index.html`, `lib.js`, `sports/mlb.js`, or `worker/`. Accent colors + the switcher are Plan 4.

---

### Task 1: Shared config (Worker base URL)

**Files:**
- Create: `sports/config.js`

- [ ] **Step 1: Create `sports/config.js`**

```js
// Deployed Cloudflare Worker that proxies official NHL data and serves aggregated
// NFL per-quarter data. See worker/ and docs/data-sources.md.
export const WORKER_BASE = 'https://lightitup-data.dewittl.workers.dev';
```

- [ ] **Step 2: Syntax check + commit**

Run: `/opt/homebrew/bin/node --check sports/config.js`
```bash
git add sports/config.js
git commit -m "feat(sports): Worker base URL config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: NBA provider (ESPN, direct) — TDD the slot builder

**Files:**
- Create: `sports/nba.js`
- Test: `sports/nba.test.js`

- [ ] **Step 1: Write the failing test (`sports/nba.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNbaSlots } from './nba.js';

// minimal ESPN schedule events
function ev(id, oppAbbr, homeAbbr, awayAbbr, completed) {
  return {
    id, date: '2025-10-22T02:00Z',
    competitions: [{
      status: { type: { completed } },
      competitors: [
        { team: { abbreviation: homeAbbr }, homeAway: 'home' },
        { team: { abbreviation: awayAbbr }, homeAway: 'away' },
      ],
    }],
  };
}

test('buildNbaSlots: played (in gamelog) carries points + opp + isHome', () => {
  const events = [ev('1', 'GS', 'LAL', 'GS', true)];
  const pts = new Map([['1', 28]]);
  assert.deepEqual(buildNbaSlots(events, pts, 'LAL'),
    [{ state: 'played', value: 28, opp: 'GS', isHome: true, tooltipLine: '28 PTS', date: '2025-10-22T02:00Z' }]);
});

test('buildNbaSlots: completed game not in gamelog => missed (away game)', () => {
  const events = [ev('2', 'BOS', 'BOS', 'LAL', true)];
  assert.deepEqual(buildNbaSlots(events, new Map(), 'LAL'),
    [{ state: 'missed', opp: 'BOS', isHome: false }]);
});

test('buildNbaSlots: not-completed game => future', () => {
  const events = [ev('3', 'GS', 'LAL', 'GS', false)];
  assert.deepEqual(buildNbaSlots(events, new Map(), 'LAL'),
    [{ state: 'future', opp: 'GS', isHome: true }]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `/opt/homebrew/bin/node --test sports/nba.test.js` → FAIL (no module).

- [ ] **Step 3: Implement `sports/nba.js`**

```js
import { levelForValue, matchupLabel } from '../lib.js';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const SEASON = 2026; // ESPN end-year for 2025-26
const NBA_THRESHOLDS = [0, 9, 19, 29]; // 0 / 1-9 / 10-19 / 20-29 / 30+

// The 30 ESPN NBA team ids. The /teams LIST endpoint is CORS-blocked in-browser,
// but per-team /roster and /schedule are open, so we hardcode the (stable) ids.
const TEAM_IDS = [1, 2, 17, 30, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 29, 14, 15, 16, 3, 18, 25, 19, 20, 21, 22, 23, 24, 28, 26, 27];

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`NBA request failed: ${r.status}`);
  return r.json();
}

// Pure: 82 ordered slots from a team's schedule + the player's per-game points.
// pointsByEventId: Map(eventId:string -> points). teamAbbrev: the player's team.
export function buildNbaSlots(events, pointsByEventId, teamAbbrev) {
  return events.map((e) => {
    const comp = (e.competitions && e.competitions[0]) || {};
    const competitors = comp.competitors || [];
    const mine = competitors.find((c) => c.team && c.team.abbreviation === teamAbbrev);
    const other = competitors.find((c) => c !== mine);
    const opp = (other && other.team && other.team.abbreviation) || '???';
    const isHome = !!(mine && mine.homeAway === 'home');
    const id = String(e.id);
    if (pointsByEventId.has(id)) {
      const pts = pointsByEventId.get(id);
      return { state: 'played', value: pts, opp, isHome, tooltipLine: `${pts} PTS`, date: e.date };
    }
    const completed = !!(comp.status && comp.status.type && comp.status.type.completed);
    return completed ? { state: 'missed', opp, isHome } : { state: 'future', opp, isHome };
  });
}

export const nba = {
  id: 'nba', name: 'NBA', accent: 'nba',
  seasonBoxes: 82, unit: 'game', metricLabel: 'points',
  levelForValue: (v) => levelForValue(v, NBA_THRESHOLDS),

  async loadPlayers() {
    const rosters = await Promise.all(TEAM_IDS.map((id) =>
      getJSON(`${ESPN}/teams/${id}/roster`).catch(() => null)));
    const players = [];
    for (const r of rosters) {
      if (!r || !r.athletes) continue;
      const abbr = (r.team && r.team.abbreviation) || '';
      const list = (r.athletes[0] && Array.isArray(r.athletes[0].items))
        ? r.athletes.flatMap((g) => g.items) : r.athletes;
      for (const a of list) {
        if (!a || a.id == null) continue;
        players.push({ id: a.id, fullName: a.fullName || a.displayName, teamId: abbr, teamAbbrev: abbr });
      }
    }
    return players;
  },

  async loadPlayerSeason(player) {
    const [log, sched] = await Promise.all([
      getJSON(`${ESPN_WEB}/athletes/${player.id}/gamelog`),
      getJSON(`${ESPN}/teams/${player.teamId}/schedule?season=${SEASON}&seasontype=2`).catch(() => null),
    ]);
    const ptsIdx = (log.names || []).indexOf('points');
    const reg = (log.seasonTypes || []).find((s) => /Regular/.test(s.displayName));
    const pointsByEventId = new Map();
    if (reg && ptsIdx >= 0) {
      for (const cat of reg.categories || []) {
        for (const ev of cat.events || []) {
          pointsByEventId.set(String(ev.eventId), Number(ev.stats[ptsIdx]) || 0);
        }
      }
    }
    if (pointsByEventId.size === 0) return { slots: [], empty: true };
    const slots = (sched && sched.events && sched.events.length)
      ? buildNbaSlots(sched.events, pointsByEventId, player.teamAbbrev)
      : [...pointsByEventId.entries()].map(([, pts]) => ({ state: 'played', value: pts, opp: '???', isHome: false, tooltipLine: `${pts} PTS` }));
    return { slots, empty: false };
  },

  nameplateStats(slots) {
    const played = slots.filter((s) => s.state === 'played');
    const total = played.reduce((a, s) => a + (s.value || 0), 0);
    const best = played.reduce((m, s) => Math.max(m, s.value || 0), 0);
    return [
      { value: played.length, label: 'Games' },
      { value: total, label: 'Points' },
      { value: best, label: 'Best Game' },
    ];
  },

  boxAria(slot, ordinal) {
    const m = matchupLabel(slot.isHome, slot.opp);
    const pts = slot.value === 1 ? '1 point' : `${slot.value} points`;
    return `Game ${ordinal}, ${m}: ${pts}.`;
  },
};
```

- [ ] **Step 4: Run to verify pass + full suite**

Run: `/opt/homebrew/bin/node --test` → all green (existing + 3 new NBA tests). `/opt/homebrew/bin/node --check sports/nba.js` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add sports/nba.js sports/nba.test.js
git commit -m "feat(sports): NBA provider (ESPN) with tested slot builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: NHL provider (official, via Worker) — TDD the slot builder

**Files:**
- Create: `sports/nhl.js`
- Test: `sports/nhl.test.js`

- [ ] **Step 1: Write the failing test (`sports/nhl.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNhlSlots } from './nhl.js';

function game(id, type, state, home, away) {
  return { id, gameType: type, gameState: state, gameDate: '2026-01-01', homeTeam: { abbrev: home }, awayTeam: { abbrev: away } };
}

test('buildNhlSlots: played game carries points/goals/assists + opp + isHome', () => {
  const games = [game(11, 2, 'OFF', 'EDM', 'VAN')];
  const byId = new Map([[11, { points: 4, goals: 0, assists: 4 }]]);
  assert.deepEqual(buildNhlSlots(games, byId, 'EDM'),
    [{ state: 'played', value: 4, opp: 'VAN', isHome: true, tooltipLine: '0 G, 4 A', date: '2026-01-01' }]);
});

test('buildNhlSlots: completed game not played => missed (away)', () => {
  const games = [game(12, 2, 'FINAL', 'VAN', 'EDM')];
  assert.deepEqual(buildNhlSlots(games, new Map(), 'EDM'),
    [{ state: 'missed', opp: 'VAN', isHome: false }]);
});

test('buildNhlSlots: future game => future; non-regular gameType excluded', () => {
  const games = [game(13, 2, 'FUT', 'EDM', 'CGY'), game(99, 1, 'FUT', 'EDM', 'CGY')];
  assert.deepEqual(buildNhlSlots(games, new Map(), 'EDM'),
    [{ state: 'future', opp: 'CGY', isHome: true }]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `/opt/homebrew/bin/node --test sports/nhl.test.js` → FAIL (no module).

- [ ] **Step 3: Implement `sports/nhl.js`**

```js
import { levelForValue, matchupLabel } from '../lib.js';
import { WORKER_BASE } from './config.js';

const NHL = `${WORKER_BASE}/nhl/v1`;
const SEASON = 20252026;
const NHL_THRESHOLDS = [0, 1, 2, 3]; // 0 / 1 / 2 / 3 / 4+
const TRICODES = ['ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NSH', 'NJD', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SJS', 'SEA', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WSH', 'WPG', 'UTA'];

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`NHL request failed: ${r.status}`);
  return r.json();
}

const fullName = (p) => `${(p.firstName && p.firstName.default) || ''} ${(p.lastName && p.lastName.default) || ''}`.trim();

// Pure: 82 ordered slots from the team's regular-season schedule + per-game record.
// byGameId: Map(gameId:number -> {points,goals,assists}). tricode: player's team.
export function buildNhlSlots(games, byGameId, tricode) {
  return games
    .filter((g) => g.gameType === 2)
    .map((g) => {
      const isHome = !!(g.homeTeam && g.homeTeam.abbrev === tricode);
      const opp = (isHome ? (g.awayTeam && g.awayTeam.abbrev) : (g.homeTeam && g.homeTeam.abbrev)) || '???';
      const rec = byGameId.get(g.id);
      if (rec) {
        return { state: 'played', value: rec.points, opp, isHome, tooltipLine: `${rec.goals} G, ${rec.assists} A`, date: g.gameDate };
      }
      const done = g.gameState === 'FINAL' || g.gameState === 'OFF';
      return done ? { state: 'missed', opp, isHome } : { state: 'future', opp, isHome };
    });
}

export const nhl = {
  id: 'nhl', name: 'NHL', accent: 'nhl',
  seasonBoxes: 82, unit: 'game', metricLabel: 'points',
  levelForValue: (v) => levelForValue(v, NHL_THRESHOLDS),

  async loadPlayers() {
    const rosters = await Promise.all(TRICODES.map((t) =>
      getJSON(`${NHL}/roster/${t}/current`).then((r) => ({ t, r })).catch(() => null)));
    const players = [];
    for (const entry of rosters) {
      if (!entry || !entry.r) continue;
      const { t, r } = entry;
      for (const p of [...(r.forwards || []), ...(r.defensemen || [])]) {
        players.push({ id: p.id, fullName: fullName(p), teamId: t, teamAbbrev: t });
      }
    }
    return players;
  },

  async loadPlayerSeason(player) {
    const [logData, sched] = await Promise.all([
      getJSON(`${NHL}/player/${player.id}/game-log/${SEASON}/2`),
      getJSON(`${NHL}/club-schedule-season/${player.teamId}/${SEASON}`).catch(() => null),
    ]);
    const gl = logData.gameLog || [];
    if (!gl.length) return { slots: [], empty: true };
    const byGameId = new Map();
    for (const g of gl) byGameId.set(g.gameId, { points: g.points || 0, goals: g.goals || 0, assists: g.assists || 0 });
    const slots = (sched && sched.games)
      ? buildNhlSlots(sched.games, byGameId, player.teamAbbrev)
      : gl.map((g) => ({ state: 'played', value: g.points || 0, opp: g.opponentAbbrev || '???', isHome: g.homeRoadFlag === 'H', tooltipLine: `${g.goals} G, ${g.assists} A`, date: g.gameDate }));
    return { slots, empty: false };
  },

  nameplateStats(slots) {
    const played = slots.filter((s) => s.state === 'played');
    const total = played.reduce((a, s) => a + (s.value || 0), 0);
    const best = played.reduce((m, s) => Math.max(m, s.value || 0), 0);
    return [
      { value: played.length, label: 'Games' },
      { value: total, label: 'Points' },
      { value: best, label: 'Best Game' },
    ];
  },

  boxAria(slot, ordinal) {
    const m = matchupLabel(slot.isHome, slot.opp);
    const pts = slot.value === 1 ? '1 point' : `${slot.value} points`;
    return `Game ${ordinal}, ${m}: ${pts}. ${slot.tooltipLine}`;
  },
};
```

- [ ] **Step 4: Run pass + full suite + check**

Run: `/opt/homebrew/bin/node --test` (green) and `/opt/homebrew/bin/node --check sports/nhl.js`.

- [ ] **Step 5: Commit**

```bash
git add sports/nhl.js sports/nhl.test.js
git commit -m "feat(sports): NHL provider (official via Worker) with tested slot builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: NFL provider (per-quarter; Worker + Sleeper + nflverse) — TDD parsers + slot builder

**Files:**
- Create: `sports/nfl.js`
- Test: `sports/nfl.test.js`

- [ ] **Step 1: Write the failing test (`sports/nfl.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, teamSchedule, buildNflSlots } from './nfl.js';

test('parseCsv: header + quoted fields with commas', () => {
  const rows = parseCsv('a,b,c\n1,"x,y",3\n4,5,6');
  assert.deepEqual(rows, [{ a: '1', b: 'x,y', c: '3' }, { a: '4', b: '5', c: '6' }]);
});

test('teamSchedule: 2025 REG games for a team, week-ordered, opp/home/completed', () => {
  const rows = [
    { season: '2025', game_type: 'REG', week: '2', home_team: 'DAL', away_team: 'PHI', result: '-3', away_score: '24' },
    { season: '2025', game_type: 'REG', week: '1', home_team: 'PHI', away_team: 'DAL', result: '7', away_score: '20' },
    { season: '2025', game_type: 'REG', week: '3', home_team: 'PHI', away_team: 'KC', result: '', away_score: '' }, // future
    { season: '2024', game_type: 'REG', week: '1', home_team: 'PHI', away_team: 'DAL', result: '1', away_score: '1' }, // wrong season
    { season: '2025', game_type: 'POST', week: '1', home_team: 'PHI', away_team: 'DAL', result: '1', away_score: '1' }, // wrong type
  ];
  assert.deepEqual(teamSchedule(rows, 'PHI'), [
    { week: 1, opp: 'DAL', isHome: true, completed: true },
    { week: 2, opp: 'DAL', isHome: false, completed: true },
    { week: 3, opp: 'KC', isHome: true, completed: false },
  ]);
});

test('buildNflSlots: 4 quarter slots per game; played from worker weeks, else missed/future', () => {
  const schedule = [
    { week: 1, opp: 'DAL', isHome: true, completed: true },
    { week: 2, opp: 'KC', isHome: false, completed: true }, // not in weeks => missed x4
    { week: 3, opp: 'NYG', isHome: true, completed: false }, // future x4
  ];
  const weeks = { '1': { quarters: [14, 79, 18, 41] } };
  const slots = buildNflSlots(schedule, weeks);
  assert.equal(slots.length, 12);
  assert.deepEqual(slots[0], { state: 'played', value: 14, opp: 'DAL', isHome: true, label: 'Q1', week: 1, tooltipLine: 'Q1 · 14 yds' });
  assert.equal(slots[1].value, 79);
  assert.equal(slots[4].state, 'missed');
  assert.equal(slots[8].state, 'future');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `/opt/homebrew/bin/node --test sports/nfl.test.js` → FAIL (no module).

- [ ] **Step 3: Implement `sports/nfl.js`**

```js
import { levelForValue, matchupLabel } from '../lib.js';
import { WORKER_BASE } from './config.js';

const SLEEPER = 'https://api.sleeper.app/v1';
const GAMES_CSV = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const SEASON = 2025;
const NFL_THRESHOLDS = [0, 19, 39, 69]; // yards/quarter: 0 / 1-19 / 20-39 / 40-69 / 70+
const SKILL_POS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);

async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`NFL request failed: ${r.status}`); return r.json(); }
async function getText(url) { const r = await fetch(url); if (!r.ok) throw new Error(`NFL csv failed: ${r.status}`); return r.text(); }

// Pure: split a single CSV line, honoring double-quoted fields (with "" escapes).
function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Pure: CSV text -> array of row objects keyed by header.
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

// Pure: a team's 2025 regular-season games in week order.
export function teamSchedule(rows, team) {
  return rows
    .filter((r) => r.season === '2025' && r.game_type === 'REG' && (r.home_team === team || r.away_team === team))
    .sort((a, b) => Number(a.week) - Number(b.week))
    .map((r) => {
      const isHome = r.home_team === team;
      const completed = r.result !== '' && r.result != null;
      return { week: Number(r.week), opp: isHome ? r.away_team : r.home_team, isHome, completed };
    });
}

// Pure: 68 quarter slots (17 games x 4Q). weeks: {weekNum:string -> {quarters:[q1..q4]}}.
export function buildNflSlots(schedule, weeks) {
  const slots = [];
  for (const g of schedule) {
    const wk = weeks[String(g.week)];
    for (let q = 1; q <= 4; q++) {
      const base = { opp: g.opp, isHome: g.isHome, label: `Q${q}`, week: g.week };
      if (wk) {
        const yds = wk.quarters[q - 1] || 0;
        slots.push({ state: 'played', value: yds, ...base, tooltipLine: `Q${q} · ${yds} yds` });
      } else if (g.completed) {
        slots.push({ state: 'missed', ...base });
      } else {
        slots.push({ state: 'future', ...base });
      }
    }
  }
  return slots;
}

let gamesRowsCache = null;
async function loadGamesRows() {
  if (!gamesRowsCache) gamesRowsCache = parseCsv(await getText(GAMES_CSV));
  return gamesRowsCache;
}

export const nfl = {
  id: 'nfl', name: 'NFL', accent: 'nfl',
  seasonBoxes: 68, unit: 'quarter', metricLabel: 'total yards',
  levelForValue: (v) => levelForValue(v, NFL_THRESHOLDS),

  async loadPlayers() {
    const all = await getJSON(`${SLEEPER}/players/nfl`);
    const players = [];
    for (const id in all) {
      const p = all[id];
      if (!p || !p.active || !p.team || !p.gsis_id || !SKILL_POS.has(p.position)) continue;
      players.push({
        id: p.gsis_id,
        fullName: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        teamId: p.team, teamAbbrev: p.team,
      });
    }
    return players;
  },

  async loadPlayerSeason(player) {
    const [wkData, rows] = await Promise.all([
      getJSON(`${WORKER_BASE}/nfl/player/${encodeURIComponent(player.id)}?season=${SEASON}`),
      loadGamesRows(),
    ]);
    const weeks = (wkData && wkData.weeks) || {};
    const schedule = teamSchedule(rows, player.teamAbbrev);
    if (!schedule.length) return { slots: [], empty: true };
    const slots = buildNflSlots(schedule, weeks);
    return { slots, empty: !slots.some((s) => s.state === 'played') };
  },

  nameplateStats(slots) {
    const played = slots.filter((s) => s.state === 'played');
    const games = new Set(played.map((s) => s.week)).size;
    const total = played.reduce((a, s) => a + (s.value || 0), 0);
    const best = played.reduce((m, s) => Math.max(m, s.value || 0), 0);
    return [
      { value: games, label: 'Games' },
      { value: total, label: 'Total Yards' },
      { value: best, label: 'Best Quarter' },
    ];
  },

  boxAria(slot, ordinal) {
    const m = matchupLabel(slot.isHome, slot.opp);
    const y = slot.value === 1 ? '1 total yard' : `${slot.value} total yards`;
    return `Week ${slot.week} ${slot.label}, ${m}: ${y}.`;
  },
};
```

- [ ] **Step 4: Run pass + full suite + check**

Run: `/opt/homebrew/bin/node --test` (green; +3 NFL tests) and `/opt/homebrew/bin/node --check sports/nfl.js`.

- [ ] **Step 5: Commit**

```bash
git add sports/nfl.js sports/nfl.test.js
git commit -m "feat(sports): NFL per-quarter provider (Worker + Sleeper + nflverse) with tested parsers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Register the leagues + live verification of each

**Files:**
- Modify: `sports/index.js`

- [ ] **Step 1: Register all four leagues in `sports/index.js`**

Replace the imports + `LEAGUES` so the registry includes all four (keep `DEFAULT_LEAGUE='mlb'` and `getProvider` unchanged):

```js
import { mlb } from './mlb.js';
import { nhl } from './nhl.js';
import { nfl } from './nfl.js';
import { nba } from './nba.js';

// Ordered league registry (drives the switcher order in Plan 4).
export const LEAGUES = [mlb, nhl, nfl, nba];

export const DEFAULT_LEAGUE = 'mlb';

export function getProvider(id) {
  return LEAGUES.find((p) => p.id === id) || LEAGUES.find((p) => p.id === DEFAULT_LEAGUE);
}
```

- [ ] **Step 2: Full suite + checks**

Run: `/opt/homebrew/bin/node --test` (all green) and `/opt/homebrew/bin/node --check sports/index.js sports/nba.js sports/nhl.js sports/nfl.js`.

- [ ] **Step 3: Commit**

```bash
git add sports/index.js
git commit -m "feat(sports): register NHL, NFL, NBA providers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Live-verify each new league in a real browser** (controller-run; the switcher doesn't exist yet, so temporarily override the default)

For each of `nba`, `nhl`, `nfl`:
1. Temporarily edit `sports/index.js` `DEFAULT_LEAGUE` to that league (DO NOT commit this change).
2. Serve locally: `python3 -m http.server 8099 --bind 127.0.0.1` (background) from the repo root.
3. In a real browser (≥500px viewport): load `http://127.0.0.1:8099/`, confirm no console errors, search a known player, and confirm the board renders with the right box count and correct per-box aria-labels + tooltips:
   - **NBA** (e.g. "Nikola Jokic"): 82-box board, points per game, "Best Game" stat, played/missed/future states.
   - **NHL** (e.g. "Connor McDavid"): 82-box board, points (G+A), tooltip "x G, y A".
   - **NFL** (e.g. "Patrick Mahomes"): 68-box board (4 quarters per game), per-quarter yards, "Total Yards"/"Best Quarter" stats, bye week absent.
4. Screenshot desktop + mobile per league for the record.
5. Revert `DEFAULT_LEAGUE` to `'mlb'` and confirm `git status` shows `sports/index.js` unmodified (no stray override committed).

- [ ] **Step 5: Stop the server.** If a league misbehaves, fix the provider (TDD a regression test where the bug is in a pure function), then re-verify. No commit for verification itself.

---

## Self-Review (completed)

**Spec coverage** (spec §2 sources, §4 providers, §5 slot model, §7 thresholds, §8 nameplate/tooltip): NBA via ESPN direct (Task 2); NHL official via Worker (Task 3); NFL per-quarter official via Worker + Sleeper + nflverse (Task 4); all implement the same `SportProvider` interface and register alongside MLB (Task 5); per-metric thresholds set (NBA [0,9,19,29], NHL [0,1,2,3], NFL/quarter [0,19,39,69]); three-state slot model per league; nameplate + tooltip + boxAria per sport. Accent colors + switcher + DESIGN.md/data-sources.md are Plan 4.

**Placeholder scan:** none — full code for every file, concrete tests, concrete verification players.

**Type/name consistency:** every provider returns the `{slots, empty}` shape from `loadPlayerSeason` and the generalized slot `{state, value, opp, isHome, tooltipLine, date, label?, week?}` consumed by the existing `app.js`/`applySlot`/`boxAria`/`nameplateStats` (unchanged from Plan 2). `levelForValue(value, thresholds)` reused from `lib.js` (Plan 2). `WORKER_BASE` defined in Task 1 and imported by NHL (Task 3) + NFL (Task 4). Worker NFL response `{weeks:{week:{quarters}}}` matches the Worker built in Plan 1 and the NFL provider's consumption.

**Known approximations (documented in spec):** an NFL player active but with zero recorded yards in a game reads as "missed" for that week; NBA/NHL traded players show only their current team's games (no cross-team trade fallback, unlike MLB). Both acceptable for v1.
