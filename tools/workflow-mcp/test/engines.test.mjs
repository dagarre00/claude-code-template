import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, engineNames, buildCommand, stdinPayload } from '../engines/index.mjs';

const settings = {
  workerTimeoutSeconds: 1800,
  workerCommands: ['npm test'],
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};
const task = { profile: 'balanced', access: 'write', workspace: '/tmp/wt' };
const build = (engine, over = {}) => buildCommand(settings, { engine, ...task, ...over });

test('every registered engine builds a clean argv', () => {
  for (const engine of engineNames) {
    const { executable, args } = build(engine);
    assert.ok(executable, `${engine} has no executable`);
    for (const arg of args) {
      assert.equal(typeof arg, 'string', `${engine} produced a non-string arg`);
      // argv is passed without a shell, but control characters would still
      // corrupt logs and any command line reproduced for a human to re-run.
      assert.doesNotMatch(arg, /[\0\r\n]/, `${engine} arg has a control character: ${arg}`);
    }
  }
});

test('no engine may request a permission bypass', () => {
  for (const engine of engineNames) {
    for (const access of ['read-only', 'write']) {
      const { args } = build(engine, { access });
      assert.doesNotMatch(args.join(' '), /dangerous|bypassPermissions|--yolo|full-access/i,
        `${engine}/${access} asked for a bypass`);
    }
  }
});

// The whole design rests on the worker seeing only the composed prompt, so each
// engine must actively suppress whatever project context it would otherwise read.
test('every engine suppresses project context', () => {
  assert.ok(build('claude').args.includes('--safe-mode'));           // no CLAUDE.md, skills, plugins, MCP
  assert.ok(build('codex').args.includes('project_doc_max_bytes=0')); // no AGENTS.md
  // antigravity reads no repository files in print mode at all — measured, so
  // there is nothing to pass; the assertion is that we did not invent a flag.
  assert.equal(ENGINES.antigravity.readsProjectDocs, false);
});

// Each engine denies writes its own way, and only two of the three do it below
// the prompt (see the enforcement test further down). Claude deliberately does
// NOT use plan mode here: plan mode also refuses every Bash call, so a read-only
// reviewer could not run the suite to check its own findings. What denies its
// edits instead is the absence of an approval surface — measured: the Write tool
// "was automatically denied because it requires user approval and there's no
// approval interface in this session type", and no file appeared.
test('read-only access maps to each engine\'s non-writing mode', () => {
  const claude = build('claude', { access: 'read-only' }).args;
  assert.equal(claude[claude.indexOf('--permission-mode') + 1], 'default');
  assert.ok(claude.join(' ').includes('--permission-prompts none'));
  assert.ok(!claude.includes('acceptEdits'));
  assert.ok(build('codex', { access: 'read-only' }).args.includes('read-only'));
  assert.ok(build('antigravity', { access: 'read-only' }).args.join(' ').includes('--mode plan'));
});

test('write access maps to each engine\'s editing mode', () => {
  assert.ok(build('claude').args.includes('acceptEdits'));
  assert.ok(build('codex').args.includes('workspace-write'));
  assert.ok(build('antigravity').args.join(' ').includes('--mode accept-edits'));
});

test('model and effort come from the profile and can be overridden', () => {
  const fromProfile = build('claude', { profile: 'reasoning' });
  assert.ok(fromProfile.args.includes('opus'));
  assert.equal(fromProfile.model, 'opus');
  const overridden = build('claude', { model: 'sonnet', effort: 'low' });
  assert.ok(overridden.args.includes('sonnet'));
  assert.ok(overridden.args.includes('low'));
});

test('an effort the engine does not support is rejected by name', () => {
  assert.throws(() => build('codex', { effort: 'max' }), /codex.*max|max.*codex/i);
});

test('a malformed model string is rejected rather than passed to argv', () => {
  assert.throws(() => build('claude', { model: 'sonnet; rm -rf /' }), /model/i);
  assert.throws(() => build('claude', { model: 'a\nb' }), /model/i);
});

test('"inherit" means do not pass a model flag at all', () => {
  assert.ok(!build('antigravity', { profile: 'balanced' }).args.includes('--model'));
});

test('antigravity keeps --print last, because it swallows the next argument', () => {
  const { args } = build('antigravity');
  assert.match(args.at(-1), /^--print=/);
});

test('codex keeps the stdin marker last', () => {
  assert.equal(build('codex').args.at(-1), '-');
});

