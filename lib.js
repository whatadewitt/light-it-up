// Pure helpers for the MLB total-bases heatmap. No DOM, no fetch.

export function shadeForTotalBases(tb) {
  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return '#ebedf0';
  if (n <= 2) return '#9be9a8';
  if (n <= 4) return '#40c463';
  if (n <= 6) return '#30a14e';
  return '#216e39';
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
