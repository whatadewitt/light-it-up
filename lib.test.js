import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadeForTotalBases, levelForTotalBases, TB_RAMP, buildBattingLine, matchupLabel, normalizeGame, levelForValue } from './lib.js';

test('levelForTotalBases buckets total bases into ramp levels 0–4', () => {
  assert.equal(levelForTotalBases(0), 0);
  assert.equal(levelForTotalBases(1), 1);
  assert.equal(levelForTotalBases(2), 1);
  assert.equal(levelForTotalBases(3), 2);
  assert.equal(levelForTotalBases(4), 2);
  assert.equal(levelForTotalBases(5), 3);
  assert.equal(levelForTotalBases(6), 3);
  assert.equal(levelForTotalBases(7), 4);
  assert.equal(levelForTotalBases(12), 4);
});

test('levelForTotalBases treats missing/negative as level 0', () => {
  assert.equal(levelForTotalBases(undefined), 0);
  assert.equal(levelForTotalBases(null), 0);
  assert.equal(levelForTotalBases(-1), 0);
});

test('shadeForTotalBases maps total bases to the phosphor ramp', () => {
  assert.equal(shadeForTotalBases(0), TB_RAMP[0]);
  assert.equal(shadeForTotalBases(1), TB_RAMP[1]);
  assert.equal(shadeForTotalBases(2), TB_RAMP[1]);
  assert.equal(shadeForTotalBases(3), TB_RAMP[2]);
  assert.equal(shadeForTotalBases(4), TB_RAMP[2]);
  assert.equal(shadeForTotalBases(5), TB_RAMP[3]);
  assert.equal(shadeForTotalBases(6), TB_RAMP[3]);
  assert.equal(shadeForTotalBases(7), TB_RAMP[4]);
  assert.equal(shadeForTotalBases(12), TB_RAMP[4]);
});

test('shadeForTotalBases treats missing/negative as the unlit shade', () => {
  assert.equal(shadeForTotalBases(undefined), TB_RAMP[0]);
  assert.equal(shadeForTotalBases(null), TB_RAMP[0]);
  assert.equal(shadeForTotalBases(-1), TB_RAMP[0]);
});

const stat = (o = {}) => ({
  atBats: 0, hits: 0, doubles: 0, triples: 0,
  homeRuns: 0, baseOnBalls: 0, hitByPitch: 0, ...o,
});

test('buildBattingLine: hits/atBats only when no events', () => {
  assert.equal(buildBattingLine(stat({ hits: 0, atBats: 4 })), '0 / 4');
});

test('buildBattingLine: example 1/3 with a double and a walk', () => {
  assert.equal(
    buildBattingLine(stat({ hits: 1, atBats: 3, doubles: 1, baseOnBalls: 1 })),
    '1 / 3, 2B, BB'
  );
});

test('buildBattingLine: counts >1 are prefixed, order 2B/3B/HR/BB/HBP', () => {
  assert.equal(
    buildBattingLine(stat({ hits: 2, atBats: 4, doubles: 2, homeRuns: 1, baseOnBalls: 1 })),
    '2 / 4, 2 2B, HR, BB'
  );
  assert.equal(
    buildBattingLine(stat({ hits: 3, atBats: 4, triples: 1, homeRuns: 2, hitByPitch: 1 })),
    '3 / 4, 3B, 2 HR, HBP'
  );
});

test('buildBattingLine: a walk with no hits', () => {
  assert.equal(buildBattingLine(stat({ hits: 0, atBats: 3, baseOnBalls: 1 })), '0 / 3, BB');
});

test('buildBattingLine: missing fields treated as zero', () => {
  assert.equal(buildBattingLine({}), '0 / 0');
});

test('matchupLabel: vs for home, @ for away', () => {
  assert.equal(matchupLabel(true, 'NYY'), 'vs. NYY');
  assert.equal(matchupLabel(false, 'NYY'), '@ NYY');
});

test('normalizeGame: maps a split into a game record', () => {
  const split = {
    date: '2026-04-01',
    isHome: false,
    opponent: { id: 147, name: 'New York Yankees' },
    stat: { hits: 1, atBats: 3, doubles: 1, baseOnBalls: 1, totalBases: 2 },
  };
  const teamAbbrev = { 147: 'NYY' };
  assert.deepEqual(normalizeGame(split, teamAbbrev, 5), {
    index: 5,
    date: '2026-04-01',
    opp: 'NYY',
    isHome: false,
    totalBases: 2,
    line: '1 / 3, 2B, BB',
  });
});

test('normalizeGame: handles a split with no opponent', () => {
  const g = normalizeGame({ date: '2026-05-01', isHome: true, stat: { hits: 0, atBats: 4, totalBases: 0 } }, { 147: 'NYY' }, 2);
  assert.equal(g.opp, '???');
  assert.equal(g.line, '0 / 4');
});

test('matchupLabel: works with the ??? fallback abbrev', () => {
  assert.equal(matchupLabel(true, '???'), 'vs. ???');
  assert.equal(matchupLabel(false, '???'), '@ ???');
});

test('normalizeGame: falls back to opponent name when abbrev missing', () => {
  const split = {
    date: '2026-04-02',
    isHome: true,
    opponent: { id: 999, name: 'Mystery Team' },
    stat: { hits: 0, atBats: 4, totalBases: 0 },
  };
  const g = normalizeGame(split, {}, 0);
  assert.equal(g.opp, 'Mystery Team');
  assert.equal(g.totalBases, 0);
  assert.equal(g.line, '0 / 4');
});

test('levelForValue: buckets by ascending thresholds into levels 0-4', () => {
  // thresholds = the inclusive upper bounds for levels 0..3; anything above => 4
  const t = [0, 2, 4, 6]; // MLB total bases: 0 / 1-2 / 3-4 / 5-6 / 7+
  assert.equal(levelForValue(0, t), 0);
  assert.equal(levelForValue(1, t), 1);
  assert.equal(levelForValue(2, t), 1);
  assert.equal(levelForValue(3, t), 2);
  assert.equal(levelForValue(6, t), 3);
  assert.equal(levelForValue(7, t), 4);
  assert.equal(levelForValue(99, t), 4);
});

test('levelForValue: missing/negative/NaN clamp to level 0', () => {
  const t = [0, 2, 4, 6];
  assert.equal(levelForValue(undefined, t), 0);
  assert.equal(levelForValue(null, t), 0);
  assert.equal(levelForValue(-5, t), 0);
});
