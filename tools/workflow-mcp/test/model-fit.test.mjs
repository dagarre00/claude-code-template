// An engine can only run its own models. Every place that names one — a profile
// default, a role's pin, a per-dispatch override, the editor's dropdown — used to
// check only that the id was well-formed, so a Codex id under `antigravity` loaded
// cleanly, rendered in the editor as that engine's model, and failed when a worker
// was launched with it. The link between an engine and its models is declared once,
// on the adapter, and every one of those places asks the same question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, engineNames, buildCommand } from '../engines/index.mjs';
import { validateConfig } from '../config.mjs';
import { enginesFor, explainMisfit, modelFits } from '../model-fit.mjs';
import { prepareDispatch } from '../dispatch.mjs';
import { resolve } from 'node:path';
import { cleanup, fixture } from './helpers.mjs';

const efforts = { reasoning: 'high', balanced: 'medium', fast: 'low' };
const base = () => ({
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'], roles: {},
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'claude-opus-5', balanced: 'sonnet', fast: 'haiku' }, effort: { ...efforts } },
    codex: { executable: 'codex', models: { reasoning: 'gpt-6-astra', balanced: 'gpt-5.6-terra', fast: null }, effort: { ...efforts } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-flash', balanced: 'gemini-3.8-flash', fast: 'inherit' }, effort: { ...efforts } }
  }
});

test('every adapter declares the models it runs, and offers only ones it would accept', () => {
  for (const name of engineNames) {
    const adapter = ENGINES[name];
    assert.ok(Array.isArray(adapter.modelPrefixes) && adapter.modelPrefixes.length
      && adapter.modelPrefixes.every(prefix => typeof prefix === 'string' && prefix), `${name} declares no modelPrefixes`);
    for (const id of [...adapter.knownModels, ...Object.keys(adapter.modelAliases ?? {})]) {
      assert.ok(modelFits(adapter, id), `${name} lists ${id} in its dropdown but would refuse it`);
    }
  }
});

test('a Codex model does not fit Antigravity, and neither engine borrows the other\'s', () => {
  assert.equal(modelFits(ENGINES.antigravity, 'gpt-5.6-sol'), false);
  assert.equal(modelFits(ENGINES.codex, 'gpt-5.6-sol'), true);
  assert.equal(modelFits(ENGINES.codex, 'gemini-3.8-flash'), false);
  assert.equal(modelFits(ENGINES.claude, 'gemini-3.8-flash'), false);
  assert.equal(modelFits(ENGINES.claude, 'gpt-6-astra'), false);
  assert.deepEqual(enginesFor(ENGINES, 'gpt-5.6-sol'), ['codex']);
});

test('what agy itself lists is accepted: it serves Claude and GPT-OSS models next to Gemini ones', () => {
  assert.equal(modelFits(ENGINES.antigravity, 'claude-sonnet-4-6'), true);
  assert.deepEqual(enginesFor(ENGINES, 'claude-sonnet-4-6').sort(), ['antigravity', 'claude']);
  assert.equal(modelFits(ENGINES.antigravity, 'gpt-oss-120b'), true);
});

test('gpt-oss is agy\'s, not codex\'s: an engine can take a family and leave out one inside it', () => {
  assert.equal(modelFits(ENGINES.codex, 'gpt-oss-120b'), false, 'codex takes gpt- but not the open-weight family');
  assert.deepEqual(enginesFor(ENGINES, 'gpt-oss-120b'), ['antigravity']);
  assert.equal(modelFits(ENGINES.codex, 'gpt-7-nova'), true, 'and a generation nobody has written down yet still fits');
  assert.match(explainMisfit(ENGINES, 'codex', 'gpt-oss-120b'), /not a codex model.*gpt-oss.*belongs to antigravity/s);
});

// Captured from the real tools on 2026-09-21 (`agy models`, `codex debug models`). When a tool starts
// listing something an adapter would refuse, this is the test that says so — before a user picks it in
// the editor and is told it will not run.
const AGY_MODELS = [
  'Fetching available models...',
  'gemini-3.8-flash-high\tGemini 3.8 Flash (High)', 'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)',
  'gemini-3.8-flash-low\tGemini 3.8 Flash (Low)', 'gemini-3.7-flash-high\tGemini 3.7 Flash (High)',
  'gemini-3.6-flash-low\tGemini 3.6 Flash (Low)', 'gemini-3.1-pro-high\tGemini 3.1 Pro (High)',
  'gemini-3.1-pro-low\tGemini 3.1 Pro (Low)', 'claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)',
  'claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)', 'gpt-oss-120b-medium\tGPT-OSS 120B (Medium)', ''
].join('\n');
const CODEX_MODELS = JSON.stringify({ models: ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']
  .map(slug => ({ slug, display_name: slug, visibility: 'list' })) });

