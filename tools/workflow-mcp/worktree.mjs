// Isolated checkouts for workers.
//
// The MCP prepares and tears these down; it never runs a worker inside one and
// never commits. Isolation is the point: two workers editing one checkout
// collide, and a worker that misbehaves in its own worktree cannot touch the
// conductor's working tree.
//
// A worktree is NOT a security boundary. The Git store and the machine's
// credentials are shared, and the CLI's own permission model is what actually
// constrains the process. It prevents collisions, not malice.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const WORKSPACES = '.worktrees';
// A worktree sits one level deeper than the checkout, and what it holds that git
// ignores — a virtualenv, node_modules — goes deeper still. On Windows that passes
// MAX_PATH, and without this `git worktree remove` fails half-way: measured, it
// unregistered the worktree, deleted part of the tracked tree, and left the
// directory and branch behind. A no-op on any OS without the limit.
const LONG_PATHS = ['-c', 'core.longpaths=true'];
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// `trim: false` is for column-sensitive output. Porcelain status starts a
// modified tracked file with a space, and trimming the whole output removes it
// from the first line only.
export function git(root, args, { allowFailure = false, trim = true } = {}) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    const subcommand = args[0] === '-c' ? args[2] : args[0];
    throw new Error(`git ${subcommand} failed: ${(result.error?.message ?? result.stderr ?? result.stdout ?? '').trim()}`);
  }
  return trim ? result.stdout.trim() : result.stdout;
}

const isClean = root => git(root, ['status', '--porcelain=v1', '--untracked-files=all']) === '';

// Codex on Windows runs a worker under a different OS SID than the repo owner,
// so every git call in the worktree fails `fatal: detected dubious ownership`
// unless that exact path is trusted first — measured, and the trailing-`/*`
// wildcard some git versions document does NOT suppress it (also measured), so
// each worktree path needs its own literal entry. This must be --global: the
// ownership check runs before local config is trusted, so a per-repo config
// entry can never be the thing that clears it. Harmless on any OS where the
// check never fires; skipped (never fatal) if git itself is missing the ability
// to read the existing list, since worktree creation must not depend on it.
//
// The value itself must use forward slashes. `resolve()` on Windows returns a
// backslash path, and git for Windows does not reliably match a safe.directory
// entry written that way against the (forward-slash) path it actually compares
// — confirmed the hard way: two real dispatches still hit "dubious ownership"
// with a backslash entry already registered for the exact directory. Comparison
// for the dedup check below still goes through `resolve()` on both sides, so it
// stays correct regardless of which slash direction an existing entry (old or
// new) happens to use.
//
// Called when a codex dispatch is composed, not when a worktree is prepared: a
// project that never dispatches to codex has no reason to have its global git
// config edited.
export function trustWorktree(root, workspace) {
  const forwardSlashPath = workspace.replaceAll('\\', '/');
  const existing = git(root, ['config', '--global', '--get-all', 'safe.directory'], { allowFailure: true });
  const already = (existing ?? '').split('\n').some(line => line.trim() && resolve(line.trim()) === resolve(workspace));
  if (!already) git(root, ['config', '--global', '--add', 'safe.directory', forwardSlashPath], { allowFailure: true });
}

// Trust entries this tool wrote for worktrees of this checkout that no longer
// exist — an abandoned worktree never reaches remove_worktree. Only paths
// directly under <root>/.worktrees/ are candidates; nothing else is touched.
function pruneStaleTrust(root) {
  const existing = git(root, ['config', '--global', '--get-all', 'safe.directory'], { allowFailure: true }) ?? '';
  const base = resolve(root, WORKSPACES);
  for (const value of new Set(existing.split('\n').map(line => line.trim()).filter(Boolean))) {
    if (value === '*') continue;
    const path = resolve(value);
    if (dirname(path) !== base || existsSync(path)) continue;
    git(root, ['config', '--global', '--fixed-value', '--unset-all', 'safe.directory', value], { allowFailure: true });
  }
}

