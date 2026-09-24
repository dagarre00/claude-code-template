// Red used to be whatever a developer's report said it was. The conductor could
// only re-run the suite afterwards, which proves Green and nothing about Red —
// measured: a resumed cycle accepted a "confirmed" Red that was a monkeypatch
// never reaching the code under test. The e2e proved Red properly by putting the
// base source back and running the worker's test; these pin that proof as a
// step of every developer dispatch that declares its test paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { makeTools } from '../tools.mjs';
import { restoreRedCheck, revertForRedCheck, runRedCheck } from '../red-check.mjs';
import { cleanup, fixture, runAs } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-pro', balanced: 'inherit', fast: 'gemini-3.8-flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const TEST_COMMAND = 'node test/slug.check.mjs';
const STUB = 'export const slug = text => text;\n';
const IMPLEMENTED = 'export const slug = text => text.toLowerCase();\n';
const REAL_TEST = "import { slug } from '../src/slug.mjs';\nif (slug('AB') !== 'ab') { console.error('AssertionError: expected ab'); process.exit(1); }\n";
const TAUTOLOGY = "import { slug } from '../src/slug.mjs';\nif (typeof slug !== 'function') process.exit(1);\n";

const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

async function repo(fn, configOverrides = {}, files = {}) {
  const root = fixture({ '.agents/config.json': JSON.stringify({ ...CONFIG, ...configOverrides }), 'src/slug.mjs': STUB, ...files });
  git(root, 'init', '-b', 'main', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');
  const globalDir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-global-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(globalDir, 'gitconfig');
  try { return await fn(root, makeTools(root, 'codex')); } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    cleanup(root);
    cleanup(globalDir);
  }
}

const put = (base, path, body) => {
  mkdirSync(dirname(resolve(base, path)), { recursive: true });
  writeFileSync(resolve(base, path), body);
};

// A developer dispatch that "wrote" the given files and finished cleanly.
function developer(tools, task_id, files, extra = {}) {
  const wt = tools.prepare_worktree({ task_id });
  const built = tools.build_worker_prompt({ role: 'developer', instructions: 'Implement B1.', workspace: wt.workspace,
    cli_engine: 'claude', task_id, owned_paths: ['src', 'test'], test_paths: ['test'], test_command: TEST_COMMAND, ...extra });
  for (const [path, body] of Object.entries(files)) put(wt.workspace, path, body);
  assert.equal(runAs(built, 'sh', ['-c', 'echo "B1 red: AssertionError"']).status, 0);
  return { wt, built, dir: dirname(built.report_file) };
}

