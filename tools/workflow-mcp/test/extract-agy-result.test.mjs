import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanup } from './helpers.mjs';

const SCRIPT = fileURLToPath(new URL('../engines/extract-agy-result.mjs', import.meta.url));

// Every event below copies the shape of a real agy 1.2.2 stream-json transcript
// (2026-09-13 e2e): the tool call lives at step_update.tool_name in snake_case,
// its arguments at step_update.tool_info.parameters in PascalCase, and a denial
// names the action plus a PascalCase display_name. The earlier tests used shapes
// nobody measured, which is how target recovery shipped never matching a real run.
const WS = 'C:\\work\\repo\\.worktrees\\t1';
const step = (i, tool, parameters, extra = {}) => JSON.stringify({ event: 'step_update', step_update: {
  conversation_id: 'c1', step_index: i, state: 'DONE', step_type: 'tool', tool_name: tool,
  tool_info: { name: tool, parameters, ...extra } } });
const result = fields => JSON.stringify({ event: 'result', result: {
  conversation_id: 'c1', status: 'SUCCESS', response: 'a real report', duration_seconds: 1, num_turns: 1, ...fields } });

function run(lines, { dispatch } = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), 'agy-extract-'));
  try {
    const raw = resolve(dir, 'raw.txt');
    const report = resolve(dir, 'report.txt');
    writeFileSync(raw, lines.join('\n') + '\n');
    if (dispatch) writeFileSync(resolve(dir, 'dispatch.json'), JSON.stringify(dispatch));
    const outcome = spawnSync(process.execPath, [SCRIPT, raw, report], { encoding: 'utf8' });
    return { status: outcome.status, report: JSON.parse(readFileSync(report, 'utf8')) };
  } finally { cleanup(dir); }
}

// Measured: a wiki-maintainer's last tool call came back "missing properties
// 'toolSummary', 'toolAction'", and the run ended SUCCESS with an empty response
// and no denial. It exited 0 and read as a pass.
test('an empty response with no denial fails, because there is no report to accept', () => {
  const { status, report } = run([
    step(18, 'grep_search', { Query: 'log-and-commit', SearchPath: `${WS}\\.agents` }, { output: "invalid arguments:\n- missing properties 'toolSummary', 'toolAction'" }),
    result({ response: '' })
  ]);
  assert.notEqual(status, 0);
  assert.match(report.workflow_mcp_extraction.note, /empty/i);
});

test('a whitespace-only response is as empty as an empty one', () => {
  assert.notEqual(run([result({ response: '  \n ' })]).status, 0);
});

// Measured: denied_actions was [{action: "read_file", display_name: "GrepSearch"}]
// while the refused call was step_update.tool_name "grep_search" with its target
// in SearchPath. The last matching call is the one that was refused, since the
// denial ends the run.
test('a denial recovers the target from a real-shaped transcript, most recent call first', () => {
  const { status, report } = run([
    step(6, 'grep_search', { Query: 'leaf-probe', SearchPath: 'C:\\Temp\\session' }, { output: 'runs\\x\\cmd.sh:' }),
    step(8, 'view_file', { AbsolutePath: 'C:\\Temp\\session\\runs\\x\\cmd.sh' }, { output: '2 lines' }),
    step(10, 'grep_search', { Query: 'leaf-probe', SearchPath: 'C:\\Users\\me\\other-project' }),
    result({ response: '', denied_actions: [{ action: 'read_file', display_name: 'GrepSearch' }] })
  ]);
  assert.notEqual(status, 0);
  const [denial] = report.workflow_mcp_extraction.denied_action_targets;
  assert.equal(denial.observed_targets[0], 'C:\\Users\\me\\other-project');
  assert.ok(denial.observed_targets.includes('C:\\Temp\\session'));
  assert.ok(!denial.observed_targets.includes('C:\\Temp\\session\\runs\\x\\cmd.sh'),
    'a view_file call is not the grep that was denied');
});

test('a denied command recovers its CommandLine', () => {
  const { report } = run([
    step(4, 'run_command', { CommandLine: 'git log -n 3', Cwd: WS }),
    result({ response: '', denied_actions: [{ action: 'command', display_name: 'RunCommand' }] })
  ]);
  assert.equal(report.workflow_mcp_extraction.denied_action_targets[0].observed_targets[0], 'git log -n 3');
});