// The inverse, run when the worktree goes away. Every entry naming this exact
// path is removed, in whichever slash direction it was written; nothing else in
// the list is touched. Never fatal, for the same reason trusting is not.
function untrust(root, workspace) {
  const existing = git(root, ['config', '--global', '--get-all', 'safe.directory'], { allowFailure: true }) ?? '';
  for (const value of new Set(existing.split('\n').map(line => line.trim()).filter(Boolean))) {
    if (value === '*' || resolve(value) !== resolve(workspace)) continue;
    git(root, ['config', '--global', '--fixed-value', '--unset-all', 'safe.directory', value], { allowFailure: true });
  }
}

function taskDir(root, task_id) {
  if (typeof task_id !== 'string' || !SLUG.test(task_id)) {
    throw new Error(`Invalid task id ${JSON.stringify(task_id)}; expected a plain slug`);
  }
  return resolve(root, WORKSPACES, task_id);
}

// Where everything a task's dispatches leave behind lives: prompts, reports, the
// records inspect_dispatch reads. Beside the worktrees rather than inside one, so
// it survives remove_worktree and never dirties a worker's checkout. The same slug
// check as the worktree itself: a task id becomes a path.
export function dispatchDir(root, task_id) {
  taskDir(root, task_id);
  return resolve(root, WORKSPACES, '.dispatch', task_id);
}

// The workspace root lives inside the checkout, so it must be ignored or it
// dirties the very tree dispatch requires to be clean. Writing it to
// .git/info/exclude rather than .gitignore keeps this correct in any adopting
// repository, including one that rewrote its .gitignore.
function exclude(root) {
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const path = resolve(common, 'info', 'exclude');
  mkdirSync(dirname(path), { recursive: true });
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const entry = `/${WORKSPACES}/`;
  if (current.split(/\r?\n/).includes(entry)) return;
  writeFileSync(path, current + (current && !current.endsWith('\n') ? '\n' : '') + entry + '\n');
}

