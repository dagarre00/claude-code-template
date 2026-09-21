// dispatch_stats counted process — accepted, retries, duration — and nothing
// about outcomes, so there was no way to tell whether a review role earned its
// tokens (the template's own measurement: about one filed finding in seven was
// ever acted on) or which engine's developers let defects through. A review's
// finding counts, recorded with its decision and attributed to the dispatches it
// reviewed, are the minimum that makes either question answerable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildRunnableCommand } from '../dispatch.mjs';
import { ENGINES } from '../engines/index.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'], roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-pro', balanced: 'inherit', fast: 'gemini-3.8-flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

function repo(fn) {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG) });
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

function finished(tools, task_id, role, engine) {
  const wt = tools.prepare_worktree({ task_id });
  const built = tools.build_worker_prompt({ role, instructions: 'x', workspace: wt.workspace, task_id, cli_engine: engine,
    ...(role === 'developer' ? { owned_paths: ['src'] } : {}) });
  const wrapped = buildRunnableCommand({ workspace: wt.workspace, command: { executable: 'sh', args: ['-c', 'echo report'] },
    stdin_file: built.stdin_file, report_file: built.report_file, raw_file: resolve(built.report_file, '..', 'raw.txt'),
    adapter: ENGINES[engine] });
  spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });
}

test('a review decision carries its finding counts, and stats report yield and findings against the author', () => {
  repo((root, tools) => {
    finished(tools, 'dev-b1', 'developer', 'claude');
    finished(tools, 'adv-1', 'adversary', 'claude');
    tools.record_decision({ task_id: 'dev-b1', decision: 'accepted', reason: 'Red proven, suite green' });
    const recorded = tools.record_decision({ task_id: 'adv-1', decision: 'accepted', reason: 'findings grounded in the diff',
      findings: { raised: { major: 1, minor: 2, nit: 3 }, dispositions: { fixed: 1, filed: 1, rejected: 1 } },
      reviewed_task_ids: ['dev-b1'] });
    assert.deepEqual(recorded.findings.raised, { major: 1, minor: 2, nit: 3 });

    const rows = tools.dispatch_stats().by_engine_role;
    const adversary = rows.find(row => row.role === 'adversary');
    assert.equal(adversary.reviews_with_findings_recorded, 1);
    assert.equal(adversary.findings_raised, 6);
    assert.equal(adversary.findings_acted_on, 1);
    const developer = rows.find(row => row.role === 'developer');
    assert.deepEqual(developer.findings_against, { major: 1, minor: 2, nit: 3 });
  });
});

test('finding counts are validated: known keys, whole numbers, real reviewed dispatches, review roles only', () => {
  repo((root, tools) => {
    finished(tools, 'dev', 'developer', 'claude');
    finished(tools, 'adv', 'adversary', 'claude');
    const decide = extra => tools.record_decision({ task_id: 'adv', decision: 'accepted', reason: 'ok reason', ...extra });
    assert.throws(() => decide({ findings: { raised: { huge: 1 }, dispositions: {} } }), /huge/);
    assert.throws(() => decide({ findings: { raised: { minor: -1 }, dispositions: {} } }), /whole number/);
    assert.throws(() => decide({ findings: { raised: { minor: 1 }, dispositions: { ignored: 1 } } }), /ignored/);
    assert.throws(() => decide({ findings: { raised: {}, dispositions: {} }, reviewed_task_ids: ['ghost'] }), /ghost/);
    assert.throws(() => tools.record_decision({ task_id: 'dev', decision: 'accepted', reason: 'ok reason',
      findings: { raised: { minor: 1 }, dispositions: {} } }), /read-only/);
  });
});
