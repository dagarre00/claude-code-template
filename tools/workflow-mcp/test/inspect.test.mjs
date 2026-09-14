// A dispatch used to leave nothing the MCP could read back once the worker
// exited: resuming an interrupted cycle meant stitching state together from the
// conversation tail, git and event-log tails (resume-report 2026-09-10, §5), and
// "exit 0 + SUCCESS + a denied read" was accepted as success because nothing
// computed otherwise (§1). These pin the record, the mechanical verdict, the
// conductor's decision, and the per-engine numbers a default-engine change needs
// (§6, §8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildRunnableCommand } from '../dispatch.mjs';
import { ENGINES } from '../engines/index.mjs';
import { makeTools } from '../tools.mjs';
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

const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

function repo(fn, config = CONFIG) {
  const root = fixture({ '.agents/config.json': JSON.stringify(config), '.gitignore': '.venv/\n' });
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

// Prepare and compose for real, then run the real wrapper around a stand-in
// process, so the outcome is recorded exactly the way a live dispatch records it.
function dispatch(tools, { task_id, role = 'adversary', engine = 'claude', script, ...extra }) {
  const wt = tools.prepare_worktree({ task_id });
  const built = tools.build_worker_prompt({ role, instructions: 'Do the task.', workspace: wt.workspace,
    cli_engine: engine, task_id, ...(role === 'developer' ? { owned_paths: ['src'] } : {}), ...extra });
  return { wt, built, run: () => {
    const command = { executable: 'sh', args: ['-c', script] };
    const wrapped = buildRunnableCommand({ workspace: wt.workspace, command, stdin_file: built.stdin_file,
      report_file: built.report_file, raw_file: resolve(built.report_file, '..', 'raw.txt'), adapter: ENGINES[engine] });
    return spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });
  } };
}

test('a prepared worktree already has a record, before any prompt is composed', () => {
  repo((root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'early' });
    const inspected = tools.inspect_dispatch({ task_id: 'early' });
    assert.equal(inspected.state, 'prepared');
    assert.equal(inspected.base_sha, wt.base_sha);
    assert.equal(inspected.integration_branch, 'main');
    assert.equal(inspected.verdict.mechanical, 'incomplete');
  });
});

test('a composed dispatch that has not run is incomplete, and says why', () => {
  repo((root, tools) => {
    dispatch(tools, { task_id: 'composed', script: 'true' });
    const inspected = tools.inspect_dispatch({ task_id: 'composed' });
    assert.equal(inspected.state, 'composed');
    assert.equal(inspected.verdict.mechanical, 'incomplete');
    assert.match(inspected.verdict.reasons.join(' '), /not (been )?run|no outcome/i);
  });
});

test('running the returned command records exit code and duration, and a clean run passes', () => {
  repo((root, tools) => {
    const { run } = dispatch(tools, { task_id: 'clean', script: 'echo "F1 — minor — correctness — a real finding"' });
    assert.equal(run().status, 0);
    const inspected = tools.inspect_dispatch({ task_id: 'clean' });
    assert.equal(inspected.state, 'finished');
    assert.equal(inspected.run.exit_code, 0);
    assert.ok(Number.isFinite(inspected.run.duration_ms) && inspected.run.duration_ms >= 0);
    assert.equal(inspected.verdict.mechanical, 'pass', inspected.verdict.reasons.join('; '));
    assert.equal(inspected.report.empty, false);
    assert.ok(inspected.report.path.endsWith('report.txt'));
    assert.equal(inspected.report.content, undefined, 'bounded: the report is named, never dumped');
  });
});

test('a nonzero exit is rejected by name', () => {
  repo((root, tools) => {
    const { run } = dispatch(tools, { task_id: 'crashed', script: 'echo partial; exit 3' });
    run();
    const { verdict } = tools.inspect_dispatch({ task_id: 'crashed' });
    assert.equal(verdict.mechanical, 'reject');
    assert.match(verdict.reasons.join(' '), /exit(ed)? .*3/i);
  });
});

test('an empty report is rejected even when the process exited 0', () => {
  repo((root, tools) => {
    const { run } = dispatch(tools, { task_id: 'silent', script: 'true' });
    run();
    const { verdict } = tools.inspect_dispatch({ task_id: 'silent' });
    assert.equal(verdict.mechanical, 'reject');
    assert.match(verdict.reasons.join(' '), /empty/i);
  });
});

