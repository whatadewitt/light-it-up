# Light it Up — MLB Total Bases Heatmap

> Repo/package name: `tbgraph`.

Search an active MLB hitter and watch their 2026 season light up like a stadium
scoreboard: one cell per **team game** in schedule order, brightness scaled to total
bases. Games the player missed (injury, rest) show as muted "did not play" slots and
future games as dark sockets, so an injury reads as a visible gap. Hover or focus a
played cell for the matchup and batting line.

The total-bases ramp is distinguished by **luminance**, not hue alone, so the
scoreboard stays readable for red-green color blindness. All motion has a
`prefers-reduced-motion` fallback, and the grid is fully keyboard-navigable.

## Build

No build step, no framework, no CDN. Plain ES modules (`app.js`, `lib.js`) and a
single tokenized stylesheet (`styles.css`). Fonts (Archivo Black + Hanken Grotesk)
load from Google Fonts.

## Run

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

A static server is required (browsers won't load JS modules over `file://`).

## Test

```bash
node --test
```

## Data

Public MLB StatsAPI (`statsapi.mlb.com`), no API key. See
`docs/superpowers/specs/2026-06-12-mlb-total-bases-heatmap-design.md`.
