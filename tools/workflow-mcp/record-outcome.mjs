#!/usr/bin/env node
// Records how a dispatch actually ran, beside its prompt, on every engine:
// `start` before the engine process launches and `finish` after it (and after
// report extraction, where there is one) exits. run-worker.mjs calls both;
// inspect.mjs reads the result.
//
// Without it a finished worker left nothing the MCP could read back: whether it
// ran, how long it took and what it exited with lived only in the conductor's
// terminal, and an interrupted cycle had to be reconstructed from conversation
// tails (resume-report 2026-09-10, §5). Prints nothing: stdout belongs to the
// report the runner prints afterwards.
//
// Usage: node record-outcome.mjs start <dispatchDir>
//        node record-outcome.mjs finish <dispatchDir> <processExitCode> [extractionExitCode]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outcomeFile = dir => resolve(dir, 'outcome.json');

export function recordStart(dir) {
  writeFileSync(outcomeFile(dir), JSON.stringify({ started_at: new Date().toISOString() }, null, 2) + '\n');
}

// `timed_out`, `signal` and `runner_stopped` say why a process has an exit code
// it did not choose: the runner stopped it at the time limit, a signal reached the
// runner, or the runner was killed outright and its watchdog stopped the worker.
export function recordFinish(dir, { processCode, extractionCode = null, timedOut = false, signal = null,
  runnerStopped = false }) {
  const file = outcomeFile(dir);
  let outcome = {};
  try { if (existsSync(file)) outcome = JSON.parse(readFileSync(file, 'utf8')); } catch { /* rewrite below */ }
  const now = new Date();
  // A failed process wins, otherwise a failed extraction does.
  const exit_code = processCode !== 0 ? processCode : (extractionCode ?? 0);
  const started = outcome.started_at ? Date.parse(outcome.started_at) : NaN;
  writeFileSync(file, JSON.stringify({
    ...outcome,
    finished_at: now.toISOString(),
    duration_ms: Number.isFinite(started) ? now.getTime() - started : null,
    process_exit_code: processCode, extraction_exit_code: extractionCode, exit_code,
    ...(timedOut ? { timed_out: true } : {}),
    ...(signal ? { signal } : {}),
    ...(runnerStopped ? { runner_stopped: true } : {})
  }, null, 2) + '\n');
  return exit_code;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'record-outcome.mjs')) {
  const [, , phase, dir, processCode, extractionCode] = process.argv;
  if (!['start', 'finish'].includes(phase) || !dir) {
    throw new Error('Usage: record-outcome.mjs start <dir> | finish <dir> <exitCode> [extractionExitCode]');
  }
  if (phase === 'start') recordStart(dir);
  else {
    recordFinish(dir, { processCode: Number.parseInt(processCode, 10),
      extractionCode: extractionCode === undefined ? null : Number.parseInt(extractionCode, 10) });
  }
}
