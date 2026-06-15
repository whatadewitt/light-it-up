// Pure helpers for the MLB total-bases heatmap. No DOM, no fetch.

// Luminance-stepped phosphor-green ramp (mirrors --tb-0..--tb-4 in styles.css).
// Index 0 is an unlit bulb (a game with no total bases); 4 is the brightest.
export const TB_RAMP = ['#17241d', '#2f7d4a', '#39c463', '#5be684', '#9dffba'];

/**
 * Generic ramp bucketer shared by every sport. Carries metric value by luminance
 * (colorblind-safe). Returns a ramp level 0-4.
 *
 * `thresholds` = the inclusive UPPER BOUNDS for levels 0, 1, 2, 3 (ascending).
 * Pass FOUR bounds. A value at or below thresholds[i] (and above the previous
 * bound) is level i; anything above thresholds[3] is level 4. Non-finite or <= 0
 * values clamp to level 0.
 *
 * IMPORTANT: include the level-0 bound first (usually 0). Example — MLB total
 * bases [0, 2, 4, 6] => 0 / 1-2 / 3-4 / 5-6 / 7+. NHL points would be [0,1,2,3]
 * => 0 / 1 / 2 / 3 / 4+. Omitting the leading 0 shifts every level down by one.
 */
export function levelForValue(value, thresholds) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (n <= thresholds[i]) return i;
  }
  return thresholds.length; // one past the last threshold => top level (4)
}

const MLB_TB_THRESHOLDS = [0, 2, 4, 6]; // 0 / 1-2 / 3-4 / 5-6 / 7+

// Map a game's total bases to a ramp level 0-4 (MLB-specific thresholds).
export function levelForTotalBases(tb) {
  return levelForValue(tb, MLB_TB_THRESHOLDS);
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
