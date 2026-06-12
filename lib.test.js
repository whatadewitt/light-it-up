import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadeForTotalBases } from './lib.js';

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
