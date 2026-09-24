import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { listWorktrees, prepareWorktree, removeWorktree, trustWorktree } from '../worktree.mjs';
import { prepareDispatch } from '../dispatch.mjs';
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

// A per-worktree virtualenv (or node_modules) is ignored, so it does not make the
// worktree dirty — but on Windows it holds paths past MAX_PATH, and without
// core.longpaths `git worktree remove` fails half-way: measured, it unregistered
// the worktree, deleted part of the tracked tree, and left the directory and the
// branch behind. Harmless on any OS without the limit.
test('removes a worktree holding an ignored tree deeper than the Windows path limit', () => {
  repo(root => {
    writeFileSync(resolve(root, '.gitignore'), '.venv/\n');
    git(root, 'add', '.gitignore');
    git(root, 'commit', '-qm', 'ignore venv');
    const wt = prepareWorktree(root, { task_id: 'deep' });
    const deep = resolve(wt.workspace, '.venv', ...Array(12).fill('site-packages-nested-dir'));
    mkdirSync(deep, { recursive: true });
    writeFileSync(resolve(deep, 'module.py'), 'x = 1\n');
    assert.ok(resolve(deep, 'module.py').length > 260, 'the fixture must actually exceed MAX_PATH');

    removeWorktree(root, 'deep');
    assert.ok(!existsSync(wt.workspace), 'the directory must be gone, not orphaned');
    assert.ok(!listWorktrees(root).some(w => w.branch === 'worker/deep'));
    assert.equal(git(root, 'branch', '--list', 'worker/deep').stdout.trim(), '', 'the branch must be gone too');
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

// Codex is the only engine whose sandbox account trips git's ownership check,
// so trust is registered when a codex dispatch is composed, never for every
// worktree: a claude- or agy-only project should not have its global git config
// edited at all.
test('preparing a worktree writes nothing to the global git config', () => {
  repo(root => {
    prepareWorktree(root, { task_id: 'quiet' });
    assert.equal(git(root, 'config', '--global', '--get-all', 'safe.directory').stdout.trim(), '');
  });
});

test('trusting a worktree for Codex uses forward slashes and never duplicates', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'hhh' });
    // git for Windows does not reliably match a safe.directory value written
    // with backslashes — measured against two real dispatches that still hit
    // "dubious ownership" with exactly that form already registered.
    const expected = wt.workspace.replaceAll('\\', '/');
    const trusted = () => git(root, 'config', '--global', '--get-all', 'safe.directory').stdout;
    const entries = () => trusted().split(/\r?\n/).filter(line => line.trim() === expected);
    trustWorktree(root, wt.workspace);
    assert.equal(entries().length, 1, 'the forward-slash form of the path must be registered');
    assert.doesNotMatch(trusted(), /\\/, 'no entry may be written with backslashes');
    trustWorktree(root, wt.workspace);
    assert.equal(entries().length, 1, 'the same path must not accumulate duplicate entries');
  });
});

// An abandoned worktree never reaches remove_worktree, so its trust entry used to
// outlive it (14 of 26 entries on one machine). Entries under this checkout's
// .worktrees/ that point at nothing are this tool's own leftovers.
test('stale trust entries for this checkout\'s vanished worktrees are pruned; others are untouched', () => {
  repo(root => {
    const gone = resolve(root, '.worktrees', 'long-gone').replaceAll('\\', '/');
    git(root, 'config', '--global', '--add', 'safe.directory', gone);
    git(root, 'config', '--global', '--add', 'safe.directory', 'C:/somewhere/else');
    prepareWorktree(root, { task_id: 'fresh' });
    const entries = git(root, 'config', '--global', '--get-all', 'safe.directory').stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    assert.ok(!entries.includes(gone));
    assert.ok(entries.includes('C:/somewhere/else'));
  });
});

// The trust entry is global state this tool wrote, so removing the worktree has
// to take it back. Measured on a real machine: 14 of 26 global safe.directory
// entries pointed at worktrees that no longer existed.
test('removing a worktree also removes the trust entry prepare wrote for it', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'trust' });
    trustWorktree(root, wt.workspace);
    const expected = wt.workspace.replaceAll('\\', '/');
    const trusted = () => git(root, 'config', '--global', '--get-all', 'safe.directory').stdout
      .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    git(root, 'config', '--global', '--add', 'safe.directory', 'C:/somewhere/else');
    assert.ok(trusted().includes(expected));

    removeWorktree(root, 'trust');
    assert.ok(!trusted().includes(expected), 'the removed worktree must no longer be trusted');
    assert.ok(trusted().includes('C:/somewhere/else'), 'entries this tool did not write stay untouched');
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

