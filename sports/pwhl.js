import { levelForValue, matchupLabel } from '../lib.js';
import { WORKER_BASE } from './config.js';

const PWHL = `${WORKER_BASE}/pwhl`;
const SEASON_ID = 8; // PWHL 2025-26 regular season (HockeyTech season_id; bump per season — see feed=modulekit&view=seasons)
const PWHL_THRESHOLDS = [0, 1, 2, 3]; // points/game: 0 / 1 / 2 / 3 / 4+

// HockeyTech statviewfeed wraps JSON in a (...) callback; modulekit returns plain JSON.
function parseFeed(text) {
  let s = text.trim();
  if (s.startsWith('(')) s = s.replace(/^\(/, '').replace(/\);?\s*$/, '');
  return JSON.parse(s);
}
// Retry on 429/5xx/network (Worker can transiently fail); returns parsed feed.
async function getFeed(qs, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    let r = null;
    try {
      r = await fetch(`${PWHL}?${qs}`);
      if (r.ok) return parseFeed(await r.text());
      if (r.status !== 429 && r.status < 500) throw new Error(`PWHL request failed: ${r.status}`);
    } catch (e) { if (attempt === tries) throw e; }
    await new Promise((res) => setTimeout(res, 400 * attempt));
  }
  throw new Error('PWHL request failed (retries exhausted)');
}

// Pure: ordered slots from the team's schedule games + the player's per-game record.
// byGameId: Map(gameId:string -> {points,goals,assists}). teamCode: the player's team_code.
export function buildPwhlSlots(teamGames, byGameId, teamCode) {
  return teamGames.map((g) => {
    const isHome = g.home_team_code === teamCode;
    const opp = (isHome ? g.visiting_team_code : g.home_team_code) || '???';
    const rec = byGameId.get(String(g.id));
    if (rec) return { state: 'played', value: rec.points, opp, isHome, tooltipLine: `${rec.goals} G, ${rec.assists} A`, date: g.date_played };
    return g.final === '1' ? { state: 'missed', opp, isHome } : { state: 'future', opp, isHome };
  });
}

export const pwhl = {
  id: 'pwhl', name: 'PWHL', accent: 'pwhl', seasonBoxes: 30, unit: 'game',
  metricLabel: 'points', seasonLabel: '2025–26', metricShort: 'points',
  levelForValue: (v) => levelForValue(v, PWHL_THRESHOLDS),

  async loadPlayers() {
    const j = await getFeed(`feed=statviewfeed&view=players&season=${SEASON_ID}&team=all&position=skaters&rookies=0&statsType=standard&league_id=1&limit=500&sort=points&lang=en`);
    const data = (j[0] && j[0].sections && j[0].sections[0] && j[0].sections[0].data) || [];
    return data
      .map((d) => d.row)
      .filter((row) => row && row.player_id && row.name)
      .map((row) => ({ id: row.player_id, fullName: row.name, teamId: row.team_code, teamAbbrev: row.team_code }));
  },

  async loadPlayerSeason(player) {
    const [logJ, schedJ] = await Promise.all([
      getFeed(`feed=modulekit&view=player&category=gamebygame&season_id=${SEASON_ID}&player_id=${encodeURIComponent(player.id)}`),
      getFeed(`feed=modulekit&view=schedule&season_id=${SEASON_ID}`).catch(() => null),
    ]);
    const games = (logJ.SiteKit && logJ.SiteKit.Player && logJ.SiteKit.Player.games) || [];
    if (!games.length) return { slots: [], empty: true };
    const byGameId = new Map();
    for (const g of games) byGameId.set(String(g.id), { points: Number(g.points) || 0, goals: Number(g.goals) || 0, assists: Number(g.assists) || 0 });
    const code = player.teamAbbrev;
    const sched = schedJ && schedJ.SiteKit && schedJ.SiteKit.Schedule;
    let slots;
    if (sched && sched.length) {
      const teamGames = sched
        .filter((g) => g.home_team_code === code || g.visiting_team_code === code)
        .sort((a, b) => (String(a.date_played) < String(b.date_played) ? -1 : 1));
      slots = buildPwhlSlots(teamGames, byGameId, code);
    } else {
      slots = games.map((g) => ({ state: 'played', value: Number(g.points) || 0, opp: (g.home === '1' ? g.visiting_team_code : g.home_team_code) || '???', isHome: g.home === '1', tooltipLine: `${g.goals} G, ${g.assists} A`, date: g.date_played }));
    }
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
