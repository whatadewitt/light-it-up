import { mlb } from './mlb.js';
import { nhl } from './nhl.js';
import { nfl } from './nfl.js';
import { nba } from './nba.js';

// Ordered league registry (drives the switcher order in Plan 4).
export const LEAGUES = [mlb, nhl, nfl, nba];

export const DEFAULT_LEAGUE = 'mlb';

export function getProvider(id) {
  return LEAGUES.find((p) => p.id === id) || LEAGUES.find((p) => p.id === DEFAULT_LEAGUE);
}
