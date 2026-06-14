# Multi-sport brief — "Light it Up"

Paste-ready brief for a fresh session. Goal: extend the MLB-only season heatmap into a
multi-sport tool (NHL, NFL, NBA), which will require a refactor. **Plan before coding.**

## The project (read before doing anything)

- Location: this repo (deployed at whatadewitt.com/light-it-up/, source at
  github.com/whatadewitt/light-it-up).
- Stack: vanilla JS, ES modules, **no build step, no framework, no backend**. Static files
  only: `index.html`, `app.js`, `lib.js`, `styles.css`. Tests run with `node --test`
  (`lib.test.js`).
- The design system is real and should be respected/extended: read `PRODUCT.md`,
  `DESIGN.md`, and `.impeccable/design.json`. Register is "brand" (a showpiece). North Star:
  "The Night Scoreboard."
- Current behavior: search an active MLB hitter → a dark "scoreboard" heatmap of their 2026
  season, one cell per **team** game in schedule order (matched by `gamePk`), brightness
  scaled to total bases. Three slot states: **played** (lit by a luminance ramp),
  **did-not-play** (muted), **not-yet-played** (dark socket). Persistent board with a
  fade-out → staggered 1→N light-up. Tooltip per game; pitchers filtered from search. Data:
  public MLB StatsAPI (`statsapi.mlb.com`).
- Key files: `lib.js` holds the PURE, unit-tested helpers (level thresholds, ramp, tooltip
  line, `normalizeGame`). `styles.css` is tokenized (`--font-display` Archivo Black,
  `--font-body` Hanken Grotesk, `--phosphor` green accent, `--tb-0..--tb-4` luminance ramp,
  `--socket`, `--out`). Don't break the inline SVG favicon, the GTM snippets, or the footer.

## The goal

Add three more leagues alongside MLB, each with its own metric and accent color:

| League | Season    | Metric                                          | Accent  |
|--------|-----------|-------------------------------------------------|---------|
| MLB    | 2026      | total bases (EXISTS)                            | green   |
| NHL    | 2025-2026 | points (goals + assists)                        | magenta |
| NFL    | 2025-2026 | total yards (passing + receiving + rushing)     | blue    |
| NBA    | 2025-2026 | points                                          | orange  |

Exact hues are open, but each accent must read on the dark field, hit WCAG AA, and get its
own luminance-stepped (colorblind-safe) ramp like the existing green one.

## This needs a refactor — but PLAN IT FIRST, don't start editing

1. Propose an architecture that abstracts the sport-specific bits behind one interface (a
   **sport provider** per league: `id`, `name`, accent + ramp thresholds, season length,
   metric label, `loadPlayers()`, `loadPlayerSeason(player)` → ordered slots
   `[{state, value, opp, isHome, tooltipLine, date}]`, tooltip formatting). `app.js`/board
   logic should become sport-agnostic and driven by the selected provider; `lib.js` helpers
   become per-sport (and stay unit-tested). Suggest a `sports/` module layout.
2. Decide the sport-switch UX (e.g. a segmented control) and how the theme recolors per
   selected sport (swap accent + ramp tokens via a data-attribute / CSS custom properties on
   `:root`). Update `DESIGN.md` + `.impeccable/design.json` for the multi-accent system (the
   docs are currently green-specific — "Scoreboard Phosphor" / "The One Signal Rule").
3. Generalize the schedule-aligned slot model (played / did-not-play / not-yet-played) across
   leagues with different season lengths (MLB 162, NFL 17 + bye, NBA/NHL 82) and metrics with
   very different ranges (bases ~0–14, NHL pts ~0–6, NBA pts ~0–70, NFL yards ~0–400+). Each
   metric needs its own ramp thresholds.

## CRITICAL RISK — resolve before committing to data sources

This is a **client-only static site with no backend**, so every data source MUST be fetchable
from the browser (CORS-enabled). MLB StatsAPI works. **Verify CORS + the needed endpoints**
(player list, per-player game log, team schedule / game IDs) for NHL (`api-web.nhle.com`),
NFL, and NBA **before building**. NBA's `stats.nba.com` is typically CORS-blocked; ESPN's
unofficial endpoints are a common fallback. NFL "total yards" must sum a player's passing +
receiving + rushing yards per game. If a league can't be done client-only, **stop and surface
the options** (different source, or whether a tiny proxy is acceptable given the static
deploy) rather than silently adding a backend.

## Constraints / definition of done

- Keep it no-build, vanilla ES modules, static-deployable to a subdirectory (relative paths).
- Preserve a11y: AA contrast per accent, full keyboard nav, reduced-motion path,
  luminance-carried (not hue-only) ramps, tooltip/aria parity.
- Keep/extend the pure helpers with unit tests per sport (`node --test` stays green).
- Use the impeccable design skill for the multi-accent theming and to keep `DESIGN.md` + the
  sidecar in sync. Verify in a real browser with screenshots at desktop + mobile for each
  sport, including the played/missed/future and empty/loading/error states.
- Toolchain note: run `node` as `/opt/homebrew/bin/node` in this shell (the nvm wrapper
  breaks non-interactively); headless Chrome clamps to a 500px minimum viewport.

**Start by reading the files above and the design docs, then come back with a proposed plan
(architecture + data-source findings + theming approach + open questions) BEFORE writing
code.**
