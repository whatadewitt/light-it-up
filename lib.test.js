import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadeForTotalBases } from './lib.js';
import { buildBattingLine } from './lib.js';

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
