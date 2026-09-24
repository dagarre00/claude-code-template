// The role card's rows and the model lists behind its dropdowns. A row is one engine
// a role tries, with its model and effort; adding one has to write real values, not
// leave the role quietly leaning on a default the page never shows. And the model
// lists have to come from the tools themselves where they can say, because a list
// typed into this repository is stale the day a model ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startConfigServer } from '../config-ui.mjs';
import { addToChain, assembleConfig, chainRows, enginesForRow, foreignModels, formToRole, modelChoices, nextUnusedEngine,
  removeFromChain, replaceEngine, roleToForm, staleModels } from '../config-ui/model.mjs';
import { ENGINES as ADAPTERS } from '../engines/index.mjs';
import { cleanup, fixture } from './helpers.mjs';

const NAMES = ['claude', 'codex', 'antigravity'];
const config = () => ({
  defaultEngine: 'antigravity',
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'claude-opus-5', balanced: 'claude-sonnet-5', fast: 'claude-haiku-4-5-20251001' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: 'gpt-6-astra', balanced: 'gpt-5.6-terra', fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: null } },
    antigravity: { executable: 'agy', models: { reasoning: 'gemini-3.8-flash', balanced: 'gemini-3.8-flash', fast: 'gemini-3.8-flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
});

// ─── rows ──────────────────────────────────────────────────────────────────

test('adding an engine to a role writes its model and effort down, so what the row shows is what runs', () => {
  const form = roleToForm({ engine: 'claude', models: {}, effort: {} }, NAMES);
  addToChain(form, 'codex', config(), 'reasoning', NAMES);
  assert.deepEqual(chainRows(form, NAMES).used, ['claude', 'codex']);
  assert.deepEqual(formToRole(form, NAMES), {
    engine: ['claude', 'codex'], models: { codex: 'gpt-6-astra' }, effort: { codex: 'high' }
  }, 'the added row is pinned; the untouched one is not rewritten');
});

test('adding an engine keeps a pin the role already had for it, and pins nothing where the engine has no default', () => {
  const form = roleToForm({ engine: 'claude', models: { codex: 'gpt-5.6-luna' }, effort: {} }, NAMES);
  addToChain(form, 'codex', config(), 'fast', NAMES);
  assert.equal(form.models.codex, 'gpt-5.6-luna', 'an earlier choice is not overwritten');
  assert.equal(form.effort.codex, '', 'no default effort for this tier on codex: nothing is invented');
});

test('"inherit" joins a chain with no model or effort, since it has neither', () => {
  const form = roleToForm({ engine: 'claude', models: {}, effort: {} }, NAMES);
  addToChain(form, 'inherit', config(), 'balanced', NAMES);
  assert.deepEqual(formToRole(form, NAMES), { engine: ['claude', 'inherit'], models: {}, effort: {} });
});

test('an engine cannot be added twice', () => {
  const form = roleToForm({ engine: ['claude', 'codex'], models: {}, effort: {} }, NAMES);
  const before = structuredClone(form);
  addToChain(form, 'codex', config(), 'balanced', NAMES);
  assert.deepEqual(form, before);
});

test('the engine dropdown of a row offers that row\'s engine and the unused ones, never one already in another row', () => {
  const form = roleToForm({ engine: ['claude', 'codex'], models: {}, effort: {} }, NAMES);
  assert.deepEqual(enginesForRow(form, 'claude', NAMES), ['inherit', 'claude', 'antigravity']);
  assert.deepEqual(enginesForRow(form, 'codex', NAMES), ['inherit', 'codex', 'antigravity']);
});

test('the "add" button takes the first engine not yet used, and there is none once all are', () => {
  const form = roleToForm({ engine: ['claude', 'inherit'], models: {}, effort: {} }, NAMES);
  assert.equal(nextUnusedEngine(form, NAMES), 'codex');
  addToChain(form, 'codex', config(), 'balanced', NAMES);
  addToChain(form, 'antigravity', config(), 'balanced', NAMES);
  assert.equal(nextUnusedEngine(form, NAMES), null);
});