// codex exec's default text output interleaves the worker's final message with
// the full transcript of every command it ran — measured at 6.9MB/43,015 lines
// for one real dispatch. -o isolates the final message into its own file so the
// conductor's routine path never has to wade through the transcript to find it.
test('codex writes the report to its own file, still ending in the stdin marker', () => {
  const { args } = build('codex', { reportFile: '/tmp/wt/report.txt' });
  const at = args.indexOf('-o');
  assert.notEqual(at, -1, 'no -o flag for the given reportFile');
  assert.equal(args[at + 1], '/tmp/wt/report.txt');
  assert.equal(args.at(-1), '-', '-o must not push the stdin marker off the end');
});

test('codex omits -o entirely when no reportFile is given', () => {
  assert.ok(!build('codex').args.includes('-o'));
});

// Only two ways to avoid making the conductor parse a transcript for the
// report: stdout already is just the report (claude), or a flag isolates it
// into its own file (codex, via -o above). Antigravity has neither, and must
// say so rather than silently inheriting an assumption of parity.
test('each engine declares honestly whether the conductor can read its report cleanly', () => {
  assert.equal(ENGINES.claude.reportIsStdout, true);
  assert.equal(ENGINES.claude.writesReportFile, false);
  assert.equal(ENGINES.codex.reportIsStdout, false);
  assert.equal(ENGINES.codex.writesReportFile, true);
  assert.equal(ENGINES.antigravity.reportIsStdout, false);
  assert.equal(ENGINES.antigravity.writesReportFile, false);
});

test('stdin is plain text everywhere except antigravity, which needs NDJSON', () => {
  assert.equal(stdinPayload('claude', 'HELLO'), 'HELLO');
  assert.equal(stdinPayload('codex', 'HELLO'), 'HELLO');
  const agy = stdinPayload('antigravity', 'HELLO');
  const parsed = JSON.parse(agy.trim());
  assert.equal(parsed.message.content[0].text, 'HELLO');
  assert.ok(agy.endsWith('\n'), 'NDJSON must be newline terminated');
});

test('an unknown engine fails by name', () => {
  assert.throws(() => build('gemini'), /gemini/);
});

// Measured by dispatching a capability audit to each engine and asking what
// agent-spawning tools it actually has. claude answered NONE, codex answered
// NONE, agy answered `define_subagent`, `invoke_subagent`. The contract forbids
// recursion on all three; only two can enforce it below the prompt, and pretending
// otherwise would be the kind of unverified claim rule 7 exists to prevent.
// A worker that cannot run the project's test command cannot confirm Red or
// Green, so the allowlist is what makes rules 2 and 4 reachable at all. Measured:
// without it, a developer reports "this session has no approval surface" and every
// npm invocation is denied.
test('claude grants each configured command narrowly, and nothing else', () => {
  const args = build('claude').args;
  const at = args.indexOf('--allowedTools');
  assert.notEqual(at, -1, 'no --allowedTools for the configured workerCommands');
  assert.equal(args[at + 1], 'Bash(npm test:*)');
  assert.equal(args.filter(a => a === '--allowedTools').length, settings.workerCommands.length,
    'one grant per configured command, no wildcards');
});

// Plan mode refuses every Bash call, which would leave a read-only reviewer
// unable to verify the findings it reports.
test('a read-only claude worker can still run the allowlisted commands', () => {
  const args = build('claude', { access: 'read-only' }).args;
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'default');
  assert.ok(args.includes('Bash(npm test:*)'));
});

// With --sandbox, agy routes every shell call through `escalate_admin`, which
// headless mode cannot grant: the worker exits 0 and returns an empty response.
test('agy runs workers without the sandbox that silently swallows them', () => {
  assert.ok(!build('antigravity').args.includes('--sandbox'));
});

test('each engine declares honestly what it can enforce below the prompt', () => {
  assert.equal(ENGINES.claude.enforcesLeafWorker, true);
  assert.equal(ENGINES.codex.enforcesLeafWorker, true);
  assert.equal(ENGINES.antigravity.enforcesLeafWorker, false);
  assert.equal(ENGINES.claude.enforcesReadOnly, true);
  assert.equal(ENGINES.codex.enforcesReadOnly, true);
  assert.equal(ENGINES.antigravity.enforcesReadOnly, false);
});

test('claude and codex argv actually carry the flag that earns the claim', () => {
  assert.ok(build('claude').args.join(' ').includes('--disallowedTools Agent,Task'));
  assert.ok(build('codex').args.includes('agents.enabled=false'));
});
