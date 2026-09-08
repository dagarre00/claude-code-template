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
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`git ${args[0]} failed: ${(result.error?.message ?? result.stderr ?? result.stdout ?? '').trim()}`);
  }
  return result.stdout.trim();
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
function trustForCodex(root, workspace) {
  const forwardSlashPath = workspace.replaceAll('\\', '/');
  const existing = git(root, ['config', '--global', '--get-all', 'safe.directory'], { allowFailure: true });
  const already = (existing ?? '').split('\n').some(line => resolve(line.trim()) === resolve(workspace));
  if (!already) git(root, ['config', '--global', '--add', 'safe.directory', forwardSlashPath], { allowFailure: true });
}

function taskDir(root, task_id) {
  if (typeof task_id !== 'string' || !SLUG.test(task_id)) {
    throw new Error(`Invalid task id ${JSON.stringify(task_id)}; expected a plain slug`);
  }
  return resolve(root, WORKSPACES, task_id);
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

export function prepareWorktree(root, { task_id } = {}) {
  const workspace = taskDir(root, task_id);
  if (realpathSync(git(root, ['rev-parse', '--show-toplevel'])) !== realpathSync(root)) {
    throw new Error('Root must be the top level of a Git worktree');
  }
  exclude(root);
  // Checked after exclude(), so the freshly created .worktrees/ is not itself
  // the reason the tree looks dirty.
  if (!isClean(root)) {
    throw new Error('Checkout is dirty; commit or set aside your changes before dispatching a worker');
  }
  if (existsSync(workspace)) throw new Error(`Workspace already exists: ${workspace}`);
  const branch = `worker/${task_id}`;
  const base_sha = git(root, ['rev-parse', 'HEAD']);
  git(root, ['worktree', 'add', '-b', branch, workspace, base_sha]);
  trustForCodex(root, workspace);
  return { task_id, workspace, branch, base_sha,
    integration_branch: git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true }) };
}

export function listWorktrees(root) {
  const raw = git(root, ['worktree', 'list', '--porcelain']);
  return raw.split(/\n\n+/).map(entry => {
    const path = /^worktree (.+)$/m.exec(entry)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(entry)?.[1];
    return path && branch?.startsWith('worker/')
      ? { task_id: branch.slice('worker/'.length), workspace: path, branch,
          head: /^HEAD ([0-9a-f]+)$/m.exec(entry)?.[1] ?? null }
      : null;
  }).filter(Boolean);
}

export function removeWorktree(root, task_id) {
  const workspace = taskDir(root, task_id);
  const branch = `worker/${task_id}`;
  if (!existsSync(workspace)) throw new Error(`No such workspace: ${workspace}`);
  // Uncommitted work in a worktree is the worker's output. Removing it because
  // a cleanup step was called is exactly the kind of silent data loss the
  // behavioral rules exist to prevent.
  if (!isClean(workspace)) {
    throw new Error(`Worker checkout has uncommitted work; inspect ${workspace} before removing it`);
  }
  git(root, ['worktree', 'remove', workspace]);
  // -d, never -D: it refuses when the branch holds commits that are not merged
  // anywhere, which is precisely the case where deleting would lose delivered work.
  const deleted = git(root, ['branch', '-d', branch], { allowFailure: true });
  if (deleted === null) {
    // Put the worktree back so the caller is not left with commits reachable
    // only from a branch and no checkout to inspect them in.
    git(root, ['worktree', 'add', workspace, branch], { allowFailure: true });
    throw new Error(`Branch ${branch} holds unmerged commits; merge or drop it before cleanup`);
  }
  return { task_id, removed: workspace, branch };
}
