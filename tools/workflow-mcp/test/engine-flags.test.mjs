// The flags each engine's adapter passes on every run, described for a human.
// They are read-only on purpose: the ones that make a read-only role read-only,
// or stop a worker starting another worker, must not be editable from a config
// file — least of all one a web page can write. So the page shows them instead,
// and this file makes sure what it shows is what the adapters really pass: the
// list is built by running the adapters, and a flag with no explanation, or an
// explanation for a flag that is gone, fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeFlags } from '../engine-flags.mjs';
import { ENGINES, engineNames } from '../engines/index.mjs';
import { startConfigServer } from '../config-ui.mjs';
import { cleanup, fixture } from './helpers.mjs';

const row = (name, key) => describeFlags(name).rows.find(entry => entry.key === key);

test('every flag an adapter passes is explained, and no explanation outlives its flag', () => {
  for (const name of engineNames) {
    const { unexplained, stale } = describeFlags(name);
    assert.deepEqual(unexplained, [], `${name} passes flags that engine-flags.mjs does not explain`);
    assert.deepEqual(stale, [], `engine-flags.mjs explains flags ${name} no longer passes`);
  }
});

test('the flags that carry a guarantee are all present, and marked as guarantees', () => {
  const guarantees = {
    claude: ['--safe-mode', '--permission-mode', '--disallowedTools'],
    codex: ['--sandbox', '-c project_doc_max_bytes', '-c mcp_servers', '-c agents.enabled'],
    antigravity: ['--agent', '--mode']
  };
  for (const [name, keys] of Object.entries(guarantees)) {
    for (const key of keys) assert.equal(row(name, key)?.kind, 'guarantee', `${name} ${key}`);
  }
});

test('where a flag\'s value depends on the role\'s access, both values are shown', () => {
  assert.deepEqual(row('claude', '--permission-mode').byAccess, { 'read-only': 'dontAsk', write: 'acceptEdits' });
  assert.deepEqual(row('codex', '--sandbox').byAccess, { 'read-only': 'read-only', write: 'workspace-write' });
  assert.deepEqual(row('antigravity', '--mode').byAccess, { 'read-only': 'plan', write: 'accept-edits' });
  assert.equal(row('claude', '--safe-mode').byAccess, null, 'a flag that does not differ is shown once');
});

test('the flags that come from the config say so, and show a placeholder rather than a value', () => {
  const fromConfig = {
    claude: ['--model', '--effort', '--allowedTools'],
    codex: ['--model', '-c model_reasoning_effort', '-c tool_output_token_limit', '-c model_auto_compact_token_limit'],
    antigravity: ['--model', '--effort', '--print-timeout']
  };
  for (const [name, keys] of Object.entries(fromConfig)) {
    for (const key of keys) {
      const entry = row(name, key);
      assert.equal(entry?.kind, 'config', `${name} ${key}`);
      assert.match(entry.value, /^.*<.+>.*$/, `${name} ${key} shows a placeholder, not somebody's value`);
    }
  }
  assert.equal(row('codex', '-c tool_output_token_limit').when, 'only when set in the config');
  assert.equal(row('claude', '--model').when, null);
});

test('the description is the same on every machine: none of the placeholders used to build it leak out', () => {
  for (const name of engineNames) {
    const text = JSON.stringify(describeFlags(name));
    // The model in the sample command is a real id the engine runs (the launcher refuses any other).
    for (const leaked of [ENGINES[name].knownModels[0], 'CMD1', 'CMD2']) assert.ok(!text.includes(leaked), `${name} leaks ${leaked}`);
    assert.deepEqual(describeFlags(name), describeFlags(name));
  }
});

test('every row says what kind of flag it is and why it is there', () => {
  for (const name of engineNames) {
    for (const entry of describeFlags(name).rows) {
      assert.ok(['guarantee', 'config', 'plumbing', 'hygiene'].includes(entry.kind), `${name} ${entry.key}: ${entry.kind}`);
      assert.ok(entry.why.length > 20, `${name} ${entry.key} has no real explanation`);
      assert.ok(entry.label, `${name} ${entry.key} has no label`);
    }
  }
});

test('the editor\'s server hands the page every engine\'s flags', async () => {
  const root = fixture({ '.agents/config.json': '{}' });
  const editor = await startConfigServer(root, { port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${editor.port}/api/config`, { headers: { 'X-Config-Token': editor.token } });
    const { meta } = await res.json();
    assert.deepEqual(Object.keys(meta.flags).sort(), [...engineNames].sort());
    assert.deepEqual(meta.flags.codex, JSON.parse(JSON.stringify(describeFlags('codex'))));
  } finally { await editor.close(); cleanup(root); }
});

test('the guide names every flag that carries a guarantee', () => {
  const guide = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../config.md'), 'utf8');
  for (const name of engineNames) {
    for (const entry of describeFlags(name).rows.filter(candidate => candidate.kind === 'guarantee')) {
      assert.ok(guide.includes(entry.label), `config.md does not name ${name}'s ${entry.label}`);
    }
  }
});
