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
// polls; when the child ends it exits, and when the parent ends first it kills the
// child's tree and, for a dispatch, records that the run was stopped from outside.
//
// Usage: node watchdog.mjs <parentPid> <childPid> [<dispatchDir>]
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { killTree } from './process-tree.mjs';
import { recordFinish } from './record-outcome.mjs';

export const POLL_MS = 1000;

export const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

const [, , parentArg, childArg, dir] = process.argv;
const parent = Number.parseInt(parentArg, 10);
const child = Number.parseInt(childArg, 10);

// A dispatch whose runner died never recorded how it ended; without this it would
// read as `running` forever. The runner writes finished_at before it exits, so a
// normal end is never overwritten.
function recordStopped() {
  const outcome = dir ? resolve(dir, 'outcome.json') : null;
  if (!outcome || !existsSync(outcome)) return;
  let record = null;
  try { record = JSON.parse(readFileSync(outcome, 'utf8')); } catch { return; }
  if (record && !record.finished_at) recordFinish(dir, { processCode: 137, runnerStopped: true });
}

if (Number.isInteger(parent) && Number.isInteger(child)) {
  const timer = setInterval(() => {
    // The parent first: on Windows a non-detached child is in the parent's job
    // object and dies with it, so "child gone" does not mean "ended normally".
    if (alive(parent)) {
      if (!alive(child)) clearInterval(timer);   // it ended; the parent records that
      return;
    }
    clearInterval(timer);
    if (!alive(child)) { recordStopped(); return; }
    // On POSIX the child leads its own group, so the group goes; on Windows
    // taskkill /T takes the tree by parent id.
    killTree(child, { signal: 'SIGTERM' });
    setTimeout(() => { killTree(child); recordStopped(); }, 2000);
  }, POLL_MS);
}