test('changing a row\'s engine keeps its place in the order and fills the new engine\'s values', () => {
  const form = roleToForm({ engine: ['claude', 'codex', 'antigravity'], models: { claude: 'claude-sonnet-5' }, effort: { claude: 'low' } }, NAMES);
  replaceEngine(form, 'codex', 'inherit', config(), 'balanced', NAMES);
  assert.deepEqual(chainRows(form, NAMES).used, ['claude', 'inherit', 'antigravity']);
  replaceEngine(form, 'claude', 'codex', config(), 'balanced', NAMES);
  assert.deepEqual(chainRows(form, NAMES).used, ['codex', 'inherit', 'antigravity'], 'still first');
  assert.equal(form.models.codex, 'gpt-5.6-terra');
  assert.equal(form.effort.codex, 'medium');
  assert.equal(form.models.claude, 'claude-sonnet-5', 'the engine it left keeps its pin, so nothing is lost');
});

test('changing a row to an engine another row already uses does nothing', () => {
  const form = roleToForm({ engine: ['claude', 'codex'], models: {}, effort: {} }, NAMES);
  const before = structuredClone(form);
  replaceEngine(form, 'claude', 'codex', config(), 'balanced', NAMES);
  assert.deepEqual(form, before);
});

test('a value the page filled in and the human never touched is not kept once its row is gone', () => {
  const original = { engine: 'claude', models: {}, effort: {} };
  const form = roleToForm(original, NAMES);
  addToChain(form, 'codex', config(), 'reasoning', NAMES);
  removeFromChain(form, 'codex', NAMES);
  assert.deepEqual(formToRole(form, NAMES), original, 'looking at a row and removing it leaves the role as it was');
});

test('a value the human chose survives its row being removed', () => {
  const form = roleToForm({ engine: 'claude', models: {}, effort: {} }, NAMES);
  addToChain(form, 'codex', config(), 'reasoning', NAMES);
  form.models.codex = 'gpt-5.5';
  removeFromChain(form, 'codex', NAMES);
  assert.deepEqual(formToRole(form, NAMES).models, { codex: 'gpt-5.5' });
});

test('unticking "use the default engine" and ticking it again leaves the role exactly as it was', () => {
  const config_ = config();
  const form = roleToForm({ engine: null, models: {}, effort: {} }, NAMES);
  form.follow = false;
  addToChain(form, 'antigravity', config_, 'fast', NAMES);
  form.follow = true;
  assert.deepEqual(formToRole(form, NAMES), { engine: null, models: {}, effort: {} });
  // ...and so a role nobody customized is still not added to the file.
  assert.deepEqual(assembleConfig({ roles: {} }, { researcher: form }, NAMES).roles, {});
});

test('a role that was written by hand in another shape is kept as it was while it means the same thing', () => {
  const raw = { engine: ['claude'], models: {}, effort: {} };
  const form = roleToForm(raw, NAMES);
  addToChain(form, 'codex', config(), 'balanced', NAMES);
  removeFromChain(form, 'codex', NAMES);
  assert.deepEqual(assembleConfig({ roles: { planner: raw } }, { planner: form }, NAMES).roles.planner, raw);
});

test('a role key the page does not edit survives a save that changes the role', () => {
  const raw = { engine: 'claude', models: {}, effort: {}, extraSkills: ['design-system-check'] };
  const form = roleToForm(raw, NAMES);
  addToChain(form, 'codex', config(), 'balanced', NAMES);
  const saved = assembleConfig({ roles: { developer: raw } }, { developer: form }, NAMES).roles.developer;
  assert.deepEqual(saved.engine, ['claude', 'codex']);
  assert.deepEqual(saved.extraSkills, ['design-system-check']);
});

// ─── where the model lists come from ───────────────────────────────────────

