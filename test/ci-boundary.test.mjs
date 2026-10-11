import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import './viro-access.test.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workflow = read('.github/workflows/spatial-validation.yml');
const portable = workflow.split('  portable:')[1].split('  private:')[0];
const privateJob = workflow.split('  private:')[1];
test('portable jobs have no dependency secret, private checkout, or environment', () => {
  assert.doesNotMatch(portable, /secrets\.|checkout-viro|environment:/);
  assert.match(portable, /persist-credentials: false/);
  assert.match(portable, /test\/rive-contract.test.mjs/);
  assert.match(portable, /check-generated-clean.mjs/);
});
test('private jobs require canonical repo, main and push/manual events', () => {
  assert.match(privateJob, /github.repository == 'mikevocalz\/viro-external'/);
  assert.match(privateJob, /github.ref == 'refs\/heads\/main'/);
  assert.match(privateJob, /github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'/);
  assert.match(privateJob, /environment: spatial-dependencies/);
  assert.match(privateJob, /--frozen-lockfile/);
  assert.doesNotMatch(workflow, /contents: write|git push|git commit|pull_request_target/);
});
test('all callers are read-only and pass only secrets: inherit', () => {
  for (const file of ['premium-stack.yml', 'viro3-expo58-refresh.yml', 'xr-platform-validation.yml']) {
    const text = read(`.github/workflows/${file}`);
    assert.match(text, /pull_request:/);
    assert.match(text, /contents: read/);
    // secrets: inherit is required, not optional: environment-scoped secrets
    // resolve to "" inside called workflows without it (actions/runner#4453).
    // It forwards repository/organization secrets only — none may exist; the
    // environment secret still resolves solely in the environment-bound job.
    assert.match(text, /^\s*secrets: inherit\s*$/m);
    assert.doesNotMatch(text, /secrets\.[A-Z_]+/);
    assert.match(text, /uses: \.\/\.github\/workflows\/spatial-validation.yml/);
  }
});
