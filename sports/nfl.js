import { levelForValue, matchupLabel } from '../lib.js';
import { WORKER_BASE } from './config.js';

const SLEEPER = 'https://api.sleeper.app/v1';
const GAMES_CSV = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const SEASON = 2025;
const NFL_THRESHOLDS = [0, 19, 39, 69]; // yards/quarter: 0 / 1-19 / 20-39 / 40-69 / 70+
const SKILL_POS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);

// Retry on 429 / 5xx / network error with backoff. The Worker's /nfl endpoint can
// transiently 502 on a cold token re-mint or a weekly-fetch blip; retry so the load self-heals.
async function getJSON(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    let r = null;
    try {
      r = await fetch(url);
      if (r.ok) return r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`NFL request failed: ${r.status}`);
    } catch (e) {
      if (attempt === tries) throw e;
    }
    await new Promise((res) => setTimeout(res, 400 * attempt));
  }
  throw new Error('NFL request failed (retries exhausted)');
}
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
  seasonLabel: '2025', metricShort: 'yards',
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
