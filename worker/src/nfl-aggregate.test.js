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

test('aggregateWeek: sums pass+rush+rec total yards per quarter for a QB', () => {
  const hurts = byName('Hurts');
  assert.ok(hurts, 'Hurts present');
  // total/quarter = pass + rush per quarter
  assert.deepEqual(hurts.quarters, [25, 116, 26, 47]); // 152 pass + 62 rush = 214
  assert.equal(hurts.quarters.reduce((a, b) => a + b, 0), 214);
});

test('aggregateWeek: RB total = rush + receiving per quarter', () => {
  const barkley = byName('Barkley');
  assert.deepEqual(barkley.quarters, [20, 40, 11, 13]); // 60 rush + 24 rec = 84
});

test('aggregateWeek: WR total = receiving per quarter', () => {
  const lamb = byName('Lamb');
  assert.deepEqual(lamb.quarters, [76, 10, 11, 13]); // 110 rec
});

test('aggregateWeek: ignores situational duplicate stat codes (no double-count)', () => {
  const lamb = byName('Lamb');
  // If 1xx codes were summed, Lamb would exceed his 110 receiving total.
  assert.equal(lamb.quarters.reduce((a, b) => a + b, 0), 110);
});
