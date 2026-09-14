// The e2e run spends real model calls, so `npm test` only proves the parts that
// do not: the fixture is a green project, every dispatch composes for every
// engine, and a dry run cleans up after itself. A broken harness should fail here,
// not an hour into a paid run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildFixture, findPosixShell, runE2E } from '../e2e/run.mjs';

test('the e2e fixture is a committed, green project with an unimplemented stub', () => {
  const base = mkdtempSync(resolve(tmpdir(), 'wmcp-fixture-test-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  try {
    const root = buildFixture(resolve(base, 'fx'));
    assert.equal(spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '');
    assert.equal(spawnSync('npm test', { cwd: root, shell: true }).status, 0);
    assert.match(readFileSync(resolve(root, 'src/slugify.mjs'), 'utf8'), /return text;/);
    assert.ok(existsSync(resolve(root, '.agents/roles/developer.md')), 'the fixture runs on this template\'s own .agents/');
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
});

test('a POSIX shell is found that is not WSL', () => {
  const shell = findPosixShell();
  assert.ok(shell === '/bin/sh' || existsSync(shell), shell);
  assert.doesNotMatch(shell.toLowerCase(), /system32/, 'System32\\bash.exe is WSL, which cannot see C:\\ paths');
});

for (const engine of ['antigravity', 'codex', 'claude']) {
  test(`a dry run on ${engine} composes every dispatch and leaves nothing behind`, async () => {
    const base = mkdtempSync(resolve(tmpdir(), 'wmcp-dry-'));
    const previous = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
    try {
      const result = await runE2E({ engine, dryRun: true, log: () => {} });
      const failed = result.checks.filter(check => !check.pass);
      assert.deepEqual(failed, [], JSON.stringify(failed));
      assert.ok(result.checks.some(check => check.id === 'dev-b1.compose'));
      assert.ok(result.checks.some(check => check.id === 'adversary.compose'));
      assert.ok(existsSync(result.result_file));
      assert.equal(result.fixture, null);
      assert.ok(existsSync(resolve(result.result_file, '..', 'dispatch', 'dev-b1', 'prompt.txt')),
        'the dispatch records outlive the fixture, so a failed check can be diagnosed');
      rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
    } finally {
      if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
      rmSync(base, { recursive: true, force: true });
    }
  });
}
