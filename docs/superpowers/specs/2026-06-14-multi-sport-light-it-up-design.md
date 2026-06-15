# Design Spec — "Light it Up" multi-sport (MLB · NHL · NFL · NBA)

Status: proposed (awaiting review)
Date: 2026-06-14
Supersedes the data-source assumptions in `docs/multi-sport-brief.md` (which left sources TBD).

## 1. Goal

Extend the MLB-only season heatmap into a four-league tool — MLB, NHL, NFL, NBA — each
with its own metric and accent color, behind a sport-provider abstraction, with a
header league switcher that recolors the whole theme. Keep the project no-build,
vanilla ES modules, static-deployable to a subdirectory, a11y-preserving, with the pure
helpers unit-tested per sport (`node --test` stays green).

The one accepted departure from "no backend": a single small **Cloudflare Worker**
(free tier) that the user has opted into, used only where an official source is not
browser-fetchable (NHL, NFL). Everything else is fetched directly from the browser.

## 2. Data sources (verified 2026-06-14)

All sources were verified for browser CORS (and, for the proxied ones, real Cloudflare
Worker egress). Detail and the rejected alternatives live in `docs/data-sources.md`
(to be written during implementation). curl is unreliable for CORS here (Cloudflare
`vary: Origin`); confirm exact hosts in a real browser.

| League | Source | Path | Board | Metric | Official? |
|--------|--------|------|-------|--------|-----------|
| MLB | `statsapi.mlb.com` | direct (browser) | 162 game boxes | total bases | ✅ |
| NHL | `api-web.nhle.com` | **Worker proxy** | 82 game boxes | points (G+A) | ✅ |
| NFL | `api.nfl.com` play-by-play | **Worker** (token + aggregate/cache) + Sleeper for search | **68 quarter boxes** (17×4, OT→Q4) | total yards / quarter | ✅ |
| NBA | ESPN `site.web.api.espn.com` | direct (browser) | 82 game boxes | points | ✖ (unofficial) |

Notes / why:
- **NHL** has no browser-fetchable official path (`api-web.nhle.com` and
  `api.nhle.com/stats/rest` send no `Access-Control-Allow-Origin`; `statsapi.web.nhl.com`
  retired). A Worker reaches `api-web.nhle.com` cleanly (verified 200 + full game-log).
- **NFL** per-quarter requires play-by-play; the only clean structured source is official
  `api.nfl.com` `weekly-game-details` (`driveChart.plays[]`), proxied. Player list/search
  comes from **Sleeper** (`api.sleeper.app`, CORS-open, keyless), joined to play-by-play
  on `gsis_id`. ESPN play-by-play was rejected (no athlete-level play participants → would
  need brittle text-parsing).
- **NBA** official `stats.nba.com` blocks datacenter/Cloudflare egress (verified: hang →
  520 even with correct headers), so it is not proxyable via a Worker. ESPN is the only
  practical browser source (balldontlie needs a paid tier). NBA is the lone unofficial
  holdout; revisit later, do not block on it.

### Risks & mitigations
- **Unofficial/undocumented surfaces** (ESPN for NBA; NFL public web `clientKey`/`secret`;
  NFL `statType` codes): wrap all parsing defensively; treat a league's failure as a
  graceful per-league error state, never a whole-app break (matches the repo's
  "don't block on a failing data source" posture).
- **NFL stat codes** (pass=15+16, rush=10+11, rec=21+22; `1xx`=situational dupes, do not
  sum) are inferred from data, not docs — unit-test the aggregation against known box-score
  totals; add a cross-check note in `data-sources.md`.
- **Worker is a runtime dependency** for NHL + NFL — if it's down those two leagues show
  an error state; MLB/NBA are unaffected (direct).

## 3. The Cloudflare Worker

One Worker, locked down (host allowlist + restrict `Origin` to the site; not an open
proxy). Two responsibilities:

1. **NHL — transparent CORS proxy.** `GET /nhl/<path>` → fetch
   `https://api-web.nhle.com/<path>`, pass through JSON, add `Access-Control-Allow-Origin`.
   Optional short edge cache.
2. **NFL — token + aggregation + cache.** Mint an `api.nfl.com` token
   (`POST identity/v3/token`, public web creds) and cache it ~1h (module global / KV).
   `GET /nfl/player/<gsisId>/<season>` → ensure the season's 18 weekly
   `weekly-game-details` blobs are fetched and **aggregated server-side** to per-player
   per-quarter totals (cached per week so upstream is hit ≤18× per cache window),
   then return a compact per-quarter JSON for that player. This keeps the browser from
   downloading ~100 MB of play-by-play.

