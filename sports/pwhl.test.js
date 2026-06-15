import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPwhlSlots } from './pwhl.js';

const g = (id, home, away, final) => ({ id, home_team_code: home, visiting_team_code: away, final, date_played: '2025-11-21' });

test('buildPwhlSlots: played game (home) carries points + G/A', () => {
  const byId = new Map([['210', { points: 1, goals: 0, assists: 1 }]]);
  assert.deepEqual(buildPwhlSlots([g('210', 'MIN', 'TOR', '1')], byId, 'MIN'),
    [{ state: 'played', value: 1, opp: 'TOR', isHome: true, tooltipLine: '0 G, 1 A', date: '2025-11-21' }]);
});
test('buildPwhlSlots: completed game not played => missed (away)', () => {
  assert.deepEqual(buildPwhlSlots([g('211', 'TOR', 'MIN', '1')], new Map(), 'MIN'),
    [{ state: 'missed', opp: 'TOR', isHome: false }]);
});
test('buildPwhlSlots: not-final game => future', () => {
  assert.deepEqual(buildPwhlSlots([g('212', 'MIN', 'BOS', '0')], new Map(), 'MIN'),
    [{ state: 'future', opp: 'BOS', isHome: true }]);
});
