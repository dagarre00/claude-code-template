#!/usr/bin/env node
// Records how a dispatch actually ran, beside its prompt, on every engine. The
// command build_worker_prompt returns calls this twice: `start` before the
// engine process launches and `finish` after it (and after report extraction,
// where there is one) exits. inspect.mjs reads the result.
//
// Without it a finished worker left nothing the MCP could read back: whether it
// ran, how long it took and what it exited with lived only in the conductor's
// terminal, and an interrupted cycle had to be reconstructed from conversation
// tails (resume-report 2026-09-10, §5). Prints nothing: stdout belongs to the
// report the wrapper prints afterwards.
//
// Usage: node record-outcome.mjs start <dispatchDir>
//        node record-outcome.mjs finish <dispatchDir> <processExitCode> [extractionExitCode]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , phase, dir, processCode, extractionCode] = process.argv;
if (!['start', 'finish'].includes(phase) || !dir) {
  throw new Error('Usage: record-outcome.mjs start <dir> | finish <dir> <exitCode> [extractionExitCode]');
}
const file = resolve(dir, 'outcome.json');
const now = new Date();

if (phase === 'start') {
  writeFileSync(file, JSON.stringify({ started_at: now.toISOString() }, null, 2) + '\n');
} else {
  let outcome = {};
  try { if (existsSync(file)) outcome = JSON.parse(readFileSync(file, 'utf8')); } catch { /* rewrite below */ }
  const process_exit_code = Number.parseInt(processCode, 10);
  const extraction_exit_code = extractionCode === undefined ? null : Number.parseInt(extractionCode, 10);
  // The same rule the wrapper uses for its own exit status: a failed process
  // wins, otherwise a failed extraction does.
  const exit_code = process_exit_code !== 0 ? process_exit_code : (extraction_exit_code ?? 0);
  const started = outcome.started_at ? Date.parse(outcome.started_at) : NaN;
  writeFileSync(file, JSON.stringify({
    ...outcome,
    finished_at: now.toISOString(),
    duration_ms: Number.isFinite(started) ? now.getTime() - started : null,
    process_exit_code, extraction_exit_code, exit_code
  }, null, 2) + '\n');
}
