import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTokenCache } from './nfl-token.js';

test('makeTokenCache: mints once, reuses until near expiry', async () => {
  let calls = 0;
  let now = 1000_000; // ms
  const mint = async () => { calls += 1; return { accessToken: `t${calls}`, ttlMs: 3600_000 }; };
  const cache = makeTokenCache({ mint, now: () => now });

  assert.equal(await cache.get(), 't1');
  assert.equal(await cache.get(), 't1'); // reused
  assert.equal(calls, 1);

  now += 3600_000; // jump past TTL (minus the 60s safety margin)
  assert.equal(await cache.get(), 't2'); // re-minted
  assert.equal(calls, 2);
});

test('makeTokenCache: invalidate() forces a re-mint (e.g. after a 401)', async () => {
  let calls = 0;
  const mint = async () => { calls += 1; return { accessToken: `t${calls}`, ttlMs: 3600_000 }; };
  const cache = makeTokenCache({ mint, now: () => 0 });
  assert.equal(await cache.get(), 't1');
  cache.invalidate();
  assert.equal(await cache.get(), 't2');
  assert.equal(calls, 2);
});
