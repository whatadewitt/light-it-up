// Pure: official api.nfl.com weekly-game-details blob -> per-player per-quarter
// pass/rush/rec yards (separate buckets). No Worker/Node APIs here.

// statType codes that carry yardage we want. Pass=15(+16 on TD), rush=10(+11),
// rec=21(+22). The 1xx codes (111,113,115,...) are situational duplicates
// (YAC, air yards, targets) and MUST NOT be summed.
const PASS_CODES = new Set([15, 16]);
const RUSH_CODES = new Set([10, 11]);
const REC_CODES  = new Set([21, 22]);

// Returns { players: { [gsisPlayerId]: { name, pass:[q1..q4], rush:[q1..q4], rec:[q1..q4] } } }
export function aggregateWeek(blob) {
  // The real api.nfl.com weekly-game-details response is a bare top-level ARRAY of
  // games (verified), and the Worker passes it straight from resp.json(). The
  // {games:[...]} / {data:{games}} forms are defensive fallbacks; the unit tests wrap a
  // single extracted game as {games:[fixture]} to exercise that fallback path.
  const games = Array.isArray(blob) ? blob : blob?.games ?? blob?.data?.games ?? [];
  const players = {};
  for (const game of games) {
    const plays = game?.driveChart?.plays ?? [];
    for (const play of plays) {
      const q = Math.min(Number(play?.quarter) || 0, 4); // OT (5) folds into Q4
      if (q < 1) continue;
      for (const st of play?.stats ?? []) {
        const code = Number(st?.statType);
        let bucket = null;
        if (PASS_CODES.has(code)) bucket = 'pass';
        else if (RUSH_CODES.has(code)) bucket = 'rush';
        else if (REC_CODES.has(code)) bucket = 'rec';
        else continue;

        const pid = st?.gsisPlayerId;
        if (pid == null) continue;
        const yards = Number(st?.yards) || 0;
        const p = players[pid] || (players[pid] = {
          name: st?.gsisPlayerName ?? '',
          pass: [0, 0, 0, 0],
          rush: [0, 0, 0, 0],
          rec:  [0, 0, 0, 0],
        });
        p[bucket][q - 1] += yards;
      }
    }
  }
  return { players };
}
