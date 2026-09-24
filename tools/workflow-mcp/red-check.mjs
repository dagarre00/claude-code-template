#!/usr/bin/env node
// Proves a developer case after the fact, for a dispatch that declared its test
// paths, in three runs:
//
//   green         the dispatch's test command, with the worker's files in place,
//                 must pass;
//   architecture  the project's architecture check, if one is configured, must
//                 pass with them in place;
//   red           every non-test file the worker changed is put back to the base
//                 commit (a file the worker created is set aside), the test
//                 command must now FAIL, and everything is restored byte for byte.
//
// Red alone used to be the whole check, and "the command exited non-zero" is not
// Red: a test runner that does not exist, a command the shell cannot parse, or a
// test that fails whatever the code does all exit non-zero too — measured, a
// missing runner was reported "Red proven" and the dispatch passed inspection.
// Requiring the same command to pass first, with the implementation, makes the
// failure attributable to the reverted change. It also takes Green and the
// architecture check out of the conductor's unbounded shell and into one record
// with bounded output.
//
// Run by the conductor — the MCP server itself never runs a process. It runs in the worker's own worktree because that is where the
// environment (dependencies, a virtualenv) was already built.
//
// Usage: node red-check.mjs <dispatchDir>            run the check
//        node red-check.mjs <dispatchDir> --restore  put files back after an interrupted run
//
// Exit: 0 proven, 1 not proven (a phase failed or timed out), 2 the check itself failed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runBounded } from './process-tree.mjs';

// Per phase. What the conductor must read is the tail of the run that decided
// the verdict — an assertion, or the not-yet-written symbol — never a whole suite.
export const OUTPUT_TAIL_BYTES = 2500;

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const under = (path, bases) => bases.some(base => path === base || path.startsWith(`${base}/`));

