import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadeForTotalBases, buildBattingLine, matchupLabel, normalizeGame } from './lib.js';

test('shadeForTotalBases maps total bases to GitHub green shades', () => {
  assert.equal(shadeForTotalBases(0), '#ebedf0');
  assert.equal(shadeForTotalBases(1), '#9be9a8');
  assert.equal(shadeForTotalBases(2), '#9be9a8');
  assert.equal(shadeForTotalBases(3), '#40c463');
  assert.equal(shadeForTotalBases(4), '#40c463');
  assert.equal(shadeForTotalBases(5), '#30a14e');
  assert.equal(shadeForTotalBases(6), '#30a14e');
  assert.equal(shadeForTotalBases(7), '#216e39');
  assert.equal(shadeForTotalBases(12), '#216e39');
});

test('shadeForTotalBases treats missing/negative as empty', () => {
  assert.equal(shadeForTotalBases(undefined), '#ebedf0');
  assert.equal(shadeForTotalBases(null), '#ebedf0');
  assert.equal(shadeForTotalBases(-1), '#ebedf0');
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