// The acceptance example from the resume report, verbatim: exit 0 plus SUCCESS
// plus a denied read must come out rejected.
test('an agy SUCCESS with a denied read is rejected, and its usage counters are carried', () => {
  repo((root, tools) => {
    const transcript = JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '',
      usage: { total_tokens: 1234 }, denied_actions: [{ action: 'read_file', display_name: 'ViewFile' }] } });
    const { built, run } = dispatch(tools, { task_id: 'denied', engine: 'antigravity', script: 'cat "$T"' });
    writeFileSync(resolve(built.report_file, '..', 't.json'), transcript + '\n');
    process.env.T = resolve(built.report_file, '..', 't.json');
    try { run(); } finally { delete process.env.T; }
    const inspected = tools.inspect_dispatch({ task_id: 'denied' });
    assert.equal(inspected.verdict.mechanical, 'reject');
    assert.match(inspected.verdict.reasons.join(' '), /denied/i);
    assert.equal(inspected.report.engine_status, 'SUCCESS');
    assert.equal(inspected.usage.total_tokens, 1234);
  });
});

// codex's transcript ends its run with `tokens used` and the count on the next
// line, grouped by locale — measured on this machine as `14.771` for 14,771.
// claude's plain-text report carries no counter at all, which stays null.
test('codex token usage is read from its transcript; claude reports none', () => {
  repo((root, tools) => {
    const { built, run } = dispatch(tools, { task_id: 'codex-usage', engine: 'codex',
      script: 'echo "working"; echo "tokens used"; echo "14.771"; echo "the final report" > "$REPORT"' });
    process.env.REPORT = built.report_file;
    try { run(); } finally { delete process.env.REPORT; }
    const codex = tools.inspect_dispatch({ task_id: 'codex-usage' });
    assert.equal(codex.usage.total_tokens, 14771);
    assert.equal(codex.verdict.mechanical, 'pass', codex.verdict.reasons.join('; '));

    dispatch(tools, { task_id: 'claude-usage', script: 'echo report' }).run();
    assert.equal(tools.inspect_dispatch({ task_id: 'claude-usage' }).usage, null);
  });
});

test('a read-only worker that wrote a file is rejected, and so is a worker that committed', () => {
  repo((root, tools) => {
    const { wt, run } = dispatch(tools, { task_id: 'wrote', script: 'echo report' });
    run();
    writeFileSync(resolve(wt.workspace, 'stray.txt'), 'x\n');
    let { verdict } = tools.inspect_dispatch({ task_id: 'wrote' });
    assert.equal(verdict.mechanical, 'reject');
    assert.match(verdict.reasons.join(' '), /stray\.txt/);

    git(wt.workspace, 'add', '-A');
    git(wt.workspace, 'commit', '-qm', 'worker commit');
    ({ verdict } = tools.inspect_dispatch({ task_id: 'wrote' }));
    assert.match(verdict.reasons.join(' '), /commit/i, 'workers never commit; a commit before a decision is not theirs to make');
  });
});

test('a retry names the attempt it replaces, and a retry of nothing is refused', () => {
  repo((root, tools) => {
    dispatch(tools, { task_id: 'first', script: 'true' });
    dispatch(tools, { task_id: 'second', script: 'true', retry_of: 'first' });
    const second = tools.inspect_dispatch({ task_id: 'second' });
    assert.equal(second.attempt, 2);
    assert.equal(second.retry_of, 'first');
    assert.equal(tools.inspect_dispatch({ task_id: 'first' }).attempt, 1);
    const wt = tools.prepare_worktree({ task_id: 'orphan' });
    assert.throws(() => tools.build_worker_prompt({ role: 'adversary', instructions: 'x', workspace: wt.workspace,
      cli_engine: 'claude', task_id: 'orphan', retry_of: 'never-dispatched' }), /retry_of/);
  });
});

