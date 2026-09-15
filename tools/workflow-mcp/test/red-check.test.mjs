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
import { buildRunnableCommand } from '../dispatch.mjs';
import { ENGINES } from '../engines/index.mjs';
import { makeTools } from '../tools.mjs';
import { restoreRedCheck, revertForRedCheck, runRedCheck } from '../red-check.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const TEST_COMMAND = 'node test/slug.check.mjs';
const STUB = 'export const slug = text => text;\n';
const IMPLEMENTED = 'export const slug = text => text.toLowerCase();\n';
const REAL_TEST = "import { slug } from '../src/slug.mjs';\nif (slug('AB') !== 'ab') { console.error('AssertionError: expected ab'); process.exit(1); }\n";
const TAUTOLOGY = "import { slug } from '../src/slug.mjs';\nif (typeof slug !== 'function') process.exit(1);\n";

const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

function repo(fn) {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG), 'src/slug.mjs': STUB });
  git(root, 'init', '-b', 'main', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');
  const globalDir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-global-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(globalDir, 'gitconfig');
  try { return fn(root, makeTools(root, 'codex')); } finally {
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
  const wrapped = buildRunnableCommand({ workspace: wt.workspace, command: { executable: 'sh', args: ['-c', 'echo "B1 red: AssertionError"'] },
    stdin_file: built.stdin_file, report_file: built.report_file, raw_file: resolve(built.report_file, '..', 'raw.txt'),
    adapter: ENGINES.claude });
  assert.equal(spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' }).status, 0);
  return { wt, built, dir: dirname(built.report_file) };
}

test('a developer dispatch that declares test paths is not accepted until Red is proven', () => {
  repo((root, tools) => {
    const { built, dir } = developer(tools, 'b1', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': REAL_TEST });
    assert.match(built.red_check_command, /red-check\.mjs/);
    const before = tools.inspect_dispatch({ task_id: 'b1' });
    assert.equal(before.red.state, 'not_run');
    assert.equal(before.verdict.mechanical, 'incomplete');
    assert.match(before.verdict.reasons.join(' '), /Red has not been proven/);
    assert.throws(() => tools.record_decision({ task_id: 'b1', decision: 'accepted', reason: 'report quotes the assertion' }),
      /incomplete/);

    const result = runRedCheck(dir);
    assert.equal(result.proven, true);
    assert.deepEqual(result.reverted_paths, ['src/slug.mjs']);
    const after = tools.inspect_dispatch({ task_id: 'b1' });
    assert.equal(after.red.state, 'proven');
    assert.match(after.red.output_tail, /AssertionError/);
    assert.equal(after.verdict.mechanical, 'pass', after.verdict.reasons.join('; '));
  });
});

test('the worker\'s files are exactly as they were after the check, new files included', () => {
  repo((root, tools) => {
    const files = { 'src/slug.mjs': IMPLEMENTED, 'src/extra.mjs': 'export const x = 1;\n', 'test/slug.check.mjs': REAL_TEST };
    const { wt, dir } = developer(tools, 'restore', files);
    runRedCheck(dir);
    for (const [path, body] of Object.entries(files)) assert.equal(readFileSync(resolve(wt.workspace, path), 'utf8'), body, path);
    assert.equal(git(wt.workspace, 'status', '--porcelain').stdout.split('\n').filter(Boolean).length, 3);
  });
});

test('tests that pass against the unchanged code refute Red, and the dispatch is rejected', () => {
  repo((root, tools) => {
    const { dir } = developer(tools, 'taut', { 'src/slug.mjs': IMPLEMENTED, 'test/slug.check.mjs': TAUTOLOGY });
    assert.equal(runRedCheck(dir).proven, false);
    const inspected = tools.inspect_dispatch({ task_id: 'taut' });
    assert.equal(inspected.red.state, 'refuted');
    assert.equal(inspected.verdict.mechanical, 'reject');
    assert.match(inspected.verdict.reasons.join(' '), /pass with the implementation reverted/);
    assert.equal(tools.dispatch_stats().by_engine_role[0].red_refuted, 1);
  });
});

test('an interrupted check is reported, and restoring puts the worker\'s files back', () => {
  repo((root, tools) => {
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

test('test paths must sit inside owned paths, need a test command, and only apply to a write role', () => {
  repo((root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'v' });
    const base = { role: 'developer', instructions: 'x', workspace: wt.workspace, task_id: 'v', cli_engine: 'claude', owned_paths: ['src'] };
    assert.throws(() => tools.build_worker_prompt({ ...base, test_paths: ['test'], test_command: TEST_COMMAND }), /inside owned_paths/);
    assert.throws(() => tools.build_worker_prompt({ ...base, test_paths: ['src/x.test.mjs'] }), /test_command/);
    assert.throws(() => tools.build_worker_prompt({ ...base, role: 'adversary', owned_paths: undefined,
      test_paths: ['src'], test_command: TEST_COMMAND }), /read-only/);
  });
});

test('the prompt tells the developer its test paths and that Red is re-proven', () => {
  repo((root, tools) => {
    const { built } = developer(tools, 'prompt', {});
    const prompt = readFileSync(built.prompt_file, 'utf8');
    assert.match(prompt, /"test_paths": \[\s*"test"\s*\]/);
    assert.match(prompt, /reverts every other file you changed/);
  });
});