test('a developer dispatch that declares test paths is not accepted until Red is proven', async () => {
  await repo(async (root, tools) => {
    const { built, dir } = developer(tools, 'b1', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': REAL_TEST });
    assert.match(built.red_check_command, /red-check\.mjs/);
    const before = tools.inspect_dispatch({ task_id: 'b1' });
    assert.equal(before.red.state, 'not_run');
    assert.equal(before.verdict.mechanical, 'incomplete');
    assert.match(before.verdict.reasons.join(' '), /Red has not been proven/);
    assert.throws(() => tools.record_decision({ task_id: 'b1', decision: 'accepted', reason: 'report quotes the assertion' }),
      /incomplete/);

    const result = await runRedCheck(dir);
    assert.equal(result.proven, true);
    assert.equal(result.state, 'proven');
    assert.deepEqual(result.reverted_paths, ['src/slug.mjs']);
    assert.equal(result.phases.green.exit_code, 0, 'green ran first, with the implementation in place');
    assert.match(result.phases.red.output_tail, /AssertionError/);
    const after = tools.inspect_dispatch({ task_id: 'b1' });
    assert.equal(after.red.state, 'proven');
    assert.deepEqual(after.red.exit_codes, { green: 0, red: 1 });
    assert.equal(after.red.output_tail, undefined, 'bounded: the tail is in red.json, not in every inspect');
    assert.equal(after.verdict.mechanical, 'pass', after.verdict.reasons.join('; '));
  });
});

// "Exited non-zero" is not Red. Measured before the green phase existed: a test
// command that could not even start was reported "Red proven" and passed
// inspection. Each of these now fails on green, before Red is attempted.
test('a test command that fails with the implementation in place is not Green, and is rejected', async () => {
  await repo(async (root, tools) => {
    const cases = {
      'no-runner': { test_command: 'no-such-test-runner --run' },
      'always-fails': { files: { 'test/slug.check.mjs': 'process.exit(1);\n' } }
    };
    for (const [task_id, { test_command, files = {} }] of Object.entries(cases)) {
      const { dir } = developer(tools, task_id, { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': REAL_TEST, ...files },
        test_command ? { test_command } : {});
      const result = await runRedCheck(dir);
      assert.equal(result.state, 'green_failed', task_id);
      assert.equal(result.proven, false);
      assert.equal(result.phases.red, undefined, `${task_id}: red is pointless once green fails`);
      const { verdict } = tools.inspect_dispatch({ task_id });
      assert.equal(verdict.mechanical, 'reject', task_id);
      assert.match(verdict.reasons.join(' '), /not Green/);
    }
    assert.equal(tools.dispatch_stats().by_engine_role[0].green_failed, 2);
  });
});

test('a failing architecture check rejects the case before Red is attempted', async () => {
  await repo(async (root, tools) => {
    const { dir } = developer(tools, 'layers', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': REAL_TEST });
    const record = JSON.parse(readFileSync(resolve(dir, 'dispatch.json'), 'utf8'));
    assert.equal(record.architecture_command, 'node arch.check.mjs', 'the configured check is recorded at compose time');
    const result = await runRedCheck(dir);
    assert.equal(result.state, 'architecture_failed');
    assert.match(result.phases.architecture.output_tail, /domain imports adapters/);
    assert.equal(result.phases.red, undefined);
    const { verdict } = tools.inspect_dispatch({ task_id: 'layers' });
    assert.equal(verdict.mechanical, 'reject');
    assert.match(verdict.reasons.join(' '), /architecture check fails/);
  }, { architecture: { command: 'node arch.check.mjs', rules: [] } },
  { 'arch.check.mjs': "console.error('violation: domain imports adapters'); process.exit(1);\n" });
});

test('a phase that runs past the limit proves nothing and leaves the dispatch incomplete', async () => {
  await repo(async (root, tools) => {
    const { dir } = developer(tools, 'slow', { 'src/slug.mjs': IMPLEMENTED,
      'test/slug.check.mjs': 'setTimeout(() => {}, 20000);\n' });
    const result = await runRedCheck(dir, { timeoutSeconds: 1 });
    assert.equal(result.state, 'timed_out');
    assert.equal(result.phases.green.timed_out, true);
    const { verdict } = tools.inspect_dispatch({ task_id: 'slow' });
    assert.equal(verdict.mechanical, 'incomplete');
    assert.match(verdict.reasons.join(' '), /timed out/);
  });
});

test('the worker\'s files are exactly as they were after the check, new files included', async () => {
  await repo(async (root, tools) => {
    const files = { 'src/slug.mjs': IMPLEMENTED, 'src/extra.mjs': 'export const x = 1;\n', 'test/slug.check.mjs': REAL_TEST };
    const { wt, dir } = developer(tools, 'restore', files);
    await runRedCheck(dir);
    for (const [path, body] of Object.entries(files)) assert.equal(readFileSync(resolve(wt.workspace, path), 'utf8'), body, path);
    assert.equal(git(wt.workspace, 'status', '--porcelain').stdout.split('\n').filter(Boolean).length, 3);
  });
});

test('tests that pass against the unchanged code refute Red, and the dispatch is rejected', async () => {
  await repo(async (root, tools) => {
    const { dir } = developer(tools, 'taut', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': TAUTOLOGY });
    const result = await runRedCheck(dir);
    assert.equal(result.proven, false);
    assert.equal(result.state, 'refuted');
    const inspected = tools.inspect_dispatch({ task_id: 'taut' });
    assert.equal(inspected.red.state, 'refuted');
    assert.equal(inspected.verdict.mechanical, 'reject');
    assert.match(inspected.verdict.reasons.join(' '), /pass with the implementation reverted/);
    assert.equal(tools.dispatch_stats().by_engine_role[0].red_refuted, 1);
  });
});

test('an interrupted check is reported, and restoring puts the worker\'s files back', async () => {
  await repo(async (root, tools) => {
    const { wt, dir } = developer(tools, 'cut', { 'src/slug.mjs': IMPLEMENTED, 'src/new.mjs': 'export {};\n', 'test/slug.check.mjs': REAL_TEST });
    revertForRedCheck(dir);                 // the process dies here, before running or restoring
    assert.equal(readFileSync(resolve(wt.workspace, 'src/slug.mjs'), 'utf8'), STUB);
    assert.equal(existsSync(resolve(wt.workspace, 'src/new.mjs')), false);
    const interrupted = tools.inspect_dispatch({ task_id: 'cut' });
    assert.equal(interrupted.red.state, 'interrupted');
    assert.match(interrupted.verdict.reasons.join(' '), /--restore/);
    restoreRedCheck(dir);
    assert.equal(readFileSync(resolve(wt.workspace, 'src/slug.mjs'), 'utf8'), IMPLEMENTED);
    assert.equal(readFileSync(resolve(wt.workspace, 'src/new.mjs'), 'utf8'), 'export {};\n');
    assert.equal(tools.inspect_dispatch({ task_id: 'cut' }).red.state, 'not_run');
  });
});

test('test paths must sit inside owned paths, need a test command, and only apply to a write role', async () => {
  await repo(async (root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'v' });
    const base = { role: 'developer', instructions: 'x', workspace: wt.workspace, task_id: 'v', cli_engine: 'claude', owned_paths: ['src'] };
    assert.throws(() => tools.build_worker_prompt({ ...base, test_paths: ['test'], test_command: TEST_COMMAND }), /inside owned_paths/);
    assert.throws(() => tools.build_worker_prompt({ ...base, test_paths: ['src/x.test.mjs'] }), /test_command/);
    assert.throws(() => tools.build_worker_prompt({ ...base, role: 'adversary', owned_paths: undefined,
      test_paths: ['src'], test_command: TEST_COMMAND }), /read-only/);
  });
});

test('the prompt tells the developer its test paths and that Red is re-proven', async () => {
  await repo(async (root, tools) => {
    const { built } = developer(tools, 'prompt', {});
    const prompt = readFileSync(built.prompt_file, 'utf8');
    assert.match(prompt, /"test_paths": \[\s*"test"\s*\]/);
    assert.match(prompt, /reverts every other file you changed/);
  });
});

// Two cases of one cycle in one reused worktree: each dispatch is judged against
// its own base, so the second case's Red reverts only what the second case did.
test('a case dispatched into a reused worktree is proven against its own base', async () => {
  await repo(async (root, tools) => {
    const first = developer(tools, 'case-1', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': REAL_TEST });
    assert.equal((await runRedCheck(first.dir)).state, 'proven');
    tools.record_decision({ task_id: 'case-1', decision: 'accepted', reason: 'Proven green, red and scoped.' });
    git(first.wt.workspace, 'add', 'src', 'test');
    git(first.wt.workspace, 'commit', '-qm', 'feat(slug): B1');
    git(root, 'merge', '-q', '--no-edit', 'worker/case-1');

    const wt = tools.prepare_worktree({ task_id: 'case-2', reuse: 'case-1' });
    assert.equal(wt.workspace, first.wt.workspace);
    const built = tools.build_worker_prompt({ role: 'developer', instructions: 'Implement B2.', workspace: wt.workspace,
      cli_engine: 'claude', task_id: 'case-2', owned_paths: ['src', 'test'], test_paths: ['test'], test_command: TEST_COMMAND });
    put(wt.workspace, 'src/trim.mjs', 'export const trim = text => text.trim();\n');
    put(wt.workspace, 'test/slug.check.mjs', `${REAL_TEST}import { trim } from '../src/trim.mjs';\nif (trim(' a ') !== 'a') process.exit(1);\n`);
    assert.equal(runAs(built, 'sh', ['-c', 'echo "B2 red: missing trim"']).status, 0);
    const result = await runRedCheck(dirname(built.report_file));
    assert.equal(result.state, 'proven');
    assert.deepEqual(result.reverted_paths, ['src/trim.mjs'], 'B1 is in the base now, so only B2 is reverted');
    assert.equal(tools.inspect_dispatch({ task_id: 'case-2' }).verdict.mechanical, 'pass');
  });
});
