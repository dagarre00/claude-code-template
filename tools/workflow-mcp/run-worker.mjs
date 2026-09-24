#!/usr/bin/env node
// Runs one composed dispatch: the engine process, its time limit, its report.
// build_worker_prompt writes everything it needs to run.json in the dispatch
// directory and hands the conductor back one short line — `node run-worker.mjs
// <dispatchDir>` — which is the whole command on every engine and every OS.
//
// It replaces a shell pipeline that was returned inline (~500 tokens, re-typed
// by the conductor into its shell on every dispatch), needed a POSIX shell, and
// could not enforce a time limit: only agy had its own, and a claude or codex
// worker ran for as long as it liked. Here:
//
//   - the engine is spawned directly from its argv — no shell, so no quoting and
//     no difference between bash, zsh, PowerShell and cmd;
//   - `workerTimeoutSeconds` holds for every engine, and on expiry the whole
//     process tree is stopped (process-tree.mjs), exit 124;
//   - the outcome is recorded before and after (record-outcome.mjs), so
//     inspect_dispatch can read how the run went;
//   - the report lands in report_file whatever the engine — stdout captured
//     (claude), written by the engine (codex, -o), or extracted from the raw
//     transcript (antigravity) — and is printed at the end.
//
// The MCP server still spawns nothing: the conductor runs this, as it runs
// red-check.mjs.
//
// Usage: node run-worker.mjs <dispatchDir>
// Exit:  the engine's own exit code, or the extraction's when the engine exited
//        0 and extraction found a failure; 124 on timeout; 127 when the
//        executable is not installed; 128+n when a signal stopped the runner.
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { constants } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locateExecutable, shimProblem } from './availability.mjs';
import { killTree, runBounded } from './process-tree.mjs';
import { recordFinish, recordStart } from './record-outcome.mjs';

const ENGINES_DIR = fileURLToPath(new URL('./engines', import.meta.url));
export const TIMEOUT_EXIT = 124;

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// A file descriptor for each stream the run record routes somewhere, opened
// once so stdout and stderr can share the raw transcript.
function openStreams(run) {
  const fds = new Map();
  const target = name => {
    if (name === 'inherit') return 'inherit';
    const path = name === 'report' ? run.report_file : run.raw_file;
    if (!fds.has(path)) fds.set(path, openSync(path, 'w'));
    return fds.get(path);
  };
  const stdin = openSync(run.stdin_file, 'r');
  return { stdio: [stdin, target(run.stdout), target(run.stderr)], close: () => {
    closeSync(stdin);
    for (const fd of fds.values()) closeSync(fd);
  } };
}

const note = (path, text) => {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (!current.trim()) writeFileSync(path, `${text}\n`);
};

export async function runWorker(dir) {
  const run = readJson(resolve(dir, 'run.json'));
  recordStart(dir);
  const { path: executable, shim } = locateExecutable(run.executable);
  if (!executable) {
    writeFileSync(run.report_file, shim ? `${shimProblem(run.engine, shim)} No worker ran.\n`
      : `The ${run.engine} executable "${run.executable}" was not found on PATH, so no worker `
        + 'ran. Install it, fix engines.<engine>.executable, or dispatch with another cli_engine.\n');
    return recordFinish(dir, { processCode: 127 });
  }

  const streams = openStreams(run);
  let child = null;
  let stoppedBy = null;
  // Something stopping the runner — a conductor interrupting it — stops the
  // worker too: it leads its own process group and would not hear the signal.
  const onSignal = signal => {
    stoppedBy = signal;
    if (child) killTree(child.pid);
  };
  const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => {
    const handler = () => onSignal(signal);
    process.on(signal, handler);
    return [signal, handler];
  });
  let result;
  try {
    // guard: killed outright, this runner cannot stop the worker itself — its
    // watchdog does, and records the run as stopped from outside.
    result = await runBounded({ file: executable, args: run.args, cwd: run.cwd, stdio: streams.stdio,
      timeoutMs: run.timeout_seconds * 1000, onStart: started => { child = started; }, guard: { dir } });
  } finally {
    streams.close();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }

  let processCode = result.status;
  if (result.timed_out) processCode = TIMEOUT_EXIT;
  else if (stoppedBy) processCode = 128 + (constants.signals[stoppedBy] ?? 15);
  else if (processCode === null) processCode = result.error ? 127 : 128 + (constants.signals[result.signal] ?? 9);

  let extractionCode = null;
  if (run.extract) {
    const extraction = spawnSync(process.execPath, [resolve(ENGINES_DIR, run.extract), run.raw_file, run.report_file],
      { encoding: 'utf8', windowsHide: true });
    extractionCode = Number.isInteger(extraction.status) ? extraction.status : 1;
    if (extraction.stderr?.trim()) process.stderr.write(extraction.stderr);
  }
  if (result.timed_out) {
    note(run.report_file, `The worker ran past its ${run.timeout_seconds}s limit (workerTimeoutSeconds) and was stopped, `
      + 'with every process it started. Its partial output is in the raw transcript, if the engine keeps one.');
  } else if (result.error) {
    note(run.report_file, `The worker could not be started: ${result.error}`);
  }
  return recordFinish(dir, { processCode, extractionCode, timedOut: result.timed_out, signal: stoppedBy });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'run-worker.mjs')) {
  const dir = process.argv[2];
  try {
    if (!dir) throw new Error('Usage: node run-worker.mjs <dispatchDir>');
    const code = await runWorker(resolve(dir));
    const { report_file } = readJson(resolve(dir, 'run.json'));
    if (existsSync(report_file)) process.stdout.write(readFileSync(report_file, 'utf8'));
    process.exitCode = code;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
