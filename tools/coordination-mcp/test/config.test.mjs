import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadSettings, workerCommand } from '../config.mjs';

const root = resolve(import.meta.dirname, '../../..');
test('worker adapters use native flags without shell interpolation or permission bypass', () => {
  const settings = loadSettings(root);
  for (const engine of ['claude','codex','antigravity']) {
    const spec = workerCommand(settings, {engine,role:'adversary',profile:'reasoning',access:'read-only',workspace:'C:/with spaces/café'});
    assert.ok(!spec.args.join(' ').includes('dangerously'));
    assert.ok(!spec.args.join(' ').includes('bypassPermissions'));
    assert.equal(spec.executable, settings.engines[engine].executable);
    if (engine === 'antigravity') assert.equal(spec.args[spec.args.indexOf('--add-dir')+1], 'C:/with spaces/café');
    if (engine === 'codex') assert.equal(spec.args[spec.args.indexOf('--sandbox')+1], 'read-only');
    if (engine === 'claude') assert.ok(spec.args.includes('--strict-mcp-config'));
  }
  assert.throws(()=>workerCommand(settings,{engine:'unconfigured',role:'developer'}), /engine/i);
  assert.throws(()=>workerCommand(settings,{engine:'antigravity',role:'developer',profile:'balanced',thinking_budget:'max'}), /effort/i);
});

// Per-role overrides are the knob a human edits by hand. A silently-ignored typo
// leaves a worker on the default model while the file claims otherwise, and the
// mistake only shows up as a surprising bill or a weaker review.
// A worker must not reach any MCP server, the coordination one least of all.
// Codex expresses that in config overrides, and the shape matters: setting
// `mcp_servers.<name>.enabled=false` creates a server table with no transport,
// and Codex refuses to load the entire config —
// `Error loading config.toml: invalid transport in mcp_servers.coordination` —
// so every Codex worker died before running. Clearing the whole table works.
test('codex workers are cut off from MCP without producing an unloadable config', () => {
  const settings = loadSettings(root);
  const { args } = workerCommand(settings, {engine:'codex',role:'developer',profile:'balanced',access:'write',workspace:'/tmp/w'});
  assert.ok(args.includes('mcp_servers={}'), 'codex must clear the whole mcp_servers table');
  assert.ok(!args.some(arg => /^mcp_servers\.[^=]+\.[^=]+=/.test(arg)),
    'a partial mcp_servers.<name>.<key> override makes the config unloadable');
  assert.ok(args.includes('agents.enabled=false'), 'codex workers cannot spawn their own agents');
});

test('role overrides reject typos and unknown engines instead of silently falling back', () => {
  const base = loadSettings(root);
  const withRoles = roles => ({...base, roles});
  // The shipped file must itself be valid, and an empty override map is legal.
  assert.ok(validate(withRoles({})).roles);
  assert.equal(Object.keys(base.roles).length, 6, 'every role is pre-populated for editing');
  // The exact mistake this guards: "model" where the schema says "models".
  for (const [label, roles] of Object.entries({
    'singular models key': {adversary:{model:{claude:'opus'}}},
    'unknown top-level key': {adversary:{engines:'claude'}},
    'unknown engine in models': {adversary:{models:{gpt:'x'}}},
    'unknown engine value': {adversary:{engine:'gemini'}},
    'array instead of object': {adversary:[]},
  })) {
    const settings = withRoles(roles);
    assert.throws(() => validate(settings), /role|engine|key/i, `${label} must be rejected`);
  }
});

// Reimplements the file read so the validation can be exercised on an in-memory
// object; loadSettings itself only takes a repository root.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
function validate(settings) {
  const dir = mkdtempSync(resolve(tmpdir(), 'settings-'));
  try {
    mkdirSync(resolve(dir, '.harness'), {recursive: true});
    writeFileSync(resolve(dir, '.harness/settings.json'), JSON.stringify(settings));
    return loadSettings(dir);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

// The supervising runner commits for every engine, so no worker is granted the
// git verbs any more. Claude was the only engine that ever could: leaving that
// grant in place would have let one CLI deliver commits the other two cannot,
// which is exactly the per-engine delivery shape the convention removes.
test('no engine grants a write worker the git verbs; the runner commits instead', () => {
  const settings = loadSettings(root);
  for (const engine of Object.keys(settings.engines)) {
    const { args } = workerCommand(settings, {engine,role:'developer',profile:'balanced',access:'write',workspace:'/tmp/w'});
    assert.ok(!/Bash\(git (add|commit)/.test(args.join(' ')), `${engine} must not grant git mutation to a worker`);
  }
  assert.deepEqual(settings.engines.claude.writeAllowedTools, [],
    'the shipped grant is empty; an adopting project adds its own test runner here');
});

test('writeAllowedTools stays the extension point for the commands a project does need', () => {
  const settings = loadSettings(root);
  const build = engines => workerCommand({...settings,engines},
    {engine:'claude',role:'developer',profile:'balanced',access:'write',workspace:'/tmp/w'});
  const granted = build({...settings.engines,
    claude: {...settings.engines.claude, writeAllowedTools: ['Bash(node --test:*)']}});
  assert.ok(granted.args.includes('--allowedTools'));
  assert.ok(granted.args.includes('Bash(node --test:*)'), 'a configured rule must reach the argv');
  const read = workerCommand(settings, {engine:'claude',role:'adversary',profile:'reasoning',access:'read-only',workspace:'/tmp/w'});
  assert.ok(!read.args.includes('--allowedTools'), 'plan mode already permits the git reads a review needs');
  assert.throws(() => build({...settings.engines,
    claude: {...settings.engines.claude, writeAllowedTools: ['Bash(--dangerously-skip-permissions)']}}), /bypass/i);
});
