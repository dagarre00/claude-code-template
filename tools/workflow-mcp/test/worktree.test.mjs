import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { listWorktrees, prepareWorktree, removeWorktree } from '../worktree.mjs';
import { cleanup, fixture } from './helpers.mjs';

const git = (root, ...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });

// What prepareDispatch leaves beside the prompt it composed. Written here by
// hand so these tests exercise the reading half without dragging a whole
// dispatch (and an engine config) into a worktree test.
function record(root, task_id, fields) {
  const dir = resolve(root, '.worktrees/.dispatch', task_id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'dispatch.json'), JSON.stringify({ task_id, ...fields }, null, 2));
}

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
    // git for Windows does not reliably match a safe.directory value written
    // with backslashes — measured against two real dispatches that still hit
    // "dubious ownership" with exactly that form already registered. The
    // registered entry must use forward slashes regardless of what OS-native
    // separator `wt.workspace` itself carries.
    const expected = wt.workspace.replaceAll('\\', '/');
    const trusted = () => git(root, 'config', '--global', '--get-all', 'safe.directory').stdout;
    const entries = () => trusted().split(/\r?\n/).filter(line => line.trim() === expected);
    assert.equal(entries().length, 1, 'the forward-slash form of the path must be registered');
    assert.doesNotMatch(trusted(), /\\/, 'no entry may be written with backslashes');
    removeWorktree(root, 'hhh');
    prepareWorktree(root, { task_id: 'hhh' });
    assert.equal(entries().length, 1, 'the same path must not accumulate duplicate entries');
  });
});

// F-F: read-only is a promise the prompt makes, not a property two of three
// engines can enforce, and verifying it was left to the conductor remembering to
// run `git status --porcelain` in the worktree afterwards. The MCP owns the
// worktree path, so it can check what it handed out instead of asking.
test('a read-only worker that wrote anything is reported as a violation, not just as dirty', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'ro' });
    record(root, 'ro', { role: 'adversary', access: 'read-only', owned_paths: [] });
    writeFileSync(resolve(wt.workspace, 'sneaky.txt'), 'an edit a read-only role must not have made\n');

    const listed = listWorktrees(root).find(entry => entry.task_id === 'ro');
    assert.equal(listed.clean, false);
    assert.equal(listed.access, 'read-only');
    assert.deepEqual(listed.violations, ['sneaky.txt']);
    assert.equal(listed.retirable, false, 'a worktree holding an unexplained change is not cleanup');
  });
});

test('a write worker is measured against its owned paths, not against being dirty at all', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'rw' });
    record(root, 'rw', { role: 'developer', access: 'write', owned_paths: ['src'] });
    mkdirSync(resolve(wt.workspace, 'src'), { recursive: true });
    writeFileSync(resolve(wt.workspace, 'src/feature.js'), 'delivered\n');

    let listed = listWorktrees(root).find(entry => entry.task_id === 'rw');
    assert.equal(listed.clean, false);
    assert.deepEqual(listed.violations, [], 'work inside owned_paths is the expected output, not a violation');

    writeFileSync(resolve(wt.workspace, 'elsewhere.js'), 'outside its scope\n');
    listed = listWorktrees(root).find(entry => entry.task_id === 'rw');
    assert.deepEqual(listed.violations, ['elsewhere.js'],
      'a path nobody will commit is exactly what the conductor needs told');
  });
});

test('a worktree with no dispatch record still reports cleanliness, without inventing a verdict', () => {
  repo(root => {
    prepareWorktree(root, { task_id: 'bare' });
    const listed = listWorktrees(root).find(entry => entry.task_id === 'bare');
    assert.equal(listed.clean, true);
    assert.equal(listed.access, null);
    assert.equal(listed.violations, null, 'without owned_paths there is nothing to measure against');
  });
});

// F-G: eleven worktrees had accumulated, because prepare never prunes and remove
// is manual. Whether one is holding anything unique is computable — clean, and
// its branch already an ancestor of the integration branch — so it gets computed
// rather than verified by hand.
test('flags a worktree that provably holds nothing unique', () => {
  repo(root => {
    prepareWorktree(root, { task_id: 'spent' });
    const listed = listWorktrees(root).find(entry => entry.task_id === 'spent');
    assert.equal(listed.merged, true, 'branched at HEAD and never committed on');
    assert.equal(listed.retirable, true);
  });
});

test('a worktree whose branch holds its own commits is never flagged for retirement', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'delivered' });
    writeFileSync(resolve(wt.workspace, 'result.txt'), 'worker output\n');
    git(wt.workspace, 'add', '-A');
    git(wt.workspace, 'commit', '-qm', 'worker output');

    const listed = listWorktrees(root).find(entry => entry.task_id === 'delivered');
    assert.equal(listed.clean, true, 'committed work leaves a clean tree');
    assert.equal(listed.merged, false);
    assert.equal(listed.retirable, false, 'clean is not the same as safe to delete');
  });
});

test('a task id that is not a plain slug is refused before touching git', () => {
  repo(root => {
    for (const bad of ['../escape', 'a b', 'a/b', '-x', '']) {
      assert.throws(() => prepareWorktree(root, { task_id: bad }), /task id/i, `accepted ${JSON.stringify(bad)}`);
    }
  });
});