The Worker lives in the repo (e.g. `worker/`) with its own `wrangler.toml`, deployed
separately; the static site targets its `*.workers.dev` URL (configurable constant).

## 4. Architecture — sport providers

New `sports/` module; `app.js` and the board become sport-agnostic, driven by the
selected provider.

```
sports/
  index.js   — registry: ordered LEAGUES [mlb, nhl, nfl, nba]; getProvider(id); default (mlb)
  espn.js    — ESPN client (NBA): gamelog, schedule, roster, eventId alignment, names[] lookup
  mlb.js     — MLB provider (statsapi.mlb.com; today's logic, reshaped)
  nhl.js     — NHL provider (Worker /nhl proxy → api-web.nhle.com)
  nfl.js     — NFL provider (Worker /nfl aggregated per-quarter; Sleeper for player list)
  nba.js     — NBA provider (espn.js; metric = points)
worker/
  worker.js, wrangler.toml — the Cloudflare Worker (NHL proxy + NFL token/aggregate/cache)
lib.js       — PURE, unit-tested helpers (shared + per-sport: levelForValue, formatters)
```

**SportProvider interface** (each league module exports one object):

```js
{
  id, name,                 // 'nhl', 'NHL'
  accent,                   // theme key applied via data-league
  ramp: [c0..c4],           // 5 luminance-stepped hex steps (for legend/JS; CSS mirrors them)
  levelForValue(value),     // metric → ramp level 0–4 (pure, unit-tested)
  unit,                     // 'game' | 'quarter' (granularity of a box)
  seasonBoxes,              // 162 / 82 / 68 / 82 (sizing the persistent board)
  metricLabel,              // 'total bases' | 'points' | 'total yards'
  loadPlayers(),            // → [{id, fullName, teamId, teamAbbrev}]  (cached per league)
  loadPlayerSeason(player), // → ordered slots
  nameplateStats(slots),    // {games/quarters, seasonTotal, best} + labels
  tooltip(slot),            // matchup + secondary line strings
}
```

**Slot shape (generalized):** `{ state, value, opp, isHome, tooltipLine, date, label }`
where `state ∈ {played, missed, future}`. For NFL, four slots per game share `opp/date`
and add a `label` like `Q1…Q4`. The board only needs `value` → `provider.levelForValue()`.

`app.js` keeps: the persistent board + reveal animation, search/suggestions, tooltip,
nameplate, error/loading/empty states — all driven by `currentProvider`.

## 5. Slot model across leagues

Three states generalize directly:
- **played** — appeared (lit by `levelForValue`, focusable, full tooltip; includes a
  zero-value box, e.g. a quarter with 0 yards = ramp level 0, lit-dark).
- **missed** — the game happened but the player didn't appear (NFL: all 4 quarter boxes
  of that game = missed). Hover tooltip, not focusable.
- **future** — not yet played (inert socket).

Per-league specifics:
- **MLB**: existing `gamePk` alignment of game log to team schedule.
- **NHL**: align gamelog to `club-schedule-season` by game id (same pattern).
- **NBA**: ESPN — align gamelog `eventId` to team schedule; filter gamelog to schedule
  ids (drops All-Star noise).
- **NFL**: 17 games × 4 quarters = 68 boxes; bye week = no boxes (a gap). OT (quarter 5)
  folds into the Q4 box. If a player is absent from a game's play-by-play entirely → 4
  missed boxes; otherwise 4 played boxes (0 where no yards that quarter).

## 6. Theming — one signal per selected league

Refactor `styles.css` from hardcoded green to **semantic accent tokens** overridden by
`:root[data-league=…]`:

```css
:root            { --accent; --accent-deep; --accent-wash; --ramp-0..4; --ramp-glow-1..4 } /* MLB green default */
:root[data-league="nhl"] { /* magenta accent + ramp + glow + wash */ }
:root[data-league="nfl"] { /* blue */ }
:root[data-league="nba"] { /* orange */ }
```

Neutrals (outfield black, slates, lines, stadium-light text) stay shared. Every current
green reference — board ramp, focus rings, links, tag, tooltip border, loading pulse, the
subhead metric word — becomes `var(--accent…)`, so the whole theme shifts with one
attribute. No-JS default stays MLB green.

