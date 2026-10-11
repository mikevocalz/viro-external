import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkViroAccess, VIRO_REVISION } from '../scripts/ci/check-viro-access.mjs';

const TOKEN = 'test-value-never-log';
const ENV = {
  GITHUB_REPOSITORY: 'mikevocalz/viro-external',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push',
  DEPENDENCY_TOKEN: TOKEN,
};

/** Build a response that fails the test if implementation reads the payload. */
function response(status) {
  return {
    status,
    body: { cancel: async () => {} },
    text: () => assert.fail('Response body must never be inspected or logged'),
    json: () => assert.fail('Response body must never be inspected or logged'),
  };
}

test('checks only the pinned source over HTTPS and never follows redirects', async () => {
  let count = 0;
  const result = await checkViroAccess(ENV, async (url, options) => {
    count++;
    assert.equal(url, `https://api.github.com/repos/mikevocalz/viro/git/commits/${VIRO_REVISION}`);
    assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'GET');
    assert.ok(options.signal instanceof AbortSignal);
    return response(200);
  });
  assert.equal(count, 1);
  assert.match(result, /HTTP 200/);
  assert.doesNotMatch(result, new RegExp(TOKEN));
});

for (const [status, expected] of [[401, /rejected/], [403, /refused/], [404, /did not expose/], [429, /rate-limited/], [500, /unexpected status/]]) {
  test(`HTTP ${status} produces a safe, distinct failure`, async () => {
    await assert.rejects(checkViroAccess(ENV, async () => response(status)), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, new RegExp(TOKEN));
      return true;
    });
  });
}

test('raw transport exceptions containing secrets are never forwarded', async () => {
  await assert.rejects(checkViroAccess(ENV, async () => { throw new Error(`Authorization: Bearer ${TOKEN}`); }), error => {
    assert.match(error.message, /No credential-validity verdict/);
    assert.doesNotMatch(error.message, new RegExp(TOKEN));
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('untrusted contexts are rejected before any request', async () => {
  for (const change of [{GITHUB_REF: 'refs/pull/1/merge'}, {GITHUB_REPOSITORY: 'other/repo'}, {GITHUB_EVENT_NAME: 'pull_request'}, {GITHUB_EVENT_NAME: 'pull_request_target'}]) {
    await assert.rejects(checkViroAccess({...ENV, ...change}, () => assert.fail('Must not request')), /restricted/);
  }
});

test('empty and whitespace-containing values are rejected without requests or disclosure', async () => {
  for (const token of [undefined, '', `${TOKEN}\n`, `TOKEN=${TOKEN}\nOTHER=value`]) {
    await assert.rejects(checkViroAccess({...ENV, DEPENDENCY_TOKEN: token}, () => assert.fail('Must not request')), error => {
      assert.doesNotMatch(error.message, new RegExp(TOKEN));
      return true;
    });
  }
});

test('main manual dispatch is supported', async () => {
  assert.match(await checkViroAccess({...ENV, GITHUB_EVENT_NAME: 'workflow_dispatch'}, async () => response(200)), /HTTP 200/);
});

test('credential probe and source checkout use the same pinned revision', () => {
  const action = readFileSync(new URL('../.github/actions/checkout-viro/action.yml', import.meta.url), 'utf8');
  assert.match(action, new RegExp(`ref: ${VIRO_REVISION}(?:\\s|$)`));
});
