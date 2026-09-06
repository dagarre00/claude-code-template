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

test('claude write workers may stage and commit; read-only workers get no write grant', () => {
  const settings = loadSettings(root);
  const write = workerCommand(settings, {engine:'claude',role:'developer',profile:'balanced',access:'write',workspace:'/tmp/w'});
  const read = workerCommand(settings, {engine:'claude',role:'adversary',profile:'reasoning',access:'read-only',workspace:'/tmp/w'});
  // Without this grant acceptEdits writes the files but every git mutation is
  // denied, so the worker delivers no commits and integration rejects it.
  assert.ok(write.args.includes('--allowedTools'));
  assert.ok(write.args.some(arg => arg.startsWith('Bash(git add')));
  assert.ok(write.args.some(arg => arg.startsWith('Bash(git commit')));
  assert.ok(!read.args.includes('--allowedTools'), 'plan mode already permits the git reads a review needs');
  assert.ok(!write.args.join(' ').match(/dangerous|bypassPermissions/i));
  const unsafe = {...settings, engines: {...settings.engines,
    claude: {...settings.engines.claude, writeAllowedTools: ['Bash(--dangerously-skip-permissions)']}}};
  assert.throws(() => workerCommand(unsafe, {engine:'claude',role:'developer',profile:'balanced',access:'write',workspace:'/tmp/w'}), /bypass/i);
});
