import { levelForValue, matchupLabel, mapLimit } from '../lib.js';
import { buildNbaSlots } from './nba.js';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';
const SEASON = 2026;
const WNBA_THRESHOLDS = [0, 9, 19, 29]; // 0 / 1-9 / 10-19 / 20-29 / 30+

// 15 WNBA team ids (includes expansion franchise ids — not a contiguous range).
const TEAM_IDS = [20, 19, 18, 3, 129689, 5, 17, 6, 8, 9, 11, 132052, 14, 131935, 16];

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`WNBA request failed: ${r.status}`);
  return r.json();
}

async function loadPlayers() {
  const rosters = await mapLimit(TEAM_IDS, 5, (id) =>
    getJSON(`${ESPN}/teams/${id}/roster`).catch(() => null));
  const players = [];
  for (const r of rosters) {
    if (!r || !r.athletes) continue;
    const abbr = (r.team && r.team.abbreviation) || '';
    const list = (r.athletes[0] && Array.isArray(r.athletes[0].items))
      ? r.athletes.flatMap((g) => g.items) : r.athletes;
    for (const a of list) {
      if (!a || a.id == null) continue;
      players.push({ id: a.id, fullName: a.fullName || a.displayName, teamId: (r.team && String(r.team.id)) || abbr, teamAbbrev: abbr });
    }
  }
  return players;
}

async function loadPlayerSeason(player) {
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
}

function nameplateStats(slots) {
  const played = slots.filter((s) => s.state === 'played');
  const total = played.reduce((a, s) => a + (s.value || 0), 0);
  const best = played.reduce((m, s) => Math.max(m, s.value || 0), 0);
  return [
    { value: played.length, label: 'Games' },
    { value: total, label: 'Points' },
    { value: best, label: 'Best Game' },
  ];
}

function boxAria(slot, ordinal) {
  const m = matchupLabel(slot.isHome, slot.opp);
  const pts = slot.value === 1 ? '1 point' : `${slot.value} points`;
  return `Game ${ordinal}, ${m}: ${pts}.`;
}

export const wnba = {
  id: 'wnba', name: 'WNBA', accent: 'wnba',
  seasonBoxes: 44, unit: 'game', metricLabel: 'points',
  seasonLabel: '2026', metricShort: 'points',
  levelForValue: (v) => levelForValue(v, WNBA_THRESHOLDS),
  loadPlayers,
  loadPlayerSeason,
  nameplateStats,
  boxAria,
};
