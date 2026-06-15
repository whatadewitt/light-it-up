import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNhlSlots } from './nhl.js';

function game(id, type, state, home, away) {
  return { id, gameType: type, gameState: state, gameDate: '2026-01-01', homeTeam: { abbrev: home }, awayTeam: { abbrev: away } };
}

test('buildNhlSlots: played game carries points/goals/assists + opp + isHome', () => {
  const games = [game(11, 2, 'OFF', 'EDM', 'VAN')];
  const byId = new Map([[11, { points: 4, goals: 0, assists: 4 }]]);
  assert.deepEqual(buildNhlSlots(games, byId, 'EDM'),
    [{ state: 'played', value: 4, opp: 'VAN', isHome: true, tooltipLine: '0 G, 4 A', date: '2026-01-01' }]);
});

test('buildNhlSlots: completed game not played => missed (away)', () => {
  const games = [game(12, 2, 'FINAL', 'VAN', 'EDM')];
  assert.deepEqual(buildNhlSlots(games, new Map(), 'EDM'),
    [{ state: 'missed', opp: 'VAN', isHome: false }]);
});

test('buildNhlSlots: future game => future; non-regular gameType excluded', () => {
  const games = [game(13, 2, 'FUT', 'EDM', 'CGY'), game(99, 1, 'FUT', 'EDM', 'CGY')];
  assert.deepEqual(buildNhlSlots(games, new Map(), 'EDM'),
    [{ state: 'future', opp: 'CGY', isHome: true }]);
});
