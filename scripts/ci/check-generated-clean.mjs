import { spawnSync } from 'node:child_process';

// Compare index, worktree AND untracked output with the committed tree.
// A generated deletion, staged edit, or new binding must never pass silently.
const result = spawnSync('git', [
  'status', '--porcelain=v1', '--untracked-files=all', '--',
  'pnpm-lock.yaml', ':(glob)packages/**/nitrogen/generated/**',
], { encoding: 'utf8' });
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr);
  process.exit(1);
}
if (result.stdout.trim()) {
  console.error('Generated bindings or lockfile differ from the committed tree. Regenerate locally and commit the changes.');
  console.error(result.stdout);
  process.exit(1);
}
console.log('Committed lockfile and generated bindings are unchanged.');
