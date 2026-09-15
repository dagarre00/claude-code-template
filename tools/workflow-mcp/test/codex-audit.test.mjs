// Measured 2026-09-14 (codex 0.154.0, Windows): a read-only codex worker read a
// file in the parent checkout and a file outside the repository entirely, both
// named in its instructions, and reported their contents. Codex's sandbox bounds
// writes and network, not reads — and the adversary runs on codex first. agy had
// a read audit; codex had none. Its transcript records every command as `exec`
// followed by `<shell> <args> in <cwd>`, which is enough to say what it read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildRunnableCommand } from '../dispatch.mjs';
import { ENGINES } from '../engines/index.mjs';
import { auditCodexTranscript } from '../engines/codex-audit.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

const PWSH = '"C:\\\\Program Files\\\\WindowsApps\\\\Microsoft.PowerShell_7.6.6.0_x64__8wekyb3d8bbwe\\\\pwsh.exe"';
const WS = 'C:\\Users\\dev\\repo\\.worktrees\\adv';

const transcript = lines => ['OpenAI Codex v0.154.0', '--------', 'user', 'prompt text', ...lines.flatMap(line => ['exec', line, ' succeeded in 12ms:', 'output'])].join('\n');

test('reads inside the workspace are not reported, whatever their spelling', () => {
  const audit = auditCodexTranscript(transcript([
    `${PWSH} -Command 'git status --porcelain' in ${WS}`,
    `${PWSH} -Command 'Get-Content -Encoding utf8 docs/wiki/gotchas.md' in ${WS}`,
    `${PWSH} -Command "rg -n 'a|b/c' docs/wiki" in ${WS}`,
    `${PWSH} -Command "Get-Content -Raw -LiteralPath 'C:/Users/dev/repo/.worktrees/adv/src/app.mjs'" in ${WS}`,
    `${PWSH} -Command 'git log --oneline HEAD~3..HEAD' in ${WS}`
  ]), { workspace: 'C:/Users/dev/repo/.worktrees/adv' });
  assert.deepEqual(audit.reads_outside_workspace, []);
  assert.equal(audit.commands, 5);
});

test('absolute paths, parent escapes and a foreign working directory are reported (measured shapes)', () => {
  const audit = auditCodexTranscript(transcript([
    `${PWSH} -Command "Get-Content -Raw -LiteralPath 'C:/Users/dev/repo/canary-repo.txt'" in ${WS}`,
    `${PWSH} -Command "Get-Content -Raw -LiteralPath 'C:/Users/dev/repo/.worktrees/adv/../../canary-outside.txt'" in ${WS}`,
    `${PWSH} -Command 'Get-Content ..\\..\\.handoff\\auth-plan.md' in ${WS}`,
    `${PWSH} -Command 'Get-ChildItem' in C:\\Users\\dev\\repo`,
    `/bin/bash -lc 'cat /home/dev/.ssh/config' in /home/dev/repo/.worktrees/adv`
  ]), { workspace: 'C:/Users/dev/repo/.worktrees/adv' });
  assert.equal(audit.reads_outside_workspace.length, 5, audit.reads_outside_workspace.join('\n'));
  assert.match(audit.reads_outside_workspace[1], /canary-outside/);
  assert.match(audit.reads_outside_workspace[2], /\.handoff/);
});

test('skills a codex worker opened are listed, so a reviewer reading author procedures is visible', () => {
  const audit = auditCodexTranscript(transcript([
    `${PWSH} -Command 'Get-Content .agents/skills/tdd-loop/SKILL.md' in ${WS}`,
    `${PWSH} -Command 'Get-Content .agents\\skills\\adversarial-review\\SKILL.md' in ${WS}`
  ]), { workspace: 'C:/Users/dev/repo/.worktrees/adv' });
  assert.deepEqual(audit.skill_reads, ['adversarial-review', 'tdd-loop']);
});

test('inspect_dispatch carries the codex audit and warns about reads outside the workspace', () => {
  const root = fixture({ '.agents/config.json': JSON.stringify({
    version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'], roles: {},
    engines: {
      claude: { executable: 'claude', models: { reasoning: 'o', balanced: 's', fast: 'h' }, effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
      codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null }, effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
      antigravity: { executable: 'agy', models: { reasoning: 'p', balanced: 'i', fast: 'f' }, effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
    } }) });
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-b', 'main', '-q'); git('config', 'user.email', 't@e.com'); git('config', 'user.name', 'T');
  git('add', '-A'); git('commit', '-qm', 'init');
  const globalDir = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-global-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(globalDir, 'gitconfig');
  try {
    const tools = makeTools(root, 'claude');
    const wt = tools.prepare_worktree({ task_id: 'adv' });
    const built = tools.build_worker_prompt({ role: 'adversary', instructions: 'Review.', workspace: wt.workspace, task_id: 'adv', cli_engine: 'codex' });
    const script = resolve(globalDir, 'standin.sh');
    writeFileSync(script, `printf 'exec\\n/bin/sh -lc %s in %s\\n' "'cat ../../.handoff/x-plan.md'" "$(pwd)"\necho 'Nothing above nit. Checked: all.' > '${built.report_file.replaceAll('\\', '/')}'\n`);
    const wrapped = buildRunnableCommand({ workspace: wt.workspace, command: { executable: 'sh', args: [script.replaceAll('\\', '/')] },
      stdin_file: built.stdin_file, report_file: built.report_file, raw_file: resolve(built.report_file, '..', 'raw.txt'), adapter: ENGINES.codex });
    assert.equal(spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' }).status, 0);
    const inspected = tools.inspect_dispatch({ task_id: 'adv' });
    assert.equal(inspected.audit.reads_outside_workspace.length, 1);
    assert.match(inspected.verdict.warnings.join(' '), /read outside its workspace/);
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    cleanup(root);
    cleanup(globalDir);
  }
});
