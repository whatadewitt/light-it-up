// Pure: official api.nfl.com weekly-game-details blob -> per-player per-quarter
// TOTAL yards (passing + receiving + rushing). No Worker/Node APIs here.

// statType codes that carry yardage we want. Pass=15(+16 on TD), rush=10(+11),
// rec=21(+22). The 1xx codes (111,113,115,...) are situational duplicates
// (YAC, air yards, targets) and MUST NOT be summed.
const YARD_CODES = new Set([10, 11, 15, 16, 21, 22]);

// Returns { players: { [gsisPlayerId]: { name, quarters: [q1,q2,q3,q4] } } }
export function aggregateWeek(blob) {
  // The API returns an array at top level; tests wrap a single game in {games:[...]}.
  const games = Array.isArray(blob)
    ? blob
    : blob?.games ?? blob?.data?.games ?? [];
  const players = {};
  for (const game of games) {
    const plays = game?.driveChart?.plays ?? [];
    for (const play of plays) {
      const q = Math.min(Number(play?.quarter) || 0, 4); // OT (5) folds into Q4
      if (q < 1) continue;
      for (const st of play?.stats ?? []) {
        if (!YARD_CODES.has(Number(st?.statType))) continue;
        const pid = st?.gsisPlayerId;
        if (pid == null) continue;
        const yards = Number(st?.yards) || 0;
        const p = players[pid] || (players[pid] = {
          name: st?.gsisPlayerName ?? '',
          quarters: [0, 0, 0, 0],
        });
        p.quarters[q - 1] += yards;
      }
    }
  }
  return { players };
}