test('every model the real tools list fits their own engine, and no other engine\'s own models', () => {
  const agy = ENGINES.antigravity.listModels.parse(AGY_MODELS).map(model => model.id);
  const codex = ENGINES.codex.listModels.parse(CODEX_MODELS).map(model => model.id);
  assert.ok(agy.includes('gpt-oss-120b') && agy.includes('claude-opus-4-6-thinking'), 'the fixture is the real, mixed list');
  for (const id of agy) assert.ok(modelFits(ENGINES.antigravity, id), `agy lists ${id}, which the adapter would refuse`);
  for (const id of codex) {
    assert.ok(modelFits(ENGINES.codex, id), `codex lists ${id}, which the adapter would refuse`);
    assert.equal(modelFits(ENGINES.antigravity, id), false, `${id} is a codex model and must not fit antigravity`);
    assert.equal(modelFits(ENGINES.claude, id), false, `${id} is a codex model and must not fit claude`);
  }
  for (const id of agy) assert.equal(modelFits(ENGINES.codex, id), false, `${id} is served by agy, not codex`);
});

test('inherit is no model at all, so it fits every engine; a blank or a non-string fits none', () => {
  for (const name of engineNames) assert.equal(modelFits(ENGINES[name], 'inherit'), true);
  assert.equal(modelFits(ENGINES.codex, ''), false);
  assert.equal(modelFits(ENGINES.codex, null), false);
  assert.equal(modelFits(ENGINES.codex, 42), false);
});

test('the match ignores case and needs the prefix at the start, not anywhere', () => {
  assert.equal(modelFits(ENGINES.codex, 'GPT-6-Astra'), true);
  assert.equal(modelFits(ENGINES.codex, 'my-gpt-6'), false);
});

test('the explanation names the engine, the id, and whose model it is', () => {
  const text = explainMisfit(ENGINES, 'antigravity', 'gpt-5.6-sol');
  assert.match(text, /gpt-5\.6-sol/);
  assert.match(text, /not an? antigravity model/i);
  assert.match(text, /codex/, 'says where the model does belong');
  assert.match(explainMisfit(ENGINES, 'antigravity', 'nonsense-1'), /not an? antigravity model/i);
  assert.doesNotMatch(explainMisfit(ENGINES, 'antigravity', 'nonsense-1'), /belongs to/i, 'no owner, no claim about one');
});

// ─── the loader ────────────────────────────────────────────────────────────

test('a profile default under the wrong engine is refused at load, naming where it is', () => {
  const config = base();
  config.engines.antigravity.models.reasoning = 'gpt-5.6-sol';
  assert.throws(() => validateConfig(config),
    /engines\.antigravity\.models\.reasoning.*gpt-5\.6-sol.*not an antigravity model.*codex/s);
});

test('a role pin under the wrong engine is refused at load, naming where it is', () => {
  const config = base();
  config.roles.developer = { engine: ['antigravity', 'codex'], models: { antigravity: 'gpt-5.6-sol' }, effort: {} };
  assert.throws(() => validateConfig(config), /roles\.developer\.models\.antigravity.*gpt-5\.6-sol.*not an antigravity model/s);
});

test('the same id is fine under the engine that owns it, and blanks and inherit are still legal', () => {
  const config = base();
  config.roles.developer = { engine: ['antigravity', 'codex'],
    models: { antigravity: 'gemini-3.1-pro', codex: 'gpt-5.6-sol', claude: null }, effort: {} };
  assert.equal(validateConfig(config).roles.developer.models.codex, 'gpt-5.6-sol');
});

// ─── the launch ────────────────────────────────────────────────────────────

const agent = { name: 'workflow-developer', dir: '/tmp/dispatch/agent' };
const settings = () => ({ workerTimeoutSeconds: 1800, workerCommands: ['npm test'], engines: base().engines });
const task = { profile: 'balanced', access: 'write', workspace: '/tmp/wt', agent };

test('a command is never built with another engine\'s model, however the model got there', () => {
  assert.throws(() => buildCommand(settings(), { engine: 'antigravity', ...task, model: 'gpt-5.6-sol' }),
    /not an antigravity model/i);
  const drifted = settings();
  drifted.engines.antigravity.models.balanced = 'gpt-5.6-sol';
  assert.throws(() => buildCommand(drifted, { engine: 'antigravity', ...task }), /not an antigravity model/i,
    'a config that was never validated is caught here');
  assert.ok(buildCommand(settings(), { engine: 'codex', ...task, model: 'gpt-5.6-sol' }).args.includes('gpt-5.6-sol'));
});

const ABSENT = 'workflow-mcp-definitely-not-installed';
const withRepo = (roles, fn) => {
  const config = base();
  config.engines.codex.executable = ABSENT;
  config.engines.claude.executable = process.execPath;
  config.roles = roles;
  const root = fixture({ '.agents/config.json': JSON.stringify(config) });
  try { return fn(root); } finally { cleanup(root); }
};

test('a model_override meant for one engine is refused when the chain falls through to another', () => {
  withRepo({ developer: { engine: ['codex', 'claude'] } }, root => {
    const input = { role: 'developer', instructions: 'Implement login.', owned_paths: ['src'],
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') };
    // codex is not installed, so this dispatch would run on claude — with a codex model.
    assert.throws(() => prepareDispatch(root, { ...input, model_override: 'gpt-5.6-sol' }),
      /model_override.*gpt-5\.6-sol.*claude.*cli_engine/s,
      'says which engine ran, and that cli_engine pins the one the override is for');
    assert.equal(prepareDispatch(root, { ...input, model_override: 'gpt-5.6-sol', cli_engine: 'codex' }).engine, 'codex',
      'naming the engine the override is for is the way through');
    assert.equal(prepareDispatch(root, { ...input, model_override: 'claude-sonnet-5' }).engine, 'claude');
  });
});