function gitIn(cwd, args, { buffer = false } = {}) {
  const result = spawnSync('git', ['-C', cwd, '-c', 'core.quotepath=false', ...args],
    { encoding: buffer ? 'buffer' : 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${String(result.stderr ?? result.error?.message ?? '').trim()}`);
  }
  return result.stdout;
}

const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);
const paths = dir => ({ manifest: resolve(dir, 'red', 'manifest.json'), files: resolve(dir, 'red', 'files'),
  result: resolve(dir, 'red.json') });

function dispatchFor(dir) {
  const record = readJson(resolve(dir, 'dispatch.json'));
  if (!record.test_paths?.length || !record.test_command) {
    throw new Error('This dispatch declared no test_paths/test_command, so there is no Red to prove.');
  }
  if (!record.workspace || !existsSync(record.workspace)) throw new Error(`Workspace is gone: ${record.workspace}`);
  if (!record.base_sha) throw new Error('The dispatch record has no base_sha to revert to.');
  return record;
}

// Every path that differs from the base — committed, modified, or untracked —
// outside the declared test paths.
function implementationPaths(record) {
  const changed = new Set([
    ...lines(gitIn(record.workspace, ['diff', '--name-only', '--no-renames', record.base_sha])),
    ...lines(gitIn(record.workspace, ['ls-files', '--others', '--exclude-standard']))
  ]);
  return [...changed].filter(path => !under(path, record.test_paths)).sort();
}

// Back everything up and write the manifest BEFORE touching a file, so an
// interrupted check can always be undone with --restore.
export function revertForRedCheck(dir) {
  const record = dispatchFor(dir);
  const where = paths(dir);
  if (existsSync(where.manifest)) {
    throw new Error(`A previous red check did not finish. Run: node red-check.mjs ${dir} --restore`);
  }
  rmSync(where.result, { force: true });
  mkdirSync(where.files, { recursive: true });
  const entries = implementationPaths(record).map((path, index) => {
    const full = resolve(record.workspace, path);
    const now = existsSync(full) ? readFileSync(full) : null;
    if (now) writeFileSync(resolve(where.files, String(index)), now);
    let base = null;
    try { base = gitIn(record.workspace, ['show', `${record.base_sha}:${path}`], { buffer: true }); } catch { /* new since base */ }
    return { path, backup: now ? String(index) : null, sha256: now ? hash(now) : null, existed_at_base: base !== null };
  });
  writeFileSync(where.manifest, JSON.stringify({ created_at: new Date().toISOString(), entries }, null, 2) + '\n');
  for (const entry of entries) {
    const full = resolve(record.workspace, entry.path);
    if (entry.existed_at_base) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, gitIn(record.workspace, ['show', `${record.base_sha}:${entry.path}`], { buffer: true }));
    } else if (existsSync(full)) {
      unlinkSync(full);
    }
  }
  return { record, entries };
}

export function restoreRedCheck(dir) {
  const record = readJson(resolve(dir, 'dispatch.json'));
  const where = paths(dir);
  if (!existsSync(where.manifest)) return { restored: 0 };
  const { entries } = readJson(where.manifest);
  const mismatched = [];
  for (const entry of entries) {
    const full = resolve(record.workspace, entry.path);
    if (entry.backup) {
      const saved = readFileSync(resolve(where.files, entry.backup));
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, saved);
      if (hash(readFileSync(full)) !== entry.sha256) mismatched.push(entry.path);
    } else if (existsSync(full)) {
      unlinkSync(full);
    }
  }
  if (mismatched.length) {
    throw new Error(`Restored files do not match their backups: ${mismatched.join(', ')}. Backups are in ${where.files}.`);
  }
  rmSync(resolve(dir, 'red'), { recursive: true, force: true });
  return { restored: entries.length };
}

const tailOf = text => {
  const buffer = Buffer.from(text, 'utf8');
  return buffer.length > OUTPUT_TAIL_BYTES ? buffer.subarray(buffer.length - OUTPUT_TAIL_BYTES).toString('utf8') : text;
};

// The shell a command line runs under, recorded because a line that works in the
// conductor's bash can fail in cmd.exe — which the green phase now catches.
export const SHELL = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh';

// One run of a project command in the worktree. `passed` and `failed` are both
// false when the command could not be judged: a timeout, a spawn error, or a
// death by signal — none of which says anything about the code. A timeout stops
// the whole process tree (process-tree.mjs), so no test run outlives the check.
async function runPhase(command, cwd, timeoutSeconds) {
  // NODE_TEST_CONTEXT is set when the caller itself runs under `node --test`, and
  // it makes a child `node --test` stream results to that parent instead of
  // printing them — the output tail would then hold no assertion to read.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const started = Date.now();
  const run = await runBounded({ command, cwd, env, timeoutMs: timeoutSeconds * 1000, tailBytes: OUTPUT_TAIL_BYTES * 2,
    guard: true });
  const judged = !run.error && !run.timed_out && run.status !== null;
  return {
    command,
    exit_code: run.status,
    signal: run.signal,
    timed_out: run.timed_out,
    error: run.error,
    passed: judged && run.status === 0,
    failed: judged && run.status !== 0,
    duration_ms: Date.now() - started,
    output_tail: tailOf(run.output)
  };
}

// Which phase decided the verdict, and what it decided.
function stateOf({ green, architecture, red }) {
  const unjudged = phase => phase && !phase.passed && !phase.failed;
  for (const phase of [green, architecture, red]) {
    if (unjudged(phase)) return phase.timed_out ? 'timed_out' : 'error';
  }
  if (green.failed) return 'green_failed';
  if (architecture?.failed) return 'architecture_failed';
  return red.failed ? 'proven' : 'refuted';
}

export async function runRedCheck(dir, { timeoutSeconds } = {}) {
  const record = dispatchFor(dir);
  // Per phase: the project's workerTimeoutSeconds, as recorded when the dispatch
  // was composed — the same limit its worker had.
  timeoutSeconds ??= record.timeout_seconds ?? 1800;
  if (existsSync(paths(dir).manifest)) {
    throw new Error(`A previous red check did not finish. Run: node red-check.mjs ${dir} --restore`);
  }
  rmSync(paths(dir).result, { force: true });
  const phases = { green: await runPhase(record.test_command, record.workspace, timeoutSeconds) };
  if (phases.green.passed && record.architecture_command) {
    phases.architecture = await runPhase(record.architecture_command, record.workspace, timeoutSeconds);
  }
  let reverted = [];
  // Red is only worth running once the implementation has been shown to pass:
  // otherwise its failure says nothing about the change.
  if (phases.green.passed && (!phases.architecture || phases.architecture.passed)) {
    const { entries } = revertForRedCheck(dir);
    reverted = entries.map(entry => entry.path);
    try { phases.red = await runPhase(record.test_command, record.workspace, timeoutSeconds); }
    finally { restoreRedCheck(dir); }
  }
  const state = stateOf(phases);
  const result = {
    checked_at: new Date().toISOString(),
    state,
    proven: state === 'proven',
    test_command: record.test_command,
    architecture_command: record.architecture_command ?? null,
    test_paths: record.test_paths,
    reverted_paths: reverted,
    shell: SHELL,
    phases
  };
  writeFileSync(paths(dir).result, JSON.stringify(result, null, 2) + '\n');
  return result;
}

// The phase whose output the conductor has to read: the one that failed, or —
// once everything passed — the red run, whose failure must be the missing
// behavior and not a broken setup.
export const decidingPhase = result => {
  const { green, architecture, red } = result.phases ?? {};
  if (!green?.passed) return ['green', green];
  if (architecture && !architecture.passed) return ['architecture', architecture];
  return ['red', red];
};

const describe = (name, phase) => !phase ? `${name}: not run`
  : `${name}: \`${phase.command}\` ${phase.timed_out ? 'timed out' : phase.error ? `could not run (${phase.error})`
    : phase.exit_code === null ? `was killed (${phase.signal})` : `exited ${phase.exit_code}`}`;

const HEADLINE = {
  proven: 'PROVEN — the tests pass with the implementation and fail without it.',
  refuted: 'REFUTED — the tests pass with the implementation reverted: they do not test the change.',
  green_failed: 'NOT GREEN — the tests fail with the implementation in place.',
  architecture_failed: 'ARCHITECTURE — the architecture check fails with the implementation in place.',
  timed_out: 'TIMED OUT — a phase ran past the limit, so nothing is proven.',
  error: 'COULD NOT RUN — a phase failed to start or was killed, so nothing is proven.'
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'red-check.mjs')) {
  const [, , dir, flag] = process.argv;
  try {
    if (!dir) throw new Error('Usage: node red-check.mjs <dispatchDir> [--restore]');
    if (flag === '--restore') {
      console.log(`Restored ${restoreRedCheck(resolve(dir)).restored} file(s).`);
    } else {
      const result = await runRedCheck(resolve(dir));
      console.log(`Case check: ${HEADLINE[result.state]}`);
      console.log(`- ${describe('green', result.phases.green)}`);
      if (result.architecture_command) console.log(`- ${describe('architecture', result.phases.architecture)}`);
      console.log(`- ${describe('red', result.phases.red)}${result.phases.red
        ? ` with ${result.reverted_paths.length} implementation file(s) reverted` : ''}`);
      const [name, phase] = decidingPhase(result);
      if (phase?.output_tail?.trim()) {
        console.log(result.state === 'proven'
          ? `Confirm the ${name} output shows the missing behavior (an assertion, or the not-yet-written symbol), not a broken setup:`
          : `Output of the ${name} run:`);
        console.log(phase.output_tail.trimEnd());
      }
      process.exitCode = result.proven ? 0 : result.state === 'error' ? 2 : 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