// A path in the one form two paths can be compared in. realpathSync.native, not
// the JS realpath: measured on GitHub's Windows runner, the temp directory is an 8.3
// short name (RUNNER~1) that only the native call expands, while git reports the
// long one; and on macOS /var is a symlink to /private/var, which git resolves
// and resolve() does not. Case never matters on Windows.
const located = path => {
  let real;
  try { real = realpathSync.native(path); } catch { real = resolve(path); }
  const norm = real.replaceAll('\\', '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? norm.toLowerCase() : norm;
};

// Whether two paths name the same directory.
export function sameLocation(a, b) {
  return located(a) === located(b);
}

// Whether `path` lies inside `dir`.
const within = (path, dir) => located(path).startsWith(`${located(dir)}/`);

const readRecord = (root, task_id, name) => {
  const path = resolve(root, WORKSPACES, '.dispatch', task_id, name);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

// Where a task's checkout is. Usually .worktrees/<task_id>; a reused one keeps
// the directory of the task it was first prepared for, and its record says so.
export const workspaceOf = (root, task_id) => readRecord(root, task_id, 'worktree.json')?.workspace ?? taskDir(root, task_id);

// A cycle dispatches one developer per Behavior case, and a fresh worktree per
// case meant a fresh dependency install per case — node_modules, a virtualenv —
// and its output in the conductor's context. A worktree that is provably holding
// nothing (clean, every commit merged, no violations, its dispatch decided) can
// be handed to the next task instead: a new worker/<task> branch at the current
// HEAD, in the same directory, with its ignored environment intact.
function reuseWorktree(root, task_id, reuse) {
  taskDir(root, reuse);
  if (readRecord(root, task_id, 'worktree.json')) throw new Error(`Task "${task_id}" is already prepared`);
  const previous = listWorktrees(root).find(entry => entry.task_id === reuse);
  if (!previous) throw new Error(`No worktree for task "${reuse}" to reuse`);
  if (!previous.clean) {
    throw new Error(`Worktree "${reuse}" has uncommitted changes (${previous.changed_paths.join(', ')}); it is not reusable`);
  }
  if (previous.violations?.length) throw new Error(`Worktree "${reuse}" has scope violations; it is not reusable`);
  if (previous.merged !== true) {
    throw new Error(`Worker branch ${previous.branch} holds commits not merged into the current branch; merge them first`);
  }
  if (readRecord(root, reuse, 'dispatch.json') && !readRecord(root, reuse, 'decision.json')) {
    throw new Error(`Task "${reuse}" has a dispatch with no recorded decision; decide on it before reusing its worktree`);
  }
  const branch = `worker/${task_id}`;
  const base_sha = git(root, ['rev-parse', 'HEAD']);
  git(root, ['branch', branch, base_sha]);
  git(previous.workspace, ['checkout', '-q', branch]);
  // -d, never -D: merged was checked above, and a refusal here still loses nothing.
  git(root, ['branch', '-d', previous.branch], { allowFailure: true });
  const previousRecord = readRecord(root, reuse, 'worktree.json');
  if (previousRecord) {
    writeFileSync(resolve(root, WORKSPACES, '.dispatch', reuse, 'worktree.json'),
      JSON.stringify({ ...previousRecord, reused_by: task_id }, null, 2) + '\n');
  }
  // The path as the earlier task recorded it, not as git lists it: git gives the
  // real path (/private/var on macOS, forward slashes on Windows), while every
  // record, trust entry and command was written with the prepared form.
  return { workspace: previousRecord?.workspace ?? resolve(previous.workspace), branch, base_sha, reused_from: reuse };
}

export function prepareWorktree(root, { task_id, reuse } = {}) {
  taskDir(root, task_id);
  if (!sameLocation(git(root, ['rev-parse', '--show-toplevel']), root)) {
    throw new Error('Root must be the top level of a Git worktree');
  }
  exclude(root);
  // Checked after exclude(), so the freshly created .worktrees/ is not itself
  // the reason the tree looks dirty.
  if (!isClean(root)) {
    throw new Error('Checkout is dirty; commit or set aside your changes before dispatching a worker');
  }
  let prepared;
  if (reuse != null) prepared = reuseWorktree(root, task_id, reuse);
  else {
    const workspace = taskDir(root, task_id);
    if (existsSync(workspace)) throw new Error(`Workspace already exists: ${workspace}`);
    const branch = `worker/${task_id}`;
    const base_sha = git(root, ['rev-parse', 'HEAD']);
    git(root, [...LONG_PATHS, 'worktree', 'add', '-b', branch, workspace, base_sha]);
    prepared = { workspace, branch, base_sha };
  }
  pruneStaleTrust(root);
  const record = { task_id, ...prepared,
    integration_branch: git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true }) };
  // Written now, so a worktree that is prepared and then abandoned — an
  // interrupted session — still says what it was branched from and for.
  const dir = dispatchDir(root, task_id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'worktree.json'),
    JSON.stringify({ ...record, created_at: new Date().toISOString() }, null, 2) + '\n');
  return record;
}

// What a dispatch left beside its prompt. Absent for a worktree prepared but
// never dispatched into, or one from before this file existed — in which case
// the listing reports what it can see and declines to guess the rest.
const dispatchRecord = (root, task_id) => readRecord(root, task_id, 'dispatch.json');

// `git status --porcelain=v1` pads a two-column status before the path, and a
// rename carries `old -> new`. The destination is the path that exists now,
// which is the one a violation is about.
const changedPaths = workspace => (git(workspace, ['status', '--porcelain=v1', '--untracked-files=all'], { trim: false }) || '')
  .split('\n').filter(line => line.trim())
  .map(line => line.slice(3).trim().replace(/^.* -> /, '').replace(/^"|"$/g, ''));

const under = (path, owned) => owned.some(base => path === base || path.startsWith(`${base}/`));

