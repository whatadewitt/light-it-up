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