// Resuming usually re-dispatches into the worktree that holds the partial work
// (resume-report: three developer dispatches reused one checkout). Composing
// again used to overwrite the prompt, report and record of the attempt before.
test('re-dispatching into the same worktree keeps the attempt before it, and counts it', () => {
  repo((root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'resume' });
    const compose = () => tools.build_worker_prompt({ role: 'adversary', instructions: 'Review.',
      workspace: wt.workspace, cli_engine: 'claude', task_id: 'resume' });
    const runWith = (built, script) => spawnSync('sh', ['-c', buildRunnableCommand({ workspace: wt.workspace,
      command: { executable: 'sh', args: ['-c', script] }, stdin_file: built.stdin_file, report_file: built.report_file,
      raw_file: resolve(built.report_file, '..', 'raw.txt'), adapter: ENGINES.claude })]);

    runWith(compose(), 'exit 4');
    compose();                                   // composed again, not yet run
    const second = compose();                    // composing twice without a run is not a new attempt
    runWith(second, 'echo the second report');

    const inspected = tools.inspect_dispatch({ task_id: 'resume' });
    assert.equal(inspected.attempt, 2);
    assert.equal(inspected.run.exit_code, 0);
    assert.deepEqual(inspected.previous_attempts.map(a => [a.attempt, a.exit_code]), [[1, 4]]);
    assert.equal(tools.dispatch_stats().by_engine_role[0].dispatches, 2);
  });
});

test('the conductor records a decision with a reason, and cannot accept what failed mechanically without saying why', () => {
  repo((root, tools) => {
    dispatch(tools, { task_id: 'good', script: 'echo report' }).run();
    assert.throws(() => tools.record_decision({ task_id: 'good', decision: 'accepted' }), /reason/i);
    tools.record_decision({ task_id: 'good', decision: 'accepted', reason: 'Findings verified against the diff.' });
    assert.equal(tools.inspect_dispatch({ task_id: 'good' }).decision.decision, 'accepted');

    dispatch(tools, { task_id: 'bad', script: 'exit 2' }).run();
    assert.throws(() => tools.record_decision({ task_id: 'bad', decision: 'accepted', reason: 'looks fine' }), /mechanical|override/i);
    tools.record_decision({ task_id: 'bad', decision: 'accepted', reason: 'Exit 2 is the suite failing on purpose (Red).',
      override_mechanical: true });
    assert.equal(tools.inspect_dispatch({ task_id: 'bad' }).decision.override_mechanical, true);
  });
});

// "Benchmark engines on accepted cases, retries and total elapsed time before
// changing role defaults" (resume-report §6) needs the numbers to exist.
test('dispatch_stats aggregates outcomes, decisions and retries per engine and role', () => {
  repo((root, tools) => {
    dispatch(tools, { task_id: 'a1', script: 'echo ok' }).run();
    tools.record_decision({ task_id: 'a1', decision: 'rejected', reason: 'Missed the Checked line.' });
    dispatch(tools, { task_id: 'a2', script: 'echo ok', retry_of: 'a1' }).run();
    tools.record_decision({ task_id: 'a2', decision: 'accepted', reason: 'Complete.' });
    dispatch(tools, { task_id: 'b1', script: 'exit 1', engine: 'codex' });

    const stats = tools.dispatch_stats();
    const claude = stats.by_engine_role.find(row => row.engine === 'claude' && row.role === 'adversary');
    assert.equal(claude.dispatches, 2);
    assert.equal(claude.finished, 2);
    assert.equal(claude.accepted, 1);
    assert.equal(claude.rejected, 1);
    assert.equal(claude.retries, 1);
    assert.ok(Number.isFinite(claude.median_duration_ms));
    const codex = stats.by_engine_role.find(row => row.engine === 'codex');
    assert.equal(codex.dispatches, 1);
    assert.equal(codex.finished, 0, 'composed but never run is counted, not finished');
  });
});

test('prepare_worktree hands back the configured setup commands for the conductor to run', () => {
  repo((root, tools) => {
    const wt = tools.prepare_worktree({ task_id: 'venv' });
    assert.deepEqual(wt.setup_commands, ['uv venv .venv', 'uv pip install --python .venv/bin/python -e .']);
  }, { ...CONFIG, worktreeSetup: ['uv venv .venv', 'uv pip install --python .venv/bin/python -e .'] });
  repo((root, tools) => {
    assert.deepEqual(tools.prepare_worktree({ task_id: 'none' }).setup_commands, []);
  });
});

test('a malformed worktreeSetup fails at load, not in the middle of a cycle', () => {
  for (const bad of ['uv sync', [''], ['a\nb'], [42]]) {
    const root = fixture({ '.agents/config.json': JSON.stringify({ ...CONFIG, worktreeSetup: bad }) });
    try {
      assert.throws(() => makeTools(root, 'codex').check(), /worktreeSetup/, `accepted ${JSON.stringify(bad)}`);
    } finally { cleanup(root); }
  }
});
