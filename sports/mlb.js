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
function slotsFromSplits(splits, abbrev) {
  return splits.map((s) => {
    const ng = normalizeGame(s, abbrev, 0);
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
  seasonLabel: '2026',
  metricShort: 'bases',
  levelForValue: levelForTotalBases,

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
      slots = built.placed === playedByPk.size ? built.slots : slotsFromSplits(splits, teamAbbrev);
    } else {
      slots = slotsFromSplits(splits, teamAbbrev);
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