export function listWorktrees(root) {
  const raw = git(root, ['worktree', 'list', '--porcelain']);
  // Where a retirable worktree's commits would have to have landed. Detached
  // HEAD leaves nothing to compare against, and an unanswerable question is
  // reported as unanswered rather than as "no".
  const integration = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });
  // git lists every worktree of the repository, and a parallel conductor's own
  // checkout is usually one of them, with worker/* branches of its own. Its
  // dispatch records live in its checkout, not here, so only this checkout's
  // .worktrees/ is ours to list, reuse or remove.
  const home = resolve(root, WORKSPACES);

  return raw.split(/\n\n+/).map(entry => {
    const path = /^worktree (.+)$/m.exec(entry)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(entry)?.[1];
    if (!path || !branch?.startsWith('worker/') || !within(path, home)) return null;
    const task_id = branch.slice('worker/'.length);
    const record = dispatchRecord(root, task_id);
    const changed = existsSync(path) ? changedPaths(path) : [];

    // Read-only is a promise the prompt makes and two of three engines cannot
    // enforce, so it was left to the conductor to verify by hand afterwards
    // (dispatch-findings F-F). The MCP owns this path; it can just look. For a
    // write role the same check has a different shape: anything outside
    // owned_paths is work nobody will commit, which fails integration silently.
    const owned = Array.isArray(record?.owned_paths) ? record.owned_paths : null;
    // Protected paths win over ownership: an owned directory that contains the
    // architecture rules still may not change them.
    const guarded = Array.isArray(record?.protected_paths) ? record.protected_paths : [];
    const violations = record?.access === 'read-only' ? changed
      : owned ? changed.filter(file => !under(file, owned) || under(file, guarded))
        : null;

    // Provably holding nothing unique: nothing uncommitted, and every commit on
    // the branch already reachable from the integration branch. Both halves are
    // computable, and verifying them by hand across eleven worktrees is what
    // this replaces (dispatch-findings F-G).
    const merged = integration
      ? git(root, ['merge-base', '--is-ancestor', branch, integration], { allowFailure: true }) !== null
      : null;

    return { task_id, workspace: path, branch,
      head: /^HEAD ([0-9a-f]+)$/m.exec(entry)?.[1] ?? null,
      role: record?.role ?? null,
      access: record?.access ?? null,
      engine: record?.engine ?? null,
      owned_paths: owned,
      clean: changed.length === 0,
      changed_paths: changed,
      violations,
      merged,
      retirable: changed.length === 0 && merged === true && !(violations?.length) };
  }).filter(Boolean);
}

export function removeWorktree(root, task_id) {
  // The live listing, not the record: a reused worktree's directory is named for
  // an earlier task whose record still points at it, and removing by that record
  // would delete the checkout the later task is using.
  const entry = listWorktrees(root).find(candidate => candidate.task_id === task_id);
  const branch = `worker/${task_id}`;
  if (!entry || !existsSync(entry.workspace)) {
    const reusedBy = readRecord(root, task_id, 'worktree.json')?.reused_by;
    throw new Error(reusedBy
      ? `Task "${task_id}" has no worktree of its own any more: task "${reusedBy}" reused it`
      : `No such workspace: ${workspaceOf(root, task_id)}`);
  }
  // Removed by the path the task recorded, which is the form its trust entry was
  // written in; the listing only proves this task's branch is what is there.
  const recorded = readRecord(root, task_id, 'worktree.json')?.workspace;
  const workspace = recorded && sameLocation(recorded, entry.workspace) ? recorded : resolve(entry.workspace);
  // Uncommitted work in a worktree is the worker's output. Removing it because
  // a cleanup step was called is exactly the kind of silent data loss the
  // behavioral rules exist to prevent.
  if (!isClean(workspace)) {
    throw new Error(`Worker checkout has uncommitted work; inspect ${workspace} before removing it`);
  }
  git(root, [...LONG_PATHS, 'worktree', 'remove', workspace]);
  // -d, never -D: it refuses when the branch holds commits that are not merged
  // anywhere, which is precisely the case where deleting would lose delivered work.
  const deleted = git(root, ['branch', '-d', branch], { allowFailure: true });
  if (deleted === null) {
    // Put the worktree back so the caller is not left with commits reachable
    // only from a branch and no checkout to inspect them in.
    git(root, ['worktree', 'add', workspace, branch], { allowFailure: true });
    throw new Error(`Branch ${branch} holds unmerged commits; merge or drop it before cleanup`);
  }
  untrust(root, workspace);
  return { task_id, removed: workspace, branch };
}
