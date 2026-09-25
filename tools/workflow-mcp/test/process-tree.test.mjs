// A time limit that kills only the direct child is no limit: measured on
// Windows, the red check's timeout killed cmd.exe and left the test process it
// had started running, holding the worktree open. These run the same on every
// platform — the mechanism differs (taskkill /T, a POSIX process group), the
// guarantee does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { killTree, runBounded } from '../process-tree.mjs';
import { cleanup } from './helpers.mjs';

const TOOL = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const sleep = ms => new Promise(done => setTimeout(done, ms));

// Every caller hands killTree a process-group leader (runBounded detaches its
// child on POSIX), so a failed group kill means the group is gone — and the
// bare pid may by then belong to an unrelated process (adversary R1-F1 on
// PR #40). The stub stands in for process.kill: no real process is signalled.
test('on POSIX a process group that is gone is left alone, never retried as a bare pid', () => {
  const calls = [];
  const kill = pid => {
    calls.push(pid);
    throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
  };
  killTree(2147483645, { platform: 'linux', kill });
  assert.deepEqual(calls, [-2147483645]);
});

test('a timeout stops the process and everything it started', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-tree-'));
  try {
    const marker = resolve(dir, 'grandchild-survived.txt');
    // The parent starts a grandchild that writes the marker after two seconds,
    // then waits on it; the limit is half a second.
    const grandchild = `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 2000)`;
    const parent = `const c = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'inherit' }); c.on('close', () => {});`;
    const started = Date.now();
    const run = await runBounded({ file: process.execPath, args: ['-e', parent], timeoutMs: 500 });
    assert.equal(run.timed_out, true);
    assert.equal(run.status === 0, false, 'a killed run never reads as success');
    assert.ok(Date.now() - started < 10_000, 'it returned instead of waiting for the tree');
    await sleep(3000);
    assert.equal(existsSync(marker), false, 'the grandchild outlived the limit');
  } finally { cleanup(dir); }
});

test('a command line runs through the shell, and only a bounded tail of its output is kept', async () => {
  // exitCode, not exit(): on macOS a pipe write is asynchronous, and exit()
  // right after it drops what is still buffered.
  const run = await runBounded({ command: `"${process.execPath}" -e "process.stdout.write('a'.repeat(100000) + 'END'); process.exitCode = 3"`,
    tailBytes: 1000 });
  assert.equal(run.status, 3);
  assert.equal(run.timed_out, false);
  assert.ok(run.output.length <= 1000 && run.output.endsWith('END'), `kept ${run.output.length} bytes`);
});

test('an executable that does not exist is an error, not an exit code', async () => {
  const run = await runBounded({ file: resolve(tmpdir(), 'no-such-executable-here') });
  assert.equal(run.status, null);
  assert.match(run.error, /ENOENT/);
});

// runBounded's own limit dies with its process. Stopped from outside — a shell
// tool giving up on a command, TerminateProcess, SIGKILL — it cannot clean up,
// and what it started ran on: measured, a stopped shell's grep ran for an hour
// and a half. The watchdog outlives the parent and takes the tree down.
// Measured without the guard: on Linux the child survived its killed parent (it
// leads its own process group); on Windows node's job object already took it,
// so this test only discriminates on Linux and macOS — where CI runs it too.
// On POSIX the guarded child leads a process group, and the group is what has to
// die: a leader that exits while what it started runs on — here holding the
// output pipe, so the parent is still waiting — used to end the watch, and a
// parent killed after that left the rest running (adversary R5-F1 on PR #40).
// Windows has no equivalent: taskkill /T finds a tree only through its live parent.
test('a guarded group outlives its leader, and still dies with its killed parent',
  { skip: process.platform === 'win32' && 'a Windows tree is found only through its live parent' }, async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-group-'));
    try {
      const marker = resolve(dir, 'descendant-survived.txt');
      const parentScript = resolve(dir, 'parent.mjs');
      writeFileSync(parentScript, `import { runBounded } from ${JSON.stringify(pathToFileURL(resolve(TOOL, 'process-tree.mjs')).href)};\n`
        + `await runBounded({ guard: true, command: ${JSON.stringify(`(sleep 6; touch '${marker}') & exit 0`)} });\n`);
      const parent = spawn(process.execPath, [parentScript], { stdio: 'ignore' });
      await sleep(2500);
      parent.kill('SIGKILL');
      await sleep(7000);
      assert.equal(existsSync(marker), false, 'what the leader started outlived the killed parent');
    } finally { cleanup(dir); }
  });

test('a guarded child dies with its parent, even when the parent is killed outright', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-guard-'));
  try {
    const marker = resolve(dir, 'child-survived.txt');
    const parentScript = resolve(dir, 'parent.mjs');
    writeFileSync(parentScript, `import { runBounded } from ${JSON.stringify(pathToFileURL(resolve(TOOL, 'process-tree.mjs')).href)};\n`
      + `await runBounded({ file: process.execPath, stdio: 'ignore', guard: true, args: ['-e', `
      + `${JSON.stringify(`setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 6000)`)}] });\n`);
    const parent = spawn(process.execPath, [parentScript], { stdio: 'ignore' });
    await sleep(2000);
    parent.kill('SIGKILL');
    await sleep(8000);
    assert.equal(existsSync(marker), false, 'the child outlived its killed parent');
  } finally { cleanup(dir); }
});
