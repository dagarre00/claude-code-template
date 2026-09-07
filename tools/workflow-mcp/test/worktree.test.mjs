import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
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
  try { return fn(root); } finally { cleanup(root); }
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

test('a task id that is not a plain slug is refused before touching git', () => {
  repo(root => {
    for (const bad of ['../escape', 'a b', 'a/b', '-x', '']) {
      assert.throws(() => prepareWorktree(root, { task_id: bad }), /task id/i, `accepted ${JSON.stringify(bad)}`);
    }
  });
});
