# lightitup-data Worker

Gives the static "Light it Up" site browser-fetchable access to official data that
is otherwise CORS-blocked.

## Routes
- `GET /nhl/<path>` — transparent CORS proxy to `https://api-web.nhle.com/<path>`.
- `GET /nfl/player/<gsisId>?season=2025` — per-player **per-quarter** total yards
  (passing + receiving + rushing), aggregated from official `api.nfl.com`
  play-by-play and cached at the edge.

## Develop / deploy
Run in your own shell (interactive Cloudflare login):

    cd worker
    npx --yes wrangler@latest login      # first time only
    npx --yes wrangler@latest deploy

## Tests
Pure logic is unit-tested from the repo root with `node --test`
(`worker/src/*.test.js`).
