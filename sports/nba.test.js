import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNbaSlots } from './nba.js';

// minimal ESPN schedule events
function ev(id, oppAbbr, homeAbbr, awayAbbr, completed) {
  return {
    id, date: '2025-10-22T02:00Z',
    competitions: [{
      status: { type: { completed } },
      competitors: [
        { team: { abbreviation: homeAbbr }, homeAway: 'home' },
        { team: { abbreviation: awayAbbr }, homeAway: 'away' },
      ],
    }],
  };
}

test('buildNbaSlots: played (in gamelog) carries points + opp + isHome', () => {
  const events = [ev('1', 'GS', 'LAL', 'GS', true)];
  const pts = new Map([['1', 28]]);
  assert.deepEqual(buildNbaSlots(events, pts, 'LAL'),
    [{ state: 'played', value: 28, opp: 'GS', isHome: true, tooltipLine: '28 PTS', date: '2025-10-22T02:00Z' }]);
});

test('buildNbaSlots: completed game not in gamelog => missed (away game)', () => {
  const events = [ev('2', 'BOS', 'BOS', 'LAL', true)];
  assert.deepEqual(buildNbaSlots(events, new Map(), 'LAL'),
    [{ state: 'missed', opp: 'BOS', isHome: false }]);
});

test('buildNbaSlots: not-completed game => future', () => {
  const events = [ev('3', 'GS', 'LAL', 'GS', false)];
  assert.deepEqual(buildNbaSlots(events, new Map(), 'LAL'),
    [{ state: 'future', opp: 'GS', isHome: true }]);
});
