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
import { runBounded } from '../process-tree.mjs';
import { cleanup } from './helpers.mjs';

const TOOL = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const sleep = ms => new Promise(done => setTimeout(done, ms));

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
