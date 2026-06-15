# Data sources

"Light it Up" is a client-only static site, so **every data source must be fetchable from
the browser** (CORS-enabled) — or reached through the project's small Cloudflare Worker for
the official sources that aren't. This documents what each league uses, why, and the risks.

Verified 2026-06-15. CORS was confirmed with real cross-origin browser fetches (curl is
unreliable here — Cloudflare/Akamai vary on `Origin`).

## Per-league sources

| League | Source | Fetched via | Board | Metric |
|--------|--------|-------------|-------|--------|
| MLB | `statsapi.mlb.com` (official) | direct | 162 game cells | total bases |
| NHL | `api-web.nhle.com` (official) | **Cloudflare Worker** | 82 game cells | points (G+A) |
| NFL | `api.nfl.com` play-by-play (official) + Sleeper + nflverse | **Worker** + direct | 68 quarter cells (17×4) | pass+rec+rush yards / quarter |
| NBA | ESPN (`site.web.api`/`site.api.espn.com`) | direct | 82 game cells | points |

### MLB — `statsapi.mlb.com` (official, direct)
CORS-open. `teams?sportId=1`, `sports/1/players?season=…` (player list), `people/{id}/stats?
stats=gameLog&group=hitting` (per-game), `schedule?teamId=…&gameType=R` (slot layout). Unchanged
from the original tool.

### NHL — `api-web.nhle.com` (official, via the Worker)
The official NHL API sends **no `Access-Control-Allow-Origin`**, so a browser can't read it
directly (`api.nhle.com/stats/rest` is also CORS-dead and only has season aggregates;
`statsapi.web.nhl.com` is retired). A Cloudflare Worker can — it fetches server-side (where
CORS doesn't apply) and re-serves with CORS. Routes used: `/nhl/v1/player/{id}/game-log/
20252026/2` (per-game points/goals/assists), `/nhl/v1/club-schedule-season/{tri}/20252026`
(slot layout), and `/nhl-players` (the player list — see "Worker" below).

### NFL — official play-by-play + Sleeper + nflverse
Per-quarter yardage exists only inside play-by-play. The only clean structured source is the
official `api.nfl.com` `weekly-game-details` (`driveChart.plays[]`, each play has a `quarter`
and per-player `{statType, yards}`), which needs a server-side token — so it goes through the
Worker (`/nfl/player/{gsisId}?season=2025`, which aggregates to per-quarter totals). The
player list comes from **Sleeper** (`api.sleeper.app/v1/players/nfl`, CORS-open, keyless,
carries `gsis_id`), and the schedule from **nflverse** (`raw.githubusercontent.com/nflverse/
nfldata/master/data/games.csv`, CORS-open). Joined: Sleeper↔Worker on `gsis_id`, schedule by
week. (ESPN's play-by-play was rejected — it has no athlete-level play participants, so
per-quarter attribution would require brittle text-parsing.)

### NBA — ESPN (direct)
The official `stats.nba.com` **blocks datacenter/Cloudflare egress** (connection hangs → 520),
so it's neither browser- nor Worker-reachable; `cdn.nba.com` gates on a `Referer` a browser
can't forge. ESPN's unofficial public endpoints are the only practical browser source:
`site.web.api.espn.com/.../athletes/{id}/gamelog` (per-game points, `names[13]`), and
`site.api.espn.com/.../teams/{id}/roster` + `/schedule?season=2026&seasontype=2`. The ESPN
`/teams` LIST endpoint is CORS-blocked in-browser, so the 30 team ids are hardcoded. NBA is the
lone league still on an unofficial source.

## The Cloudflare Worker (`worker/`, `lightitup-data`)

A small free-tier Worker deployed at `https://lightitup-data.dewittl.workers.dev`. It exists
only to reach official sources that a browser can't. Locked down: it proxies a fixed
allow-list of upstream hosts and only serves the site's own origins (whatadewitt.com /
localhost / the worker's own subdomain).

- **`/nhl/<path>`** — transparent, edge-cached proxy to `api-web.nhle.com`.
- **`/nhl-players`** — the league-wide skater list, aggregated from all 32 rosters
  **sequentially** server-side and cached 24h. This exists because `api-web.nhle.com` returns
  **429** when a browser bursts 32 concurrent roster fetches; one cached server-side call
  avoids the burst.
- **`/nfl/player/{gsisId}?season=`** — mints an `api.nfl.com` token (cached ~1h), fetches the
  18 weekly play-by-play blobs (edge-cached per week), and aggregates them to compact
  per-player per-quarter totals (so the browser never downloads ~100 MB of play-by-play).

## Risks & accepted approximations

- **Unofficial surfaces** (NBA ESPN; the public NFL web `clientKey`/`secret`; the NFL
  `statType` codes) have no SLA and can change without notice. All parsing is defensive; a
  league failing degrades to its own error state, never a whole-app break.
- **NFL stat codes** (pass 15+16, rush 10+11, rec 21+22; `1xx` are situational duplicates and
  must not be summed) are inferred from data, not docs — unit-tested against known box scores.
- **NFL: a player active but with zero recorded yards in a game** is absent from that week's
  play-by-play and renders as "did not play" for that game's quarters. Accepted for v1.
- **NBA/NHL: no mid-season trade fallback** — a traded player shows only their current team's
  games (unlike MLB, which falls back to a chronological layout).
- **Rate limits**: `api-web.nhle.com` 429s on bursts → mitigated by the `/nhl-players`
  aggregation + edge caching (and a client-side retry/concurrency cap as a backstop).
