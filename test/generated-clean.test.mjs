import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../scripts/ci/check-generated-clean.mjs', import.meta.url));
/**
 * Create a disposable Git repository with committed bindings and a lockfile.
 * Each regression mutates this fixture, then runs the production drift guard.
 * @param {import('node:test').TestContext} t Test context owning cleanup.
 * @returns {{cwd: string, output: string, git: (...args: string[]) => void, check: () => import('node:child_process').SpawnSyncReturns<string>}}
 */
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'viro-generated-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => {
    const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  };
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  const output = join(cwd, 'packages/example/nitrogen/generated');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'binding.cpp'), 'original\n');
  writeFileSync(join(cwd, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  git('add', '.');
  git('commit', '-qm', 'fixture');
  return { cwd, output, git, check: () => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' }) };
}
test('clean committed output passes', t => {
  assert.equal(fixture(t).check().status, 0);
});
test('tracked regenerated edits fail', t => {
  const f = fixture(t); writeFileSync(join(f.output, 'binding.cpp'), 'changed\n');
  assert.equal(f.check().status, 1);
});
test('staged regenerated edits fail', t => {
  const f = fixture(t); writeFileSync(join(f.output, 'binding.cpp'), 'changed\n'); f.git('add', '.');
  assert.equal(f.check().status, 1);
});
test('deleted generated files fail', t => {
  const f = fixture(t); rmSync(join(f.output, 'binding.cpp'));
  assert.equal(f.check().status, 1);
});
test('untracked generated files fail', t => {
  const f = fixture(t); writeFileSync(join(f.output, 'new.cpp'), 'new\n');
  assert.equal(f.check().status, 1);
});
test('lockfile changes fail', t => {
  const f = fixture(t); writeFileSync(join(f.cwd, 'pnpm-lock.yaml'), 'changed\n');
  assert.equal(f.check().status, 1);
});
test('unrelated build output is outside the binding guard', t => {
  const f = fixture(t); writeFileSync(join(f.cwd, 'unrelated.txt'), 'not generated\n');
  assert.equal(f.check().status, 0);
});
