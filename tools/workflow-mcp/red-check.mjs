#!/usr/bin/env node
// Proves Red after the fact, for a developer dispatch that declared its test
// paths. Every non-test file the worker changed is put back to the base commit
// (a file the worker created is set aside), the dispatch's test command runs,
// and everything is restored byte for byte. Tests that still pass never tested
// the change — rule "tests must fail for the right reason", computed instead of
// reported.
//
// Run by the conductor, like record-outcome.mjs — the MCP server itself never
// runs a process. It runs in the worker's own worktree because that is where the
// environment (dependencies, a virtualenv) was already built.
//
// Usage: node red-check.mjs <dispatchDir>            run the check
//        node red-check.mjs <dispatchDir> --restore  put files back after an interrupted run
//
// Exit: 0 Red proven (tests failed), 1 refuted (tests passed), 2 the check itself failed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUTPUT_TAIL_BYTES = 4096;

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

export function runRedCheck(dir, { timeoutSeconds = 1800 } = {}) {
  const { record, entries } = revertForRedCheck(dir);
  let run;
  // NODE_TEST_CONTEXT is set when the caller itself runs under `node --test`, and
  // it makes a child `node --test` stream results to that parent instead of
  // printing them — the output tail would then hold no assertion to read.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  try {
    run = spawnSync(record.test_command, { cwd: record.workspace, shell: true, encoding: 'utf8', env,
      windowsHide: true, timeout: timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    restoreRedCheck(dir);
  }
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const tail = Buffer.from(output, 'utf8');
  const result = {
    checked_at: new Date().toISOString(),
    test_command: record.test_command,
    test_paths: record.test_paths,
    reverted_paths: entries.map(entry => entry.path),
    exit_code: run.status,
    timed_out: run.error?.code === 'ETIMEDOUT',
    proven: run.status !== 0 && run.error?.code !== 'ETIMEDOUT',
    output_tail: tail.length > OUTPUT_TAIL_BYTES ? tail.subarray(tail.length - OUTPUT_TAIL_BYTES).toString('utf8') : output
  };
  writeFileSync(paths(dir).result, JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'red-check.mjs')) {
  const [, , dir, flag] = process.argv;
  try {
    if (!dir) throw new Error('Usage: node red-check.mjs <dispatchDir> [--restore]');
    if (flag === '--restore') {
      console.log(`Restored ${restoreRedCheck(resolve(dir)).restored} file(s).`);
    } else {
      const result = runRedCheck(resolve(dir));
      console.log(result.proven
        ? `Red proven: with ${result.reverted_paths.length} implementation file(s) reverted, \`${result.test_command}\` exited ${result.exit_code}.`
        : result.timed_out
          ? 'Red not proven: the test command timed out with the implementation reverted.'
          : `Red REFUTED: \`${result.test_command}\` passed with the implementation reverted — these tests do not test the change.`);
      console.log('Read the output tail and confirm the failure is the missing behavior, not a broken setup:');
      console.log(result.output_tail.trimEnd());
      process.exitCode = result.proven ? 0 : 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
