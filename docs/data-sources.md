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
| WNBA | ESPN (`site.web.api`/`site.api.espn.com`) | direct | 44 game cells | points |
| PWHL | HockeyTech / LeagueStat (`lscluster.hockeytech.com`, `client_code=pwhl`) | **Cloudflare Worker** | 30 game cells | points (G+A) |

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
`site.web.api.espn.com/.../basketball/nba/athletes/{id}/gamelog` (per-game points, `names[13]`),
and `site.api.espn.com/.../basketball/nba/teams/{id}/roster` + `/schedule?season=2026&seasontype=2`.
The ESPN `/teams` LIST endpoint is CORS-blocked in-browser, so the 30 team ids are hardcoded. NBA
is the lone league still on an unofficial source.

### WNBA — ESPN (direct)
The WNBA provider is a straight ESPN clone of the NBA provider — same shape, same path structure,
same CORS behavior. Endpoints: `site.web.api.espn.com/.../basketball/wnba/athletes/{id}/gamelog`
(per-game points), `site.api.espn.com/.../basketball/wnba/teams/{id}/roster` +
`/schedule?season=2026&seasontype=2`. The ESPN `/teams` LIST is likewise CORS-blocked, so 15 team
ids are hardcoded (including the 2026 expansion team). Season param is `2026`; board is 44 game
cells. Metric: points.

### PWHL — HockeyTech / LeagueStat (via the Worker)
The official PWHL stats feed is the **HockeyTech / LeagueStat** API at
`lscluster.hockeytech.com`, using `client_code=pwhl` and a public API key. This host is **not
CORS-open** from a browser, so it is reached via the Cloudflare Worker's `/pwhl` route, which
injects the API key and `client_code`, fetches server-side (edge-cached), and re-serves with
CORS. Endpoints (all JSONP-wrapped — the Worker strips the callback wrapper):

- **Player list**: `feed=statviewfeed&view=players` — full skater roster for the season.
- **Per-game stats**: `feed=modulekit&view=player&category=gamebygame&player_id=…` — per-game
  goals, assists, and points for a player.
- **Schedule / slot layout**: `feed=modulekit&view=schedule` — game list with a `final` flag to
  distinguish played from upcoming slots.

Season `season_id=8` = 2025–26 regular season. 8 teams, 30 game cells. Metric: points (G+A).
The three-state (played / did not play / upcoming) model applies identically to the NHL/NBA
approach — accepted approximation for v1.

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
- **`/pwhl`** — transparent proxy to `lscluster.hockeytech.com` with `client_code=pwhl` and
  the public API key injected server-side; edge-cached. Strips the JSONP wrapper before
  forwarding so the browser receives plain JSON.

## Risks & accepted approximations

- **Unofficial surfaces** (NBA ESPN; the public NFL web `clientKey`/`secret`; the NFL
  `statType` codes) have no SLA and can change without notice. All parsing is defensive; a
  league failing degrades to its own error state, never a whole-app break.
- **NFL stat codes** (pass 15+16, rush 10+11, rec 21+22; `1xx` are situational duplicates and
  must not be summed) are inferred from data, not docs — unit-tested against known box scores.
- **NFL: a player active but with zero recorded yards in a game** is absent from that week's
  play-by-play and renders as "did not play" for that game's quarters. Accepted for v1.
- **NBA/NHL/WNBA/PWHL: no mid-season trade fallback** — a traded player shows only their current
  team's games (unlike MLB, which falls back to a chronological layout).
- **Rate limits**: `api-web.nhle.com` 429s on bursts → mitigated by the `/nhl-players`
  aggregation + edge caching (and a client-side retry/concurrency cap as a backstop).
- **PWHL JSONP**: `lscluster.hockeytech.com` wraps all responses in a JSONP callback; the Worker
  strips it. The public `client_code` and API key carry no SLA — accepted for a public read-only feed.
