// The e2e run spends real model calls, so `npm test` only proves the parts that
// do not: the fixture is a green project, every dispatch composes for every
// engine, and a dry run cleans up after itself. A broken harness should fail here,
// not an hour into a paid run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
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

// Adversary round on the e2e run: a failed check could still be recorded as an
// accepted decision (F1, and the same bug on the probe), a probe that wrote a
// file aborted the whole run before its result or cleanup (F2), and an engine with
// no transcript audit scored "no subagent was called" as a pass (F3). Stand-ins run
// through the real wrapper and the real checks, without an engine.
test('failed checks reject their dispatch, a writing probe does not abort the run, and unobservable checks are not passes', async () => {
  const base = mkdtempSync(resolve(tmpdir(), 'wmcp-standin-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  try {
    const write = (ws, path, text) => { mkdirSync(dirname(resolve(ws, path)), { recursive: true }); writeFileSync(resolve(ws, path), text); };
    const result = await runE2E({ engine: 'claude', log: () => {}, standIns: {
      probe: { script: 'echo "(a) created it"', effect: ws => write(ws, 'PROBE_WRITE.txt', 'probe\n') },
      'dev-b1': { script: 'echo "B1: Red was AssertionError, now green"', effect: ws => {
        write(ws, 'test/slugify.test.mjs', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n"
          + "import { slugify } from '../src/slugify.mjs';\n\ntest('B1: lowercases and hyphen-joins', () => {\n"
          + "  assert.equal(slugify('Hello World'), 'hello-world');\n});\n");
        write(ws, 'src/slugify.mjs', "export function slugify(text) {\n  return text.toLowerCase().split(' ').join('-');\n}\n");
        const entity = resolve(ws, 'docs/wiki/entities/slugify.md');
        writeFileSync(entity, readFileSync(entity, 'utf8').replace('- [ ] **B1**', '- [x] **B1**'));
      } },
      adversary: { script: 'echo "Looks fine to me."' }
    } });
    const check = id => result.checks.find(entry => entry.id === id);
    assert.ok(existsSync(result.result_file), 'the result is written even though a probe wrote a file');
    assert.equal(check('probe.no_write').pass, false);
    assert.equal(check('probe.no_subagent').status, 'unobserved');
    assert.equal(check('dev.integrated').pass, true, JSON.stringify(result.checks.filter(c => c.status === 'fail')));
    assert.equal(check('adversary.format').pass, false);
    assert.equal(check('cleanup.worktrees').pass, true);
    assert.equal(check('cleanup.trust').pass, true);
    const decisions = Object.fromEntries(result.dispatches.map(d => [d.task_id, d.decision]));
    assert.deepEqual(decisions, { probe: 'rejected', 'dev-b1': 'accepted', adversary: 'rejected' });
    assert.ok(result.unobserved >= 1);
    assert.equal(result.passed + result.failed + result.unobserved, result.checks.length);
    rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
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