const dispatch = { role: 'adversary', access: 'read-only', workspace: WS, worker_commands: ['npm test', 'git status'] };

// Reads outside the worktree cannot be blocked on agy — measured with the canary
// probe, with and without allowNonWorkspaceAccess: false — and 5 of 22 real
// dispatches did it, including reading the conductor's own files. What cannot be
// prevented is reported on every run instead of discovered by accident.
test('the audit reports reads outside the workspace without failing the run', () => {
  const { status, report } = run([
    step(2, 'view_file', { AbsolutePath: `${WS}\\docs\\wiki\\gotchas.md` }),
    step(4, 'list_dir', { DirectoryPath: 'C:\\work\\repo\\.worktrees' }),
    step(6, 'view_file', { AbsolutePath: 'c:/work/repo/.worktrees/t1/src/a.mjs' }),
    result({})
  ], { dispatch });
  assert.equal(status, 0, 'a shared venv granted with read_file(...) is a legitimate outside read');
  assert.deepEqual(report.workflow_mcp_audit.reads_outside_workspace, ['list_dir C:\\work\\repo\\.worktrees']);
  assert.equal(report.workflow_mcp_audit.clean, false);
});

test('the audit fails a run that wrote outside its workspace or spawned a subagent', () => {
  const outside = run([step(3, 'write_to_file', { TargetFile: 'C:\\work\\repo\\.worktrees\\t2\\x.md' }), result({})], { dispatch });
  assert.notEqual(outside.status, 0);
  assert.deepEqual(outside.report.workflow_mcp_audit.writes_outside_workspace, ['write_to_file C:\\work\\repo\\.worktrees\\t2\\x.md']);

  const subagent = run([step(3, 'define_subagent', { name: 'helper', system_prompt: 'hi' }), result({})], { dispatch });
  assert.notEqual(subagent.status, 0);
  assert.deepEqual(subagent.report.workflow_mcp_audit.subagent_calls, ['define_subagent']);
});

test('the audit lists commands that were not on the allowlist verbatim', () => {
  const { status, report } = run([
    step(2, 'run_command', { CommandLine: 'npm test', Cwd: WS }),
    step(4, 'run_command', { CommandLine: 'cd src && npm test', Cwd: WS }),
    result({})
  ], { dispatch });
  assert.equal(status, 0, 'agy itself denies what its grants do not cover; the audit only names it');
  assert.deepEqual(report.workflow_mcp_audit.commands_not_allowlisted, ['cd src && npm test']);
});

test('a clean run carries a clean audit', () => {
  const { status, report } = run([step(2, 'run_command', { CommandLine: 'git status', Cwd: WS }), result({})], { dispatch });
  assert.equal(status, 0);
  assert.equal(report.workflow_mcp_audit.clean, true);
  assert.equal(report.response, 'a real report');
});

// Measured twice (a wiki-maintainer and an adversary, 2026-09-13/14): agy's last
// tool call came back "invalid arguments: - missing property 'Pattern'", and the
// run ended SUCCESS with nothing. The engine rejected its own malformed call; the
// brief was fine. Naming that is what lets a conductor retry once unchanged
// instead of rewriting a brief that was never the problem.
test('an empty run that ended on a rejected tool call is marked transient, with the call', () => {
  const { status, report } = run([
    step(26, 'view_file', { AbsolutePath: `${WS}\\package.json` }, { output: '10 lines' }),
    step(28, 'find_by_name', { SearchDirectory: `${WS}\\test` }, { output: "invalid arguments:\n- missing property 'Pattern'" }),
    result({ response: '' })
  ]);
  assert.notEqual(status, 0);
  assert.equal(report.workflow_mcp_extraction.transient, true);
  assert.equal(report.workflow_mcp_extraction.last_tool_call.tool, 'find_by_name');
  assert.match(report.workflow_mcp_extraction.last_tool_call.output, /missing property/);
});

test('an empty run that did not end on a rejected call is not called transient', () => {
  const { report } = run([step(2, 'view_file', { AbsolutePath: `${WS}\a.md` }, { output: '3 lines' }), result({ response: '' })]);
  assert.equal(report.workflow_mcp_extraction.transient, false);
});
