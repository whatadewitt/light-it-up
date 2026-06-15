import { mlb } from './mlb.js';

// Ordered league registry. MLB only for now; NHL/NFL/NBA added in Plan 3.
export const LEAGUES = [mlb];

export const DEFAULT_LEAGUE = 'mlb';

export function getProvider(id) {
  return LEAGUES.find((p) => p.id === id) || LEAGUES.find((p) => p.id === DEFAULT_LEAGUE);
}