**Proposed accents** (luminance-monotonic ramps dark→bright; exact hex tuned & AA-verified
live with the impeccable skill during implementation):
- MLB green `#5be684` (existing)
- NHL magenta (~`#ff5cc8`): deep plum → hot pink → near-white
- NFL blue (~`#58a6ff`): navy → azure → pale cyan-white (blue is hardest for luminance/AA;
  push the top steps toward cyan so they stay distinct)
- NBA orange (~`#ff9d3c`): ember → amber → pale gold-white

Each accent must hit WCAG AA on the dark field and carry value by **luminance** (every ramp
step lighter than the last), so the board stays colorblind-safe for all four.

**Header league switcher:** a persistent broadcast-style segmented control in the masthead,
four league tabs each carrying its *own* accent (all four hues always visible, like channel
buttons); the active tab is emphasized in its accent and drives the theme. Keyboard arrow
nav, `aria-current`, visible focus ring in the active accent, instant swap under
`prefers-reduced-motion`. Selection is reflected in the **URL hash** (`/#nhl`) and read on
load; no persistent storage (resets to MLB without a hash).

## 7. Ramp thresholds per metric (pure `levelForValue`, unit-tested; tunable)

| League | Range | 0 / 1 / 2 / 3 / 4 |
|--------|-------|-------------------|
| MLB | bases 0–14 | 0 / 1–2 / 3–4 / 5–6 / 7+ (existing) |
| NHL | points 0–6 | 0 / 1 / 2 / 3 / 4+ |
| NBA | points 0–70 | 0 / 1–9 / 10–19 / 20–29 / 30+ |
| NFL | yards/quarter 0–~150 | 0 / 1–19 / 20–39 / 40–69 / 70+ |

## 8. Nameplate / tooltip / legend per sport

- **Nameplate stats** come from the provider: e.g. MLB Games/Total Bases/Best Game; NHL
  Games/Points/Best Game; NBA Games/Points/Best Game; NFL (quarter unit) Games/Total
  Yards/Best Quarter. Labels carry the metric word.
- **Tooltip** secondary line per sport: MLB batting line (existing); NHL `1 G, 2 A`; NBA
  `28 PTS` (optionally `· 7 REB · 9 AST` if cheap); NFL `Q3 · 84 yds (54 rec, 30 rush)`.
- **Legend** labels driven by the provider ("Fewer / More <metric>").
- `aria-label` per box includes the metric value and label (number affordance retained).

## 9. Accessibility

Per-accent AA contrast on the dark field; luminance-carried ramps (colorblind-safe) for all
four; full keyboard nav incl. the switcher; reduced-motion instant theme swap and ignite
collapse; tooltip/aria parity with the metric label baked into each `aria-label`.

## 10. Docs & tests

- **`DESIGN.md` + `.impeccable/design.json`**: rewrite green-specific bits — "Scoreboard
  Phosphor" / "The One Signal Rule" → *one signal per selected league*; document all four
  accent ramps and the switcher. Use the impeccable skill; keep the doc + sidecar in sync.
- **`docs/data-sources.md`**: the verified endpoints, CORS evidence, rejected alternatives,
  the Worker's role, and the unofficial-source risks.
- **Tests (`node --test` stays green)**: existing MLB tests untouched; new pure tests per
  sport — `levelForValue` buckets; metric extraction (NFL per-quarter sum incl. TD codes;
  NHL/NBA points); tooltip/line formatters; ESPN `names[]` lookup + seasonType select +
  slot alignment; NFL quarter bucketing (incl. OT→Q4) and the schedule/`gsis_id` join.
- **Browser verification**: screenshots desktop + mobile for each league × states
  (played / missed / future, empty / loading / error). Headless Chrome min viewport 500px;
  run node as `/opt/homebrew/bin/node`.

## 11. Out of scope (YAGNI for v1)

- Persisting league choice across visits (URL hash only).
- A visible NFL bye marker (bye is just a gap).
- NBA official data (stays ESPN until a better browser path exists).
- Per-quarter granularity for non-NFL leagues.
- Postseason boards (regular season only).

## 12. Open items to confirm during implementation

- Final accent hex values + AA numbers (impeccable pass, verified live).
- Worker repo layout + the production `*.workers.dev` URL constant.
- Exact NFL per-quarter ramp thresholds after eyeballing a real season's distribution.
