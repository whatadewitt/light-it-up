import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots } from './mlb.js';

const abbrev = { 111: 'BOS', 147: 'NYY' };

function sched(games) { return { dates: [{ games }] }; }

test('buildSlots: played game placed by gamePk with generalized shape', () => {
  const playedByPk = new Map([[1, {
    date: '2026-04-01', isHome: true, opponent: { id: 111, name: 'Boston Red Sox' },
    stat: { hits: 2, atBats: 4, doubles: 1, totalBases: 3 },
  }]]);
  const { slots, placed } = buildSlots(
    sched([{ gamePk: 1, status: { abstractGameState: 'Final' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, playedByPk, abbrev,
  );
  assert.equal(placed, 1);
  assert.deepEqual(slots[0], { state: 'played', value: 3, opp: 'BOS', isHome: true, tooltipLine: '2 / 4, 2B', date: '2026-04-01' });
});

test('buildSlots: final game the player missed => missed slot', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 2, status: { abstractGameState: 'Final' }, teams: { home: { team: { id: 111 } }, away: { team: { id: 147 } } } }]),
    147, new Map(), abbrev,
  );
  assert.deepEqual(slots[0], { state: 'missed', opp: 'BOS', isHome: false });
});

test('buildSlots: not-yet-final game => future slot', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 3, status: { abstractGameState: 'Preview' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, new Map(), abbrev,
  );
  assert.deepEqual(slots[0], { state: 'future', opp: 'BOS', isHome: true });
});

test('buildSlots: postponed final is treated as future, not missed', () => {
  const { slots } = buildSlots(
    sched([{ gamePk: 4, status: { abstractGameState: 'Final', detailedState: 'Postponed' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } }]),
    147, new Map(), abbrev,
  );
  assert.equal(slots[0].state, 'future');
});

test('buildSlots: dedupes repeated gamePk (suspended/resumed)', () => {
  const g = { gamePk: 5, status: { abstractGameState: 'Preview' }, teams: { home: { team: { id: 147 } }, away: { team: { id: 111 } } } };
  const { slots } = buildSlots(sched([g, g]), 147, new Map(), abbrev);
  assert.equal(slots.length, 1);
});