test('codex\'s model list is read from its own catalog, hidden models left out', () => {
  const out = JSON.stringify({ models: [
    { slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', description: 'Our most capable model.', visibility: 'list' },
    { slug: 'gpt-reserve', display_name: 'GPT-Reserve', visibility: 'hide' },
    { slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }
  ] });
  const { args, parse } = ADAPTERS.codex.listModels;
  assert.deepEqual(args, ['debug', 'models']);
  assert.deepEqual(parse(out), [{ id: 'gpt-6-astra', label: 'GPT-6-Astra' }, { id: 'gpt-5.5', label: 'GPT-5.5' }]);
  assert.throws(() => parse('not json'), /not JSON|catalog/i);
  assert.throws(() => parse('{"models": "no"}'), /catalog/i);
});

test('antigravity\'s list folds its effort variants into one model, because effort is a separate setting', () => {
  const out = [
    'gemini-3.8-flash-high\tGemini 3.8 Flash (High)', 'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)',
    'gemini-3.8-flash-low\tGemini 3.8 Flash (Low)', 'gemini-3.1-pro-high\tGemini 3.1 Pro (High)',
    'gemini-3.1-pro-low\tGemini 3.1 Pro (Low)', 'claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)',
    'Fetching available models...', ''
  ].join('\n');
  const { args, parse } = ADAPTERS.antigravity.listModels;
  assert.deepEqual(args, ['models']);
  assert.deepEqual(parse(out), [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Thinking)' }
  ]);
  assert.throws(() => parse('nothing useful here'), /no models/i);
});

test('claude has no list command, so it offers aliases that always mean the newest model of that family', () => {
  assert.equal(ADAPTERS.claude.listModels, undefined);
  assert.ok(Object.keys(ADAPTERS.claude.modelAliases).includes('opus'));
  assert.ok(Object.keys(ADAPTERS.claude.modelAliases).includes('sonnet'));
  for (const note of Object.values(ADAPTERS.claude.modelAliases)) assert.equal(typeof note, 'string');
});

// ─── the endpoint ──────────────────────────────────────────────────────────

const call = (editor, path, { method = 'POST', body = {}, token = editor.token, type = 'application/json' } = {}) =>
  new Promise((done, fail) => {
    const payload = JSON.stringify(body);
    const req = request({ host: '127.0.0.1', port: editor.port, path, method, headers: {
      Host: `127.0.0.1:${editor.port}`, ...(token ? { 'X-Config-Token': token } : {}),
      'Content-Type': type, 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => { let json = null; try { json = JSON.parse(data); } catch { /* not JSON */ } done({ status: res.statusCode, json }); });
    });
    req.on('error', fail);
    req.end(payload);
  });

const withLists = async (runList, fn, text = JSON.stringify(config())) => {
  const root = fixture({ '.agents/config.json': text });
  const editor = await startConfigServer(root, { port: 0, runList });
  try { return await fn(editor); } finally { await editor.close(); cleanup(root); }
};

