// F-A: a reviewer handed a commit range could not see the diff. The worker
// allowlist grants fixed `git diff` forms and nothing matching
// `git diff <sha>..<sha>`, so a conscientious reviewer refused the variation and
// reviewed post-change files whole instead — four valid findings, produced
// blind (dispatch-findings 2026-09-10, F-A). The conductor computes the diff and
// the MCP embeds it, so it is present by construction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeDiff } from '../diff.mjs';
import { prepareDispatch } from '../dispatch.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const git = (root, ...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });

// Two commits, so there is a real range to ask for.
function repo(fn) {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG) });
  git(root, 'init', '-b', 'main', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  writeFileSync(resolve(root, 'src.txt'), 'first line\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');
  const before = git(root, 'rev-parse', 'HEAD').stdout.trim();
  writeFileSync(resolve(root, 'src.txt'), 'first line\nsecond line\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'second');
  const after = git(root, 'rev-parse', 'HEAD').stdout.trim();
  try { return fn(root, before, after); } finally { cleanup(root); }
}

test('computes the patch and the stat for a commit range', () => {
  repo((root, before, after) => {
    const diff = computeDiff(root, `${before}..${after}`);
    assert.match(diff.patch, /\+second line/);
    assert.match(diff.stat, /src\.txt/);
    assert.equal(diff.truncated, false);
    assert.ok(diff.bytes > 0);
  });
});

test('an empty range is reported as empty rather than as an absent diff', () => {
  repo((root, _before, after) => {
    const diff = computeDiff(root, `${after}..${after}`);
    assert.equal(diff.empty, true);
  });
});

// The range reaches git as one argv element, never a shell word — but a value
// that could be read as a flag or a path must not get that far either.
test('a range that is not a range is refused before git is invoked', () => {
  repo(root => {
    for (const bad of ['--output=/tmp/x', '; rm -rf /', '$(whoami)', 'a b', '']) {
      assert.throws(() => computeDiff(root, bad), /range/i, `accepted ${JSON.stringify(bad)}`);
    }
  });
});

test('an unknown revision fails with git\'s own message, not a silent empty diff', () => {
  repo(root => {
    assert.throws(() => computeDiff(root, 'deadbee..deadbef'), /git|revision|unknown/i);
  });
});

// A prompt is not the place to discover that a diff was 4 MB. Truncation is
// bounded, marked, and reported in bytes so the conductor can re-scope.
test('an oversized patch is truncated on a line boundary and says so', () => {
  repo((root, before, after) => {
    const diff = computeDiff(root, `${before}..${after}`, { maxBytes: 20 });
    assert.equal(diff.truncated, true);
    assert.ok(diff.patch.length <= 20 + 200, 'truncation must bound the patch, not just flag it');
    assert.match(diff.patch, /truncat/i);
  });
});

test('dispatch embeds the diff for a range and reports what it cost', () => {
  repo((root, before, after) => {
    const result = prepareDispatch(root, { role: 'adversary', instructions: 'Review the change.',
      diff_range: `${before}..${after}`, conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.match(readFileSync(result.prompt_file, 'utf8'), /\+second line/);
    assert.equal(result.diff_range, `${before}..${after}`);
    assert.ok(result.diff_bytes > 0);
    assert.equal(result.diff_truncated, false);
  });
});

// An empty diff usually means the conductor passed the wrong range. Silence
// there costs a whole dispatch before anyone notices.
test('dispatching a review over an empty range warns instead of proceeding quietly', () => {
  repo((root, _before, after) => {
    const result = prepareDispatch(root, { role: 'adversary', instructions: 'Review the change.',
      diff_range: `${after}..${after}`, conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.ok(result.warnings.some(w => /empty|no changes/i.test(w)), 'an empty diff must be called out');
  });
});
