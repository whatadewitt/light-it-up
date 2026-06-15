import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from './config.js';

test('isAllowedOrigin: allows configured production origins', () => {
  assert.equal(isAllowedOrigin('https://whatadewitt.com'), true);
  assert.equal(isAllowedOrigin('https://www.whatadewitt.com'), true);
});

test('isAllowedOrigin: allows localhost and 127.0.0.1 for dev', () => {
  assert.equal(isAllowedOrigin('http://localhost:8000'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5500'), true);
});

test('isAllowedOrigin: allows own *.dewittl.workers.dev', () => {
  assert.equal(isAllowedOrigin('https://lightitup-data.dewittl.workers.dev'), true);
});

test('isAllowedOrigin: rejects unknown origins and junk', () => {
  assert.equal(isAllowedOrigin('https://evil.example.com'), false);
  assert.equal(isAllowedOrigin('https://evil.workers.dev'), false);
  assert.equal(isAllowedOrigin(''), false);
  assert.equal(isAllowedOrigin(null), false);
  assert.equal(isAllowedOrigin('not a url'), false);
});
