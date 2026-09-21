// A developer is judged by the architecture check and its rules. If the same
// worker can edit those rules, the check measures nothing: the cheapest way to
// green a layering violation is to allow it. Protected paths are the files no
// worker may change, and the architecture block is how a project declares its
// check so it reaches every worker's allowlist and every conductor's `check`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../config.mjs';
import { buildRunnableCommand } from '../dispatch.mjs';
import { ENGINES } from '../engines/index.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

const engines = {
  claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
  codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
  antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-pro', balanced: 'inherit', fast: 'gemini-3.8-flash' },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
};
const base = { version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'], roles: {}, engines };

const withConfig = (config, fn) => {
  const root = fixture({ '.agents/config.json': JSON.stringify(config) });
  try { return fn(root); } finally { cleanup(root); }
};

const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

function repo(config, fn) {
  const root = fixture({ '.agents/config.json': JSON.stringify(config), 'src/domain/order.mjs': 'export {};\n',
    '.dependency-cruiser.cjs': 'module.exports = {};\n' });
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

test('the architecture check is granted to workers and its rules become protected', () => {
  withConfig({ ...base, protectedPaths: ['.agents'],
    architecture: { command: 'npx depcruise src', rules: ['.dependency-cruiser.cjs'] } }, root => {
    const config = loadConfig(root);
    assert.deepEqual(config.workerCommands, ['npm test', 'npx depcruise src']);
    assert.deepEqual(config.protectedPaths, ['.agents', '.dependency-cruiser.cjs']);
  });
});

test('a config without the new fields still loads, protecting nothing', () => {
  withConfig(base, root => {
    const config = loadConfig(root);
    assert.deepEqual(config.protectedPaths, []);
    assert.equal(config.architecture.command, null);
  });
});

test('malformed guards fail at load, naming the field', () => {
  withConfig({ ...base, protectedPaths: ['../outside'] }, root => assert.throws(() => loadConfig(root), /protectedPaths/));
  withConfig({ ...base, protectedPaths: '.agents' }, root => assert.throws(() => loadConfig(root), /protectedPaths/));
  withConfig({ ...base, architecture: { command: 'npx depcruise src && echo ok', rules: [] } }, root =>
    assert.throws(() => loadConfig(root), /architecture\.command/));
  withConfig({ ...base, architecture: { command: null, rules: ['/abs'] } }, root => assert.throws(() => loadConfig(root), /architecture\.rules/));
  withConfig({ ...base, architecture: { command: null, rulez: [] } }, root => assert.throws(() => loadConfig(root), /rulez/));
});

test('an owned path inside a protected path is refused before anything is written', () => {
  repo({ ...base, architecture: { command: null, rules: ['.dependency-cruiser.cjs'] } }, (root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'own' });
    assert.throws(() => tools.build_worker_prompt({ role: 'developer', instructions: 'x', workspace: wt.workspace,
      task_id: 'own', cli_engine: 'claude', owned_paths: ['src', '.dependency-cruiser.cjs'] }), /protected/);
  });
});

test('a change to a protected file inside owned paths is a violation, and the prompt names the file', () => {
  repo({ ...base, protectedPaths: ['src/architecture.rules'] }, (root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'sneak' });
    const built = tools.build_worker_prompt({ role: 'developer', instructions: 'x', workspace: wt.workspace,
      task_id: 'sneak', cli_engine: 'claude', owned_paths: ['src'] });
    assert.match(spawnSync('node', ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(built.prompt_file)},'utf8'))`],
      { encoding: 'utf8' }).stdout, /Never change these[^\n]*`src\/architecture\.rules`/);
    const put = (path, body) => { mkdirSync(dirname(resolve(wt.workspace, path)), { recursive: true }); writeFileSync(resolve(wt.workspace, path), body); };
    put('src/domain/order.mjs', 'export const total = 1;\n');
    put('src/architecture.rules', 'allow everything\n');
    const wrapped = buildRunnableCommand({ workspace: wt.workspace, command: { executable: 'sh', args: ['-c', 'echo done'] },
      stdin_file: built.stdin_file, report_file: built.report_file, raw_file: resolve(built.report_file, '..', 'raw.txt'),
      adapter: ENGINES.claude });
    spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });
    const inspected = tools.inspect_dispatch({ task_id: 'sneak' });
    assert.deepEqual(inspected.worktree.violations, ['src/architecture.rules']);
    assert.equal(inspected.verdict.mechanical, 'reject');
  });
});

test('only a codex dispatch registers its worktree as a trusted git directory', () => {
  repo(base, (root, tools) => {
    const trusted = () => git(root, 'config', '--global', '--get-all', 'safe.directory').stdout.trim();
    const claudeWt = tools.prepare_worktree({ task_id: 'on-claude' });
    tools.build_worker_prompt({ role: 'adversary', instructions: 'x', workspace: claudeWt.workspace, task_id: 'on-claude', cli_engine: 'claude' });
    assert.equal(trusted(), '');
    const codexWt = tools.prepare_worktree({ task_id: 'on-codex' });
    tools.build_worker_prompt({ role: 'adversary', instructions: 'x', workspace: codexWt.workspace, task_id: 'on-codex', cli_engine: 'codex' });
    assert.equal(trusted(), codexWt.workspace.replaceAll('\\', '/'));
  });
});

test('check says whether the architecture is actually enforced', () => {
  repo(base, (root, tools) => {
    const { architecture } = tools.check();
    assert.equal(architecture.enforced, false);
    assert.match(architecture.message, /no architecture check/i);
  });
  repo({ ...base, architecture: { command: 'npx depcruise src', rules: ['.dependency-cruiser.cjs'] } }, (root, tools) => {
    const { architecture } = tools.check();
    assert.equal(architecture.enforced, true);
    assert.deepEqual(architecture.missing_rules, []);
  });
  repo({ ...base, architecture: { command: 'npx depcruise src', rules: ['missing.cjs'] } }, (root, tools) => {
    assert.deepEqual(tools.check().architecture.missing_rules, ['missing.cjs']);
  });
});
