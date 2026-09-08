import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { listWorktrees, prepareWorktree, removeWorktree } from '../worktree.mjs';
import { cleanup, fixture } from './helpers.mjs';

const git = (root, ...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });

function repo(fn) {
  const root = fixture();
  git(root, 'init', '-b', 'main', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');
  // prepareWorktree trusts each worktree path for Codex on Windows via
  // `git config --global --add safe.directory`. Without redirecting the
  // global config file, that write lands in the developer's real
  // ~/.gitconfig and never gets cleaned up — measured, it did exactly that
  // the first time this suite ran. GIT_CONFIG_GLOBAL (git 2.32+) points
  // every `--global` read/write at a throwaway file instead. It must live
  // outside `root`: inside it, the file itself would show up as an
  // untracked path and trip every dirty-checkout check in this suite.
  const globalConfigDir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-global-'));
  const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(globalConfigDir, 'gitconfig');
  try { return fn(root); } finally {
    if (previousGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
    cleanup(root);
    cleanup(globalConfigDir);
  }
}

test('creates an isolated checkout at committed HEAD on its own branch', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'aaa' });
    assert.ok(existsSync(wt.workspace));
    assert.equal(wt.branch, 'worker/aaa');
    assert.equal(wt.base_sha, git(root, 'rev-parse', 'HEAD').stdout.trim());
    // The canonical source must be present, or the worker cannot run the tests
    // it is dispatched under.
    assert.ok(existsSync(resolve(wt.workspace, '.agents/rules.md')));
  });
});

test('refuses to dispatch from a dirty checkout', () => {
  repo(root => {
    writeFileSync(resolve(root, 'stray.txt'), 'uncommitted\n');
    assert.throws(() => prepareWorktree(root, { task_id: 'bbb' }), /dirty|clean/i);
  });
});

test('the worktree root is excluded from git, so it never dirties the checkout', () => {
  repo(root => {
    prepareWorktree(root, { task_id: 'ccc' });
    assert.equal(git(root, 'status', '--porcelain').stdout.trim(), '');
  });
});

test('lists the worktrees it created', () => {
  repo(root => {
    prepareWorktree(root, { task_id: 'ddd' });
    const listed = listWorktrees(root);
    assert.ok(listed.some(w => w.branch === 'worker/ddd'));
  });
});

test('removes a clean worktree and its unused branch', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'eee' });
    removeWorktree(root, 'eee');
    assert.ok(!existsSync(wt.workspace));
    assert.ok(!listWorktrees(root).some(w => w.branch === 'worker/eee'));
  });
});

test('refuses to remove a worktree with uncommitted work, so nothing is lost', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'fff' });
    writeFileSync(resolve(wt.workspace, 'result.txt'), 'the worker output\n');
    assert.throws(() => removeWorktree(root, 'fff'), /dirty|uncommitted/i);
    assert.equal(readFileSync(resolve(wt.workspace, 'result.txt'), 'utf8'), 'the worker output\n');
  });
});

test('refuses to remove a branch holding commits that are not merged', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'ggg' });
    writeFileSync(resolve(wt.workspace, 'result.txt'), 'delivered\n');
    git(wt.workspace, 'add', '-A');
    git(wt.workspace, 'commit', '-qm', 'worker output');
    assert.throws(() => removeWorktree(root, 'ggg'), /merged|unmerged/i);
  });
});

test('trusts the new worktree path for Codex on Windows, without duplicating on re-dispatch', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'hhh' });
    const trusted = () => git(root, 'config', '--global', '--get-all', 'safe.directory').stdout;
    assert.match(trusted(), new RegExp(wt.workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    removeWorktree(root, 'hhh');
    prepareWorktree(root, { task_id: 'hhh' });
    const entries = trusted().split(/\r?\n/).filter(line => line.trim() === wt.workspace);
    assert.equal(entries.length, 1, 'the same path must not accumulate duplicate entries');
  });
});

test('a task id that is not a plain slug is refused before touching git', () => {
  repo(root => {
    for (const bad of ['../escape', 'a b', 'a/b', '-x', '']) {
      assert.throws(() => prepareWorktree(root, { task_id: bad }), /task id/i, `accepted ${JSON.stringify(bad)}`);
    }
  });
});
