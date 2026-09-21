// The config loader's contract, as a pure function of an object — the config
// editor validates a candidate before it touches disk, so validation cannot
// require a file. Each rejection below is a mistake that used to load cleanly
// and misbehave later: a typo'd key silently ignored, or an effort the engine
// does not accept that only failed when a worker was dispatched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, validateConfig } from '../config.mjs';
import { cleanup, fixture } from './helpers.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const shipped = () => JSON.parse(readFileSync(resolve(REPO, '.agents/config.json'), 'utf8'));

const base = () => ({
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-pro', balanced: 'gemini-3.8-pro', fast: 'gemini-3.8-flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
});

test('validateConfig validates an object without a file, and loadConfig still reads one', () => {
  assert.equal(validateConfig(base()).version, 1);
  const root = fixture({ '.agents/config.json': JSON.stringify(base()) });
  try { assert.equal(loadConfig(root).workerTimeoutSeconds, 1800); } finally { cleanup(root); }
});

test('a config that is not an object is refused by name, not with a TypeError', () => {
  for (const value of [null, [], 'text', 3]) {
    assert.throws(() => validateConfig(value), /must be a JSON object/);
  }
});

test('an unknown top-level key is rejected, naming the key and what is accepted', () => {
  // `worktreeSetups` (plural) used to load and do nothing, so setup never ran.
  assert.throws(() => validateConfig({ ...base(), worktreeSetups: ['npm ci'] }),
    /Unknown key "worktreeSetups" in \.agents\/config\.json.*worktreeSetup/s);
  assert.throws(() => validateConfig({ ...base(), protectedPath: ['docs'] }), /Unknown key "protectedPath"/);
});

test('"$comment" is the one free-text key: it is accepted, and only as a string', () => {
  assert.equal(validateConfig({ ...base(), $comment: 'Edit with: node tools/workflow-mcp/config-ui.mjs' }).version, 1);
  assert.throws(() => validateConfig({ ...base(), $comment: ['a'] }), /\$comment must be a string/);
});

test('an unknown key inside an engine block is rejected', () => {
  const config = base();
  config.engines.claude.model = 'opus'; // "model" for "models": the loader's own named example
  assert.throws(() => validateConfig(config), /Unknown key "model" in engines\.claude/);
});

test('an effort the engine does not accept fails at load, not at dispatch', () => {
  const engineLevel = base();
  engineLevel.engines.antigravity.effort.fast = 'max'; // agy accepts low, medium, high
  assert.throws(() => validateConfig(engineLevel),
    /engines\.antigravity\.effort\.fast.*"max".*low, medium, high/s);

  const roleLevel = base();
  roleLevel.roles.developer = { engine: 'codex', models: {}, effort: { codex: 'max' } };
  assert.throws(() => validateConfig(roleLevel), /roles\.developer\.effort\.codex.*"max"/s);

  const ok = base();
  ok.engines.claude.effort.reasoning = 'max'; // claude accepts it
  ok.roles.developer = { engine: 'codex', models: {}, effort: { codex: 'minimal' } };
  assert.doesNotThrow(() => validateConfig(ok));
});

test('null means "use the default" for a model or an effort, and stays legal', () => {
  const config = base();
  config.engines.codex.effort.fast = null;
  config.roles.developer = { engine: null, models: { claude: null }, effort: { claude: null } };
  assert.doesNotThrow(() => validateConfig(config));
});

test('a model id that could reach a command line as more than an id fails at load', () => {
  const engineLevel = base();
  engineLevel.engines.claude.models.fast = 'haiku; rm -rf /';
  assert.throws(() => validateConfig(engineLevel), /engines\.claude\.models\.fast/);

  const roleLevel = base();
  roleLevel.roles.planner = { engine: 'claude', models: { claude: 'opus --dangerous' }, effort: {} };
  assert.throws(() => validateConfig(roleLevel), /roles\.planner\.models\.claude/);
});

test('the config this template ships is valid, so the editor opens on a working file', () => {
  assert.doesNotThrow(() => validateConfig(shipped()));
});
