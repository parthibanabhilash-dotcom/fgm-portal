import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins } from '../src/lib/auth';

test('allows configured local and Vercel deployment origins exactly', () => {
  const origins = allowedOrigins({
    APP_URL: 'http://localhost:3000',
    VERCEL_PROJECT_PRODUCTION_URL: 'fgm.example.com',
    VERCEL_BRANCH_URL: 'fgm-git-main.example.vercel.app',
    VERCEL_URL: 'fgm-random.example.vercel.app'
  });
  assert.deepEqual([...origins], [
    'http://localhost:3000',
    'https://fgm.example.com',
    'https://fgm-git-main.example.vercel.app',
    'https://fgm-random.example.vercel.app'
  ]);
  assert.equal(origins.has('https://evil.example'), false);
});

test('ignores missing and malformed origin settings', () => {
  assert.deepEqual([...allowedOrigins({ APP_URL: 'not a valid host / path' })], []);
});
