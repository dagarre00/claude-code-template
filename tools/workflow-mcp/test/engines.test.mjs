import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, engineNames, buildCommand, stdinPayload } from '../engines/index.mjs';

const settings = {
  workerTimeoutSeconds: 1800,
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

test('read-only access maps to each engine\'s non-writing mode', () => {
  assert.deepEqual(
    [build('claude', { access: 'read-only' }).args.join(' ').match(/plan/),
      build('codex', { access: 'read-only' }).args.includes('read-only'),
      build('antigravity', { access: 'read-only' }).args.join(' ').includes('--mode plan')].map(Boolean),
    [true, true, true]);
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
test('each engine declares honestly whether it can enforce the leaf-worker rule', () => {
  assert.equal(ENGINES.claude.enforcesLeafWorker, true);
  assert.equal(ENGINES.codex.enforcesLeafWorker, true);
  assert.equal(ENGINES.antigravity.enforcesLeafWorker, false);
});

test('claude and codex argv actually carry the flag that earns the claim', () => {
  assert.ok(build('claude').args.join(' ').includes('--disallowedTools Agent,Task'));
  assert.ok(build('codex').args.includes('agents.enabled=false'));
});
