// The watchdog acts on a dispatch after its runner is gone, so everything it
// knows comes from two numbers and a file: a pid and the dispatch's outcome.json.
// Both outlive what they named. A retry reuses the directory and rewrites the
// record, and a Windows pid is free for reuse the moment its process exits.
// These run the real watchdog against a stand-in runner and a bystander process
// that holds the worker's pid, to simulate a pid Windows has given to someone else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { cleanup } from './helpers.mjs';

const WATCHDOG = fileURLToPath(new URL('../watchdog.mjs', import.meta.url));
const WINDOWS_ONLY = process.platform !== 'win32'
  && 'a POSIX group id is not reused while any member remains, so the group is still safe to stop';

const node = code => spawn(process.execPath, ['-e', code], { stdio: 'ignore', windowsHide: true });
const exited = child => (child.exitCode !== null || child.signalCode !== null
  ? Promise.resolve()
  : new Promise(done => child.once('exit', () => done())));
const within = (promise, ms, what) => Promise.race([promise,
  new Promise((_, fail) => setTimeout(() => fail(new Error(`${what} still running after ${ms}ms`)), ms).unref())]);

// A dispatch directory holding `record`, a runner that exits in a moment, and
// the watchdog that runner would have started for `worker`.
function watched(record, worker, startedAt) {
  const dir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-watchdog-'));
  const outcome = resolve(dir, 'outcome.json');
  writeFileSync(outcome, JSON.stringify(record));
  const runner = node('setTimeout(() => {}, 300)');
  const watchdog = spawn(process.execPath, [WATCHDOG, String(runner.pid), String(worker.pid), dir, startedAt],
    { stdio: 'ignore', windowsHide: true });
  return { dir, outcome, runner, watchdog, read: () => JSON.parse(readFileSync(outcome, 'utf8')) };
}

// Seen in CI on 2026-09-26: a retried e2e dispatch was rejected as stopped from
// outside. The first attempt's watchdog woke after the retry had recorded its
// start, found a runner gone and a record without a finish, and stamped
// runner_stopped onto the retry, which kept it through its own finish.
test('a finished attempt\'s watchdog never writes into the next attempt\'s record', async () => {
  const worker = node('');
  await exited(worker);
  const run = watched({ started_at: 'attempt-1' }, worker, 'attempt-1');
  try {
    writeFileSync(run.outcome, JSON.stringify({ started_at: 'attempt-1', finished_at: new Date().toISOString(), exit_code: 0 }));
    await exited(run.runner);
    // The conductor retries at once: the record is archived and the retry records its start.
    writeFileSync(run.outcome, JSON.stringify({ started_at: 'attempt-2' }));
    await within(exited(run.watchdog), 10_000, 'the watchdog');
    assert.deepEqual(run.read(), { started_at: 'attempt-2' }, 'the first attempt\'s watchdog wrote into the retry\'s record');
  } finally { cleanup(run.dir); }
});

// Seen in CI on 2026-09-26: a test file's node process on Windows died after
// 88ms with exit code 1 and no output, which is what taskkill /F leaves behind.
// A watchdog whose dispatch had finished still stopped whatever held the
// worker's old pid once the runner was gone.
test('once the dispatch has finished, its watchdog stops nothing, whatever holds the worker\'s pid now',
  { skip: WINDOWS_ONLY }, async () => {
    const bystander = node('setTimeout(() => {}, 15000)');
    const run = watched({ started_at: 'a', finished_at: new Date().toISOString(), exit_code: 0 }, bystander, 'a');
    try {
      await exited(run.runner);
      await within(exited(run.watchdog), 10_000, 'the watchdog');
      assert.equal(bystander.exitCode, null, `the watchdog stopped a process that was not its worker (exit ${bystander.exitCode})`);
    } finally { bystander.kill(); cleanup(run.dir); }
  });

// The same pid, earlier: the worker has exited and the runner is still
// extracting its report when it is killed. The run is recorded as stopped from
// outside, but the pid is no longer the worker's to stop.
test('a runner killed after its worker exited is recorded as stopped, and nothing holding the worker\'s pid is',
  { skip: WINDOWS_ONLY }, async () => {
    const bystander = node('setTimeout(() => {}, 15000)');
    const run = watched({ started_at: 'a', worker_exited_at: new Date().toISOString() }, bystander, 'a');
    try {
      await exited(run.runner);
      await within(exited(run.watchdog), 10_000, 'the watchdog');
      assert.equal(bystander.exitCode, null, `the watchdog stopped a process that was not its worker (exit ${bystander.exitCode})`);
      const record = run.read();
      assert.equal(record.runner_stopped, true, 'the killed runner was not recorded');
      assert.equal(record.exit_code, 137);
    } finally { bystander.kill(); cleanup(run.dir); }
  });
