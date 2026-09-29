#!/usr/bin/env node
// Kills a process tree when the process that started it dies first.
//
// runBounded's time limit only works while its own process lives. Stopped from
// outside — a shell tool that gives up on a long command, a task stop,
// TerminateProcess, SIGKILL — it gets no chance to clean up, and what it started
// keeps running: measured, stopping a backgrounded shell on Windows left its grep
// burning CPU for an hour and a half. A worker is worse: it is its own process
// group on POSIX precisely so a timeout can take its whole tree, which also means
// nothing takes it down with the runner.
//
// So runBounded starts this beside every guarded child, detached from both. It
// polls; when the child ends it exits — for a dispatch, once the runner has also
// recorded the finish — and when the parent ends first it kills the child's tree
// and, for a dispatch, records that the run was stopped from outside.
//
// Usage: node watchdog.mjs <parentPid> <childPid> [<dispatchDir> <startedAt>]
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { killTree } from './process-tree.mjs';
import { recordFinish } from './record-outcome.mjs';

export const POLL_MS = 1000;

export const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

const [, , parentArg, childArg, dir, startedAt] = process.argv;
const parent = Number.parseInt(parentArg, 10);
const child = Number.parseInt(childArg, 10);
const windows = process.platform === 'win32';

// Where this attempt stands, from the dispatch's record: `running`, `exited`
// (the worker is done and the runner is still extracting its report),
// `finished`, `unreadable` while the file is being rewritten, or `gone`. A retry
// archives the record and writes its own start into the same file, so a record
// with another start, or none, is another attempt's — and the first attempt's
// watchdog used to stamp runner_stopped onto its retry. Null without a dispatch.
const attempt = () => {
  if (!dir) return null;
  const path = resolve(dir, 'outcome.json');
  if (!existsSync(path)) return 'gone';
  let record;
  try { record = JSON.parse(readFileSync(path, 'utf8')); } catch { return 'unreadable'; }
  if (record?.started_at !== startedAt) return 'gone';
  return record.finished_at ? 'finished' : record.worker_exited_at ? 'exited' : 'running';
};

// Whether the child's tree is still there to stop. On POSIX the child leads its
// own process group, and the group is what is guarded: a leader can exit while
// what it started runs on (adversary R5-F1 on PR #40), and a group id is not
// reused while any member remains. Windows has only the child's own pid —
// taskkill /T finds a tree through its live parent — and that pid is free for
// reuse the moment the child exits. So there the pid counts only while the
// record does not say the child is done: a finished dispatch's watchdog used to
// stop whatever held the pid next, such as another test file's node process.
const running = phase => (windows
  ? [null, 'running', 'unreadable'].includes(phase) && alive(child)
  : alive(-child));

// A dispatch whose runner died never recorded how it ended; without this it would
// read as `running` forever. Only this attempt's record, and only an unfinished one.
function recordStopped() {
  if (['running', 'exited'].includes(attempt())) recordFinish(dir, { processCode: 137, runnerStopped: true });
}

// The worker's exit is not the end of a dispatch: the runner still extracts the
// report and only then records the finish, and a runner killed in between must
// still be recorded as stopped. So a dispatch is watched until its finish is on
// disk, or until a retry has taken the directory over.
const unrecorded = phase => ['running', 'exited', 'unreadable'].includes(phase);

if (Number.isInteger(parent) && Number.isInteger(child)) {
  const timer = setInterval(() => {
    const phase = attempt();
    // The parent first: on Windows a non-detached child is in the parent's job
    // object and dies with it, so "child gone" does not mean "ended normally".
    if (alive(parent)) {
      if (!running(phase) && !unrecorded(phase)) clearInterval(timer);   // it ended, and the parent recorded that
      return;
    }
    clearInterval(timer);
    if (!running(phase)) { recordStopped(); return; }
    // On POSIX the child leads its own group, so the group goes; on Windows
    // taskkill /T /F takes the tree by parent id, at once, and a second call
    // could only reach whatever holds the pid next.
    killTree(child, { signal: 'SIGTERM' });
    setTimeout(() => {
      if (!windows && alive(-child)) killTree(child);
      recordStopped();
    }, 2000);
  }, POLL_MS);
}
