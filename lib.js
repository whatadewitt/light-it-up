// Pure helpers for the MLB total-bases heatmap. No DOM, no fetch.

// Luminance-stepped phosphor-green ramp (mirrors --tb-0..--tb-4 in styles.css).
// Index 0 is an unlit bulb (a game with no total bases); 4 is the brightest.
export const TB_RAMP = ['#17241d', '#2f7d4a', '#39c463', '#5be684', '#9dffba'];

// Map a game's total bases to a ramp level 0–4. The intensity is carried by
// luminance, so the scale stays readable for red-green color blindness.
export function levelForTotalBases(tb) {
  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return 4;
}

export function shadeForTotalBases(tb) {
  return TB_RAMP[levelForTotalBases(tb)];
}

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
