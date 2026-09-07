// Conformance suite. Every registered engine is held to the same contract, so a
// newly added adapter proves it honours the worker model instead of being
// trusted. These tests iterate the registry: adding engines/<name>.mjs
// automatically subjects it to all of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadSettings, workerCommand, engineNames } from '../config.mjs';
import { engines } from '../engines/index.mjs';

const root = resolve(import.meta.dirname, '../../..');
const settings = loadSettings(root);
// Deliberately hostile: spaces, an accent, and shell metacharacters that must
// never be interpreted because nothing is ever run through a shell.
const workspace = 'C:/with spaces/café/$(touch pwned)';
const build = (engine, access, extra = {}) => workerCommand(settings, {
  engine, role: access === 'write' ? 'developer' : 'adversary',
  profile: access === 'write' ? 'balanced' : 'reasoning', access, workspace, ...extra,
});

test('the registry and the settings file describe the same set of engines', () => {
  assert.deepEqual([...engineNames].sort(), Object.keys(settings.engines).sort());
  for (const name of engineNames) assert.equal(engines[name].name, name, 'registry key matches adapter name');
});

for (const name of engineNames) {
  test(`${name}: argv is well formed, shell-free, and never bypasses permissions`, () => {
    for (const access of ['read-only', 'write']) {
      const { executable, args } = build(name, access);
      assert.equal(executable, settings.engines[name].executable);
      assert.ok(args.length, 'adapter produced arguments');
      for (const arg of args) {
        assert.equal(typeof arg, 'string', 'every argv entry is a string');
        assert.ok(!/[\0\r\n]/.test(arg), `argv entry must be single-line: ${arg}`);
      }
      assert.ok(!/dangerous|bypassPermissions|--yolo|skip-permissions/i.test(args.join(' ')),
        `${name}/${access} must not request a permission bypass`);
      // If the adapter passes the workspace at all it must appear verbatim as one
      // argv element — never concatenated into a string a shell could resplit.
      if (args.join(' ').includes('café')) {
        assert.ok(args.includes(workspace), `${name} must pass the workspace as a single argv element`);
      }
    }
  });

  test(`${name}: read-only and write access produce materially different commands`, () => {
    // Hold role, profile, model and effort identical and vary ONLY access, so the
    // difference cannot come from a differing model. An earlier version of this
    // test varied the role alongside access and passed against an adapter that
    // ignored access entirely — the argv differed because the model did.
    const fixed = access => JSON.stringify(workerCommand(settings, {
      engine: name, role: 'developer', profile: 'balanced', access, workspace,
    }).args);
    // An adapter that ignores access would hand a reviewer the same powers as an
    // implementer. The control plane still rejects read-only commits at merge,
    // but the CLI should not have been able to make them in the first place.
    assert.notEqual(fixed('read-only'), fixed('write'), `${name} must distinguish read-only from write`);
  });

  test(`${name}: a declared terminal argument stays last in every argv`, () => {
    const adapter = engines[name];
    if (!adapter.terminal) return; // Engines with no positional prompt marker.
    // Some CLIs take the prompt as an optional inline value on a trailing flag
    // (agy's --print, codex's -). Anything emitted after it is swallowed as that
    // value and the real stdin prompt is silently ignored — agy exits 2 with
    // "--print took \"--effort\" as its prompt". Model and effort are appended
    // conditionally, so this must hold for every combination, not just defaults.
    for (const access of ['read-only', 'write']) {
      for (const extra of [{}, { model_override: 'some-model' }, { thinking_budget: adapter.efforts[0] },
        { model_override: 'some-model', thinking_budget: adapter.efforts[0] }]) {
        const { args } = build(name, access, extra);
        assert.equal(args[args.length - 1], adapter.terminal,
          `${name} must end with ${adapter.terminal} (got ${args.slice(-3).join(' ')})`);
      }
    }
  });

  test(`${name}: declares how the runner must frame the prompt on stdin`, () => {
    const { promptFormat } = build(name, 'write');
    assert.ok(['text','stream-json'].includes(promptFormat), `${name} resolves a prompt format`);
    // A CLI that cannot take the prompt on stdin would cap it at the OS command
    // line limit — agy's text mode puts the prompt in --print, and a worker
    // prompt is 10KB+ before any instructions. stream-json avoids that entirely.
    if (promptFormat === 'stream-json') {
      const { args } = build(name, 'write');
      assert.ok(args.includes('--input-format') || args.includes('-c'),
        `${name} must actually request the framed input mode it declares`);
    }
  });

  test(`${name}: effort and model resolve through the declared vocabulary`, () => {
    const adapter = engines[name];
    assert.ok(adapter.efforts.length, 'adapter declares an effort vocabulary');
    for (const effort of adapter.efforts) {
      assert.equal(build(name, 'write', { thinking_budget: effort }).effort, effort);
    }
    assert.throws(() => build(name, 'write', { thinking_budget: 'not-a-real-effort' }),
      /effort/i, `${name} must reject an effort outside its vocabulary`);
    // A model override must reach the argv, or per-role configuration is a lie.
    const pinned = build(name, 'write', { model_override: 'pinned-model-1' });
    assert.equal(pinned.model, 'pinned-model-1');
    assert.ok(pinned.args.includes('pinned-model-1'), `${name} must pass an overridden model through`);
    assert.throws(() => build(name, 'write', { model_override: 'bad model; rm -rf /' }), /model/i);
  });
}

test('an adapter that tries to smuggle a bypass flag is rejected by workerCommand', () => {
  const honest = {...settings, engines: {...settings.engines, claude: {...settings.engines.claude,
    writeAllowedTools: ['Bash(git add:*)']}}};
  // Sanity: the honest path still works, so the next assertion isolates the bypass.
  assert.ok(workerCommand(honest, {engine:'claude',role:'developer',profile:'balanced',access:'write',workspace}).args.length);
  const bypass = {...settings, engines: {...settings.engines, claude: {...settings.engines.claude,
    writeAllowedTools: ['Bash(claude --dangerously-skip-permissions)']}}};
  assert.throws(() => workerCommand(bypass, {engine:'claude',role:'developer',profile:'balanced',access:'write',workspace}), /bypass/i);
});