test('asking for the model lists runs each engine\'s own list command from the saved config and parses what it prints', async () => {
  const calls = [];
  const runList = async (executable, args) => {
    calls.push([executable, ...args].join(' '));
    return executable === 'codex'
      ? JSON.stringify({ models: [{ slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', visibility: 'list' }] })
      : 'gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n';
  };
  await withLists(runList, async editor => {
    const { status, json } = await call(editor, '/api/models');
    assert.equal(status, 200);
    assert.deepEqual(json.engines.codex, { ok: true, models: [{ id: 'gpt-6-astra', label: 'GPT-6-Astra' }] });
    assert.deepEqual(json.engines.antigravity, { ok: true, models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }] });
    assert.equal(json.engines.claude.ok, false, 'no list command');
    assert.match(json.engines.claude.reason, /no command/i);
    assert.deepEqual(calls.sort(), ['agy models', 'codex debug models']);
  });
});

test('an engine whose list cannot be fetched is reported and the others still answer', async () => {
  const runList = async executable => {
    if (executable === 'codex') throw new Error('spawn codex ENOENT');
    return 'gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n';
  };
  await withLists(runList, async editor => {
    const { json } = await call(editor, '/api/models');
    assert.deepEqual(json.engines.codex, { ok: false, reason: 'spawn codex ENOENT' });
    assert.equal(json.engines.antigravity.ok, true);
  });
});

test('output the adapter cannot read is reported, not passed along', async () => {
  await withLists(async () => 'garbage', async editor => {
    const { json } = await call(editor, '/api/models');
    assert.equal(json.engines.codex.ok, false);
    assert.equal(json.engines.antigravity.ok, false);
  });
});

test('the list command runs only the executable the saved config names, and never a shim', async () => {
  const seen = [];
  const custom = config();
  custom.engines.codex.executable = 'C:\\tools\\codex.cmd';
  custom.engines.antigravity.executable = '/opt/agy/bin/agy';
  await withLists(async executable => { seen.push(executable); return 'x\ty\n'; }, async editor => {
    const { json } = await call(editor, '/api/models');
    assert.deepEqual(seen, ['/opt/agy/bin/agy']);
    assert.match(json.engines.codex.reason, /shim|executable/i);
  }, JSON.stringify(custom));
});

test('the model lists are behind the token and need a JSON request', async () => {
  await withLists(async () => '', async editor => {
    assert.equal((await call(editor, '/api/models', { token: null })).status, 403);
    assert.equal((await call(editor, '/api/models', { token: 'wrong' })).status, 403);
    assert.equal((await call(editor, '/api/models', { type: 'text/plain' })).status, 415);
    assert.equal((await call(editor, '/api/models', { method: 'GET' })).status, 404, 'it runs a program, so a plain GET never does');
  });
});

// ─── noticing a model that has gone ────────────────────────────────────────

test('a configured model the tool no longer lists is reported with everywhere it is used', () => {
  const c = config();
  c.roles = { planner: { engine: 'codex', models: { codex: 'gpt-old', claude: 'opus' }, effort: {} } };
  c.engines.codex.models.fast = 'gpt-old';
  const found = staleModels(c, { codex: ['gpt-6-astra', 'gpt-5.6-terra'], claude: ['opus', 'sonnet', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'] });
  assert.deepEqual(found, [{ engine: 'codex', id: 'gpt-old', where: ['engines.codex.models.fast', 'roles.planner.models.codex'] }],
    'only the one that is missing, once, and no engine without a list');
});

test('an engine whose list is not known is never accused, and blanks and inherit are not models', () => {
  const c = config();
  c.roles = { planner: { engine: 'inherit', models: { codex: '', antigravity: 'inherit' }, effort: {} } };
  assert.deepEqual(staleModels(c, {}), []);
  assert.deepEqual(staleModels(c, { codex: ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'] }), []);
});

// ─── a model belongs to one engine ─────────────────────────────────────────
// An engine's dropdown offers its own models and nobody else's, and a model that is
// under the wrong engine is shown as that, with a way to clear it, rather than being
// quietly offered as if it fitted. The rule is the launcher's (model-fit.mjs).

// The page's copy of each adapter: what the server sends as `meta.engines`.
const SPECS = Object.fromEntries(NAMES.map(name => [name,
  { modelPrefixes: ADAPTERS[name].modelPrefixes, modelExcludes: ADAPTERS[name].modelExcludes ?? [] }]));

test('an engine\'s dropdown drops any id that does not fit it, wherever the id came from', () => {
  const c = config();
  c.engines.antigravity.models.reasoning = 'gpt-5.6-sol';
  c.roles = { developer: { engine: ['antigravity'], models: { antigravity: 'gpt-5.6-terra' }, effort: {} } };
  const choices = modelChoices('antigravity', c, ['gemini-3.8-flash', 'gpt-5.6-luna'], '', SPECS);
  assert.deepEqual(choices, ['gemini-3.8-flash'], 'the suggestion, the profile default and the role pin from another engine are all left out');
  assert.ok(modelChoices('codex', c, [], '', SPECS).includes('gpt-6-astra'), 'and an engine keeps its own');
  assert.deepEqual(modelChoices('antigravity', config(), ['gemini-3.8-flash', 'gpt-oss-120b'], '', SPECS),
    ['gemini-3.8-flash', 'gpt-oss-120b'], 'what agy really lists stays offered');
  assert.deepEqual(modelChoices('codex', config(), ['gpt-6-astra', 'gpt-oss-120b'], '', SPECS).filter(id => id.startsWith('gpt-oss')), [],
    'while the open-weight family, which agy serves and codex does not, is not offered to codex');
});

test('the value a dropdown is on is still shown when it does not fit, so it is never swapped silently', () => {
  const choices = modelChoices('antigravity', config(), ['gemini-3.8-flash'], 'gpt-5.6-sol', SPECS);
  assert.equal(choices.at(-1), 'gpt-5.6-sol');
});

test('a model under the wrong engine is reported with every place it sits and who it belongs to', () => {
  const c = config();
  c.engines.antigravity.models.reasoning = 'gpt-5.6-sol';
  c.engines.antigravity.models.fast = 'gpt-5.6-sol';
  c.roles = { developer: { engine: ['antigravity', 'codex'], models: { antigravity: 'gpt-5.6-sol', codex: 'gpt-6-astra' }, effort: {} } };
  assert.deepEqual(foreignModels(c, SPECS), [{
    engine: 'antigravity', id: 'gpt-5.6-sol', owners: ['codex'],
    where: ['engines.antigravity.models.reasoning', 'engines.antigravity.models.fast', 'roles.developer.models.antigravity'],
    paths: [['engines', 'antigravity', 'models', 'reasoning'], ['engines', 'antigravity', 'models', 'fast'],
      ['roles', 'developer', 'models', 'antigravity']]
  }]);
});

test('a model on the wrong engine is reported as that, not also as retired or renamed', () => {
  const c = config();
  c.engines.antigravity.models.reasoning = 'gpt-5.6-sol';
  c.engines.antigravity.models.fast = 'gemini-3.1-old';
  const lists = { antigravity: ['gemini-3.8-flash'] };
  assert.deepEqual(staleModels(c, lists).map(entry => entry.id), ['gpt-5.6-sol', 'gemini-3.1-old'], 'without the rule both look stale');
  assert.deepEqual(staleModels(c, lists, SPECS).map(entry => entry.id), ['gemini-3.1-old'],
    'with it, only the id that really is a retired antigravity model is left');
});

test('models that fit, blanks and inherit are never reported', () => {
  const c = config();
  c.roles = { planner: { engine: 'inherit', models: { codex: '', antigravity: 'inherit', claude: null }, effort: {} } };
  assert.deepEqual(foreignModels(c, SPECS), []);
  assert.deepEqual(foreignModels({}, SPECS), [], 'a half-written config does not throw');
});

test('the page is told which ids each engine runs, and serves the file that decides it', async () => {
  await withLists(async () => '', async editor => {
    const { json } = await call(editor, '/api/config', { method: 'GET' });
    for (const name of NAMES) {
      assert.deepEqual(json.meta.engines[name].modelPrefixes, ADAPTERS[name].modelPrefixes, name);
      assert.deepEqual(json.meta.engines[name].modelExcludes, ADAPTERS[name].modelExcludes ?? [], name);
    }
    const script = await new Promise((done, fail) => request({ host: '127.0.0.1', port: editor.port, path: '/model-fit.mjs',
      headers: { Host: `127.0.0.1:${editor.port}` } }, res => { res.resume(); done(res); }).on('error', fail).end());
    assert.equal(script.statusCode, 200);
    assert.match(script.headers['content-type'], /javascript/);
  });
});

test('the editor refuses to save a model under the wrong engine, with the loader\'s own message', async () => {
  const bad = config();
  bad.engines.antigravity.models.reasoning = 'gpt-5.6-sol';
  await withLists(async () => '', async editor => {
    const { status, json } = await call(editor, '/api/validate', { body: { config: { ...bad, version: 1, workerTimeoutSeconds: 60,
      workerCommands: [], roles: {} } } });
    assert.equal(status, 400);
    assert.match(json.error, /engines\.antigravity\.models\.reasoning.*not an antigravity model.*codex/s);
  });
});
