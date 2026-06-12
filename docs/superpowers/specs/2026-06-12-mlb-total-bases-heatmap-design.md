# MLB Total-Bases Heatmap — Design

**Date:** 2026-06-12
**Status:** Approved

## Goal

A single-page app to search for an active MLB player (typeahead) and view a
GitHub-contribution-style heatmap of their **total bases per game** for the
current (2026) season — up to 162 games. Hovering a box shows the opponent and
that game's batting line.

## Scope / Non-goals

- Current season only (2026). No season selector. No multi-year history.
- Hitting stats only (total bases is a batting metric).
- Static client-side app — no backend, no build step, no API key.
- Out of scope: pitching stats, career views, player comparisons, sharing/export.

## Data source

Public MLB StatsAPI (`https://statsapi.mlb.com`, no auth). Verified endpoints
(2026-06-12):

| Purpose | Endpoint | Notes |
|---|---|---|
| Team abbreviations | `/api/v1/teams?sportId=1` | 30 teams; `id → abbreviation` (e.g. `147 → NYY`, `137 → SF`). |
| Active player list | `/api/v1/sports/1/players?season=2026` | ~1,210 players; used for client-side typeahead. |
| Per-game log | `/api/v1/people/{id}/stats?stats=gameLog&season=2026&group=hitting` | One split per game, chronological. |

**Note:** the previously-tried `/api/v1/people?search=` endpoint returns 0
results and is NOT used.

Each game-log split provides: `date`, `isHome`, `opponent.{id,name}`, and a
`stat` object with `atBats`, `hits`, `doubles`, `triples`, `homeRuns`,
`baseOnBalls` (BB), `hitByPitch` (HBP), and `totalBases`.

## Architecture

Single static `index.html`: vanilla JS + Tailwind via CDN. New file; the
existing `index-cohere.html` is left untouched as reference.

Logical units (kept as small, focused functions):

- **`loadReferenceData()`** — on page load, fetch teams + active players in
  parallel; cache in memory (`teamAbbrev` map, `players` array).
- **`typeahead`** — filter cached `players` by name as the user types; render a
  suggestion dropdown; select via click or ArrowUp/ArrowDown + Enter; dismiss on
  outside click / Escape.
- **`fetchGameLog(playerId)`** — fetch the game log; map each split into a
  normalized game record `{ index, date, opp, isHome, totalBases, line }`.
- **`buildBattingLine(stat)`** — produce the tooltip line string (see below).
- **`renderHeatmap(player, games)`** — render the box grid, legend, and header.
- **tooltip** — single floating element positioned near the hovered box.

## The graph

Sequential grid of small rounded squares, one per game in chronological order,
wrapping left-to-right. No calendar gaps. Up to 162 boxes (currently ~59).

GitHub-style 5-shade green scale keyed to total bases:

| Total bases | 0 | 1–2 | 3–4 | 5–6 | 7+ |
|---|---|---|---|---|---|
| Shade | `#ebedf0` (empty) | `#9be9a8` | `#40c463` | `#30a14e` | `#216e39` |

Below the grid: a "Less → More" legend. Above it: a header with player full
name, current team abbreviation, and games-played count.

## Tooltip

Shown on box hover (and focus for keyboard/touch), two lines:

1. **Matchup:** `vs. NYY` for home games, `@ NYY` for away games — opponent id
   resolved through the `teamAbbrev` map.
2. **Batting line:** `{hits} / {atBats}`, then comma-separated event tokens in
   this order, each included only when its count > 0: doubles `2B`, triples
   `3B`, home runs `HR`, walks `BB`, hit-by-pitch `HBP`. A count prefix is added
   when the count is > 1.
   - Examples: `1 / 3, 2B, BB` · `2 / 4, 2 2B, HR, BB` · `0 / 4` ·
     `0 / 3, BB` (a walk with no official at-bat-hits).

RBI is intentionally excluded.

## States & error handling

- **Loading:** spinner while reference data and game logs fetch.
- **Empty:** if a selected player has no 2026 games, show a friendly message
  ("No 2026 games for {name} yet.").
- **Network error:** show a retry-able error message; log details to console.
- **No selection:** typing without selecting shows suggestions; selecting a
  player triggers the load automatically (no separate "Load" button needed).

## Testing

Manual verification against the live API (the app is a thin client over a public
API; no business logic worth a test harness):

1. Load page → typeahead populated; typing "judge" surfaces Aaron Judge.
2. Select Aaron Judge → grid renders ~59 boxes; shades vary by total bases.
3. Hover a known game → matchup + batting line match the box score
   (cross-check one game against the raw API JSON).
4. Hover a 0-hit game → shows `0 / N` (plus `BB`/`HBP` if any), empty-gray box.
5. Select a player with no 2026 games → empty-state message.
6. Simulate offline / bad fetch → error message, no crash.
