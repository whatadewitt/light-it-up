import { levelForValue, matchupLabel, mapLimit } from '../lib.js';

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
    const opp = (mine && other && other.team && other.team.abbreviation) || '???';
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
  seasonLabel: '2025–26', metricShort: 'points',
  levelForValue: (v) => levelForValue(v, NBA_THRESHOLDS),

  async loadPlayers() {
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