// `git status --porcelain` starts a modified tracked file with a space (` M
// path`). Trimming the whole output ate that space on the first line only, so
// the fixed-width slice took the path's first letter with it — measured on every
// real developer dispatch: `ocs/wiki/entities/slugify.md`, reported as a
// violation of owned_paths that contained `docs/wiki/entities/slugify.md`.
test('a modified tracked file listed first keeps its full path and is not a false violation', () => {
  repo(root => {
    const wt = prepareWorktree(root, { task_id: 'mod' });
    record(root, 'mod', { role: 'developer', access: 'write', owned_paths: ['.agents/rules.md', 'src'] });
    writeFileSync(resolve(wt.workspace, '.agents/rules.md'), 'edited in place\n');
    mkdirSync(resolve(wt.workspace, 'src'), { recursive: true });
    writeFileSync(resolve(wt.workspace, 'src/new.js'), 'created\n');

    const listed = listWorktrees(root).find(entry => entry.task_id === 'mod');
    assert.deepEqual(listed.changed_paths, ['.agents/rules.md', 'src/new.js']);
    assert.deepEqual(listed.violations, []);
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

// Enough engine config for a dispatch to compose, so a refusal is the only thing
// that can stop one.
const DISPATCH_CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: { developer: {} },
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-pro', balanced: 'inherit', fast: 'gemini-3.8-flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

// A fresh worktree per Behavior case meant a fresh dependency install per case.
// A finished task's worktree is handed to the next one only when it provably
// holds nothing: clean, merged, no violations, its dispatch decided.
const integrate = (root, wt, file) => {
  writeFileSync(resolve(wt.workspace, file), 'case\n');
  git(wt.workspace, 'add', file);
  git(wt.workspace, 'commit', '-qm', `feat: ${file}`);
  git(root, 'merge', '-q', '--no-edit', wt.branch);
};

test('a finished worktree is reused for the next task: new branch at HEAD, same directory, environment intact', () => {
  repo(root => {
    writeFileSync(resolve(root, '.gitignore'), 'node_modules/\n');
    writeFileSync(resolve(root, '.agents/config.json'), JSON.stringify(DISPATCH_CONFIG));
    git(root, 'add', '.gitignore', '.agents/config.json'); git(root, 'commit', '-qm', 'ignore deps');
    const first = prepareWorktree(root, { task_id: 'case-b1' });
    mkdirSync(resolve(first.workspace, 'node_modules'));
    writeFileSync(resolve(first.workspace, 'node_modules/installed.txt'), 'deps\n');
    integrate(root, first, 'b1.txt');

    const second = prepareWorktree(root, { task_id: 'case-b2', reuse: 'case-b1' });
    assert.equal(second.workspace, first.workspace);
    assert.equal(second.branch, 'worker/case-b2');
    assert.equal(second.reused_from, 'case-b1');
    assert.equal(second.base_sha, git(root, 'rev-parse', 'HEAD').stdout.trim(), 'based on the integrated HEAD');
    assert.ok(existsSync(resolve(second.workspace, 'b1.txt')), 'the previous case is in the new base');
    assert.ok(existsSync(resolve(second.workspace, 'node_modules/installed.txt')), 'the installed environment survived');
    assert.deepEqual(listWorktrees(root).map(entry => entry.task_id), ['case-b2']);
    assert.equal(git(root, 'rev-parse', '--verify', '--quiet', 'worker/case-b1').status, 1, 'the merged branch is gone');

    assert.throws(() => removeWorktree(root, 'case-b1'), /reused it/, 'removing the old task never touches the new checkout');
    // Retrying the old task by composing into it again would run its worker in
    // the new task's checkout, with no branch of its own left to inspect it
    // against (adversary R4-F1 on PR #40).
    assert.throws(() => prepareDispatch(root, { role: 'developer', instructions: 'Retry.', owned_paths: ['src'],
      task_id: 'case-b1', workspace: first.workspace, conductorEngine: 'claude' }),
    /task "case-b2" reused it/, 'composing into the old task never lands in the new checkout');
    assert.ok(existsSync(second.workspace));
    removeWorktree(root, 'case-b2');
    assert.equal(existsSync(second.workspace), false);
  });
});

test('a worktree still holding something is never reused', () => {
  repo(root => {
    const dirty = prepareWorktree(root, { task_id: 'dirty' });
    writeFileSync(resolve(dirty.workspace, 'wip.txt'), 'x\n');
    assert.throws(() => prepareWorktree(root, { task_id: 'next1', reuse: 'dirty' }), /uncommitted/);

    const unmerged = prepareWorktree(root, { task_id: 'unmerged' });
    writeFileSync(resolve(unmerged.workspace, 'u.txt'), 'x\n');
    git(unmerged.workspace, 'add', 'u.txt'); git(unmerged.workspace, 'commit', '-qm', 'u');
    assert.throws(() => prepareWorktree(root, { task_id: 'next2', reuse: 'unmerged' }), /not merged/);

    const undecided = prepareWorktree(root, { task_id: 'undecided' });
    record(root, 'undecided', { access: 'read-only', role: 'adversary' });
    assert.throws(() => prepareWorktree(root, { task_id: 'next3', reuse: 'undecided' }), /no recorded decision/);

    assert.throws(() => prepareWorktree(root, { task_id: 'next4', reuse: 'nothing-here' }), /No worktree/);
    assert.throws(() => prepareWorktree(root, { task_id: 'dirty', reuse: 'undecided' }), /already prepared/);
    assert.ok(existsSync(undecided.workspace), 'a refusal changes nothing');
  });
});
