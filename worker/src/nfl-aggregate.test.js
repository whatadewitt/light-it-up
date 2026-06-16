import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregateWeek } from './nfl-aggregate.js';

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL('../fixtures/nfl-week1-dalphi.json', import.meta.url)), 'utf8'));

// aggregateWeek takes the FULL week blob ({games:[...]}); wrap our single game.
const agg = aggregateWeek({ games: [fixture] });
const byName = (name) => Object.values(agg.players).find((p) => p.name.includes(name));

test('aggregateWeek: QB pass/rush split per quarter', () => {
  const hurts = byName('Hurts');
  assert.ok(hurts, 'Hurts present');
  assert.deepEqual(hurts.pass, [14, 79, 18, 41]); // 152 pass total
  assert.deepEqual(hurts.rush, [11, 37,  8,  6]); // 62 rush total
  assert.deepEqual(hurts.rec,  [ 0,  0,  0,  0]); // no receiving
  // combined total still 214
  const total = hurts.pass.reduce((a,b)=>a+b,0) + hurts.rush.reduce((a,b)=>a+b,0);
  assert.equal(total, 214);
});

test('aggregateWeek: RB rush/rec split per quarter', () => {
  const barkley = byName('Barkley');
  assert.deepEqual(barkley.rush, [20, 29, 11,  0]); // 60 rush total
  assert.deepEqual(barkley.rec,  [ 0, 11,  0, 13]); // 24 rec total
  assert.deepEqual(barkley.pass, [ 0,  0,  0,  0]); // no passing
});

test('aggregateWeek: WR rec per quarter, no rush/pass', () => {
  const lamb = byName('Lamb');
  assert.deepEqual(lamb.rec,  [76, 10, 11, 13]); // 110 rec total
  assert.deepEqual(lamb.rush, [ 0,  0,  0,  0]);
  assert.deepEqual(lamb.pass, [ 0,  0,  0,  0]);
});

test('aggregateWeek: ignores situational duplicate stat codes (no double-count)', () => {
  const lamb = byName('Lamb');
  // If 1xx codes were summed, Lamb would exceed his 110 receiving total.
  assert.equal(lamb.rec.reduce((a, b) => a + b, 0), 110);
});

test('aggregateWeek: folds OT (quarter 5) into Q4 bucket, via bare-array path', () => {
  const synthetic = [{
    driveChart: { plays: [
      { quarter: 4, stats: [{ statType: 21, gsisPlayerId: 'P1', gsisPlayerName: 'OT Tester', yards: 10 }] },
      { quarter: 5, stats: [{ statType: 10, gsisPlayerId: 'P1', gsisPlayerName: 'OT Tester', yards: 7 }] },
    ]},
  }];
  const agg = aggregateWeek(synthetic); // bare array = the real production shape
  // rec[3] = 10 (Q4), rush[3] = 7 (OT folded to Q4)
  assert.deepEqual(agg.players['P1'].rec,  [0, 0, 0, 10]);
  assert.deepEqual(agg.players['P1'].rush, [0, 0, 0,  7]);
  assert.deepEqual(agg.players['P1'].pass, [0, 0, 0,  0]);
});
