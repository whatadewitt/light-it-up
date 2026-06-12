// Pure helpers for the MLB total-bases heatmap. No DOM, no fetch.

export function shadeForTotalBases(tb) {
  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return '#ebedf0';
  if (n <= 2) return '#9be9a8';
  if (n <= 4) return '#40c463';
  if (n <= 6) return '#30a14e';
  return '#216e39';
}
