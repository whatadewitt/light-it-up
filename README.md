# tbgraph — MLB Total Bases Heatmap

Search an active MLB player and see a GitHub-style heatmap of their total bases
per game for the 2026 season. Hover a box for the opponent and batting line.

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
