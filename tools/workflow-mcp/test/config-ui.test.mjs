// The config editor: a local page over .agents/config.json. Two things need
// proof. The server has to be a safe way to write a file that decides which
// programs run — a webpage the human happens to have open must not be able to
// reach it — and the page's own logic (what a role's form means, what will
// actually run) has to be right, because a form that quietly writes something
// other than what it shows is the failure this whole tool exists to remove.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { loadConfig } from '../config.mjs';
import { startConfigServer } from '../config-ui.mjs';
import { assembleConfig, chainRows, completeShape, effectiveChain, findUnknownKeys, formToRole, linesToList, modelChoices,
  placeInChain, removeFromChain, roleToForm }
  from '../config-ui/model.mjs';
import { CONFIG_KEYS } from '../config.mjs';
import { ENGINES as ADAPTERS, MODEL } from '../engines/index.mjs';
import { cleanup, fixture } from './helpers.mjs';

// A fixed copy of the config this template shipped, not the live file: the whole
// point of the editor is that people change .agents/config.json, and a test that
// asserts its values would fail the first time someone did.
const SNAPSHOT = {
  "version": 1,
  "defaultEngine": "inherit",
  "workerTimeoutSeconds": 1800,
  "workerCommands": [
    "npm test",
    "git status",
    "git status --porcelain",
    "git diff",
    "git rev-parse HEAD",
    "git branch --show-current"
  ],
  "protectedPaths": [
    ".agents"
  ],
  "architecture": {
    "command": null,
    "rules": []
  },
  "roles": {
    "adversary": {
      "engine": [
        "codex",
        "antigravity",
        "claude"
      ],
      "models": {
        "codex": "gpt-6-astra"
      },
      "effort": {
        "codex": "medium"
      }
    },
    "developer": {
      "engine": [
        "antigravity",
        "codex",
        "claude"
      ],
      "models": {},
      "effort": {}
    },
    "plan-adversary": {
      "engine": [
        "antigravity",
        "codex",
        "claude"
      ],
      "models": {
        "antigravity": "gemini-3.8-flash"
      },
      "effort": {
        "antigravity": "high"
      }
    },
    "planner": {
      "engine": [
        "claude",
        "codex"
      ],
      "models": {
        "claude": "claude-opus-5"
      },
      "effort": {
        "claude": "high"
      }
    },
    "researcher": {
      "engine": null,
      "models": {},
      "effort": {}
    },
    "reviewer": {
      "engine": null,
      "models": {},
      "effort": {}
    },
    "triage": {
      "engine": null,
      "models": {},
      "effort": {}
    },
    "wiki-maintainer": {
      "engine": null,
      "models": {},
      "effort": {}
    }
  },
  "engines": {
    "claude": {
      "executable": "claude",
      "models": {
        "reasoning": "claude-opus-5",
        "balanced": "claude-sonnet-5",
        "fast": "claude-haiku-4-5-20251001"
      },
      "effort": {
        "reasoning": "high",
        "balanced": "medium",
        "fast": "low"
      }
    },
    "codex": {
      "executable": "codex",
      "models": {
        "reasoning": "gpt-6-astra",
        "balanced": "gpt-5.6-terra",
        "fast": "gpt-5.6-luna"
      },
      "effort": {
        "reasoning": "high",
        "balanced": "medium",
        "fast": "low"
      }
    },
    "antigravity": {
      "executable": "agy",
      "models": {
        "reasoning": "gemini-3.8-flash",
        "balanced": "gemini-3.8-flash",
        "fast": "gemini-3.8-flash"
      },
      "effort": {
        "reasoning": "high",
        "balanced": "medium",
        "fast": "low"
      }
    }
  }
};
const shippedText = JSON.stringify(SNAPSHOT, null, 2) + '\n';
const shipped = () => structuredClone(SNAPSHOT);
const ENGINES = ['claude', 'codex', 'antigravity'];

const withEditor = async (text, fn) => {
  const root = fixture({ '.agents/config.json': text });
  const editor = await startConfigServer(root, { port: 0 });
  try { return await fn({ root, editor }); } finally { await editor.close(); cleanup(root); }
};

// node:http, not fetch: fetch refuses to set `Host`, and the Host check is one
// of the things under test.
const call = (editor, path, { method = 'GET', body, token = editor.token, host, type } = {}) =>
  new Promise((done, fail) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = request({ host: '127.0.0.1', port: editor.port, path, method, headers: {
      Host: host ?? `127.0.0.1:${editor.port}`,
      ...(token ? { 'X-Config-Token': token } : {}),
      ...(payload ? { 'Content-Type': type ?? 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* a static file */ }
        done({ status: res.statusCode, json, text: data, type: res.headers['content-type'] });
      });
    });
    req.on('error', fail);
    if (payload) req.write(payload);
    req.end();
  });

// ─── the server ────────────────────────────────────────────────────────────

test('the editor listens on loopback only', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    assert.equal(editor.server.address().address, '127.0.0.1');
    assert.match(editor.url, /^http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{32,}$/);
  });
});

test('the API refuses a request without the launch token, or with the wrong one', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    assert.equal((await call(editor, '/api/config', { token: null })).status, 403);
    assert.equal((await call(editor, '/api/config', { token: 'f'.repeat(32) })).status, 403);
    assert.equal((await call(editor, '/api/save', { method: 'POST', token: null, body: {} })).status, 403);
    assert.equal((await call(editor, '/api/config')).status, 200);
  });
});

test('a request whose Host is not the loopback address is refused, which stops DNS rebinding', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    for (const path of ['/', '/api/config']) {
      const res = await call(editor, path, { host: `attacker.example:${editor.port}` });
      assert.equal(res.status, 403, path);
    }
    assert.equal((await call(editor, '/', { host: `localhost:${editor.port}` })).status, 200);
  });
});

test('a write must be JSON: a form post from another page is refused before parsing', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    const res = await call(editor, '/api/save', { method: 'POST', body: { config: shipped() }, type: 'text/plain' });
    assert.equal(res.status, 415);
  });
});

test('serves the page and its two scripts, and nothing else on disk', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    const page = await call(editor, '/');
    assert.equal(page.status, 200);
    assert.match(page.type, /text\/html/);
    assert.match(page.text, /<title>[^<]+<\/title>/);
    assert.match((await call(editor, '/app.js')).type, /javascript/);
    assert.match((await call(editor, '/model.mjs')).type, /javascript/);
    for (const path of ['/config.mjs', '/../config.mjs', '/%2e%2e/config.mjs', '/package.json', '/api']) {
      assert.equal((await call(editor, path)).status, 404, path);
    }
  });
});

test('GET returns the file as written — not the normalized copy the dispatcher uses', async () => {
  const config = shipped();
  config.architecture = { command: 'npm run arch', rules: ['docs/arch.md'] };
  await withEditor(JSON.stringify(config, null, 2) + '\n', async ({ editor }) => {
    const { json } = await call(editor, '/api/config');
    assert.deepEqual(json.config.workerCommands, config.workerCommands, 'the architecture command is not merged in');
    assert.deepEqual(json.config.protectedPaths, config.protectedPaths);
    assert.equal(json.parseError, null);
    assert.equal(json.validationError, null);
    assert.match(json.etag, /^[0-9a-f]{16}$/);
  });
});

test('GET describes the roles and engines the page must offer, from the project itself', async () => {
  await withEditor(shippedText, async ({ editor }) => {
    const { meta } = (await call(editor, '/api/config')).json;
    assert.deepEqual(meta.profiles, ['reasoning', 'balanced', 'fast']);
    assert.deepEqual(meta.keys, JSON.parse(JSON.stringify(CONFIG_KEYS)), 'the keys the loader accepts, so the page can name the rest');
    assert.deepEqual(meta.engines.antigravity.efforts, ['low', 'medium', 'high']);
    assert.ok(meta.engines.claude.efforts.includes('max'));
    for (const name of ENGINES) assert.deepEqual(meta.engines[name].knownModels, ADAPTERS[name].knownModels, `${name}: the ids its dropdown offers`);
    const roles = Object.fromEntries(meta.roles.map(role => [role.name, role]));
    assert.deepEqual(Object.keys(roles).sort(), ['adversary', 'developer'], 'the fixture\'s two role files');
    assert.equal(roles.adversary.profile, 'reasoning');
    assert.equal(roles.adversary.access, 'read-only');
    assert.match(roles.developer.description, /TDD/);
  });
});

test('GET reports a broken file instead of failing, so the page can say what is wrong', async () => {
  await withEditor('{ "version": 1, ', async ({ editor }) => {
    const { json } = await call(editor, '/api/config');
    assert.equal(json.config, null);
    assert.match(json.parseError, /not valid JSON/);
  });
  const typo = shipped();
  typo.worktreeSetups = ['npm ci'];
  await withEditor(JSON.stringify(typo, null, 2), async ({ editor }) => {
    const { json } = await call(editor, '/api/config');
    assert.ok(json.config, 'a file that parses is still handed over, so it can be fixed in the page');
    assert.match(json.validationError, /Unknown key "worktreeSetups"/);
  });
});

test('validate accepts a good config and names the problem in a bad one, writing nothing', async () => {
  await withEditor(shippedText, async ({ root, editor }) => {
    const before = readFileSync(resolve(root, '.agents/config.json'), 'utf8');
    assert.equal((await call(editor, '/api/validate', { method: 'POST', body: { config: shipped() } })).status, 200);
    const bad = shipped();
    bad.engines.antigravity.effort.fast = 'max';
    const res = await call(editor, '/api/validate', { method: 'POST', body: { config: bad } });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /engines\.antigravity\.effort\.fast/);
    assert.equal(readFileSync(resolve(root, '.agents/config.json'), 'utf8'), before);
  });
});

test('saving what was loaded changes nothing, byte for byte', async () => {
  // The shipped file is 2-space JSON with a trailing newline. If a save reflowed
  // it, the first click would be a whole-file diff nobody asked for.
  const lf = shippedText.replace(/\r\n/g, '\n');
  await withEditor(lf, async ({ root, editor }) => {
    const { json } = await call(editor, '/api/config');
    const res = await call(editor, '/api/save', { method: 'POST', body: { config: json.config, etag: json.etag } });
    assert.equal(res.status, 200);
    assert.equal(readFileSync(resolve(root, '.agents/config.json'), 'utf8'), lf);
  });
});

test('a save keeps the file\'s own line endings', async () => {
  const crlf = shippedText.replace(/\r?\n/g, '\r\n');
  await withEditor(crlf, async ({ root, editor }) => {
    const { json } = await call(editor, '/api/config');
    json.config.workerTimeoutSeconds = 600;
    await call(editor, '/api/save', { method: 'POST', body: { config: json.config, etag: json.etag } });
    const written = readFileSync(resolve(root, '.agents/config.json'), 'utf8');
    assert.ok(!/[^\r]\n/.test(written), 'no bare LF in a CRLF file');
    assert.equal(loadConfig(root).workerTimeoutSeconds, 600);
  });
});

test('a save writes what the human wrote, not what the dispatcher derives from it', async () => {
  await withEditor(shippedText, async ({ root, editor }) => {
    const { json } = await call(editor, '/api/config');
    json.config.architecture = { command: 'npm run arch', rules: ['docs/arch.md'] };
    const res = await call(editor, '/api/save', { method: 'POST', body: { config: json.config, etag: json.etag } });
    assert.equal(res.status, 200);
    const written = JSON.parse(readFileSync(resolve(root, '.agents/config.json'), 'utf8'));
    assert.ok(!written.workerCommands.includes('npm run arch'), 'the granted command is derived at load, never stored');
    assert.ok(!written.protectedPaths.includes('docs/arch.md'));
    assert.ok(loadConfig(root).workerCommands.includes('npm run arch'), 'and the dispatcher still derives it');
  });
});

test('an invalid save is refused and the file is untouched', async () => {
  await withEditor(shippedText, async ({ root, editor }) => {
    const before = readFileSync(resolve(root, '.agents/config.json'), 'utf8');
    const { json } = await call(editor, '/api/config');
    json.config.workerCommands = ['npm test && curl evil.example'];
    const res = await call(editor, '/api/save', { method: 'POST', body: { config: json.config, etag: json.etag } });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /shell composition/);
    assert.equal(readFileSync(resolve(root, '.agents/config.json'), 'utf8'), before);
  });
});

test('a save over a file that changed underneath it is refused, not merged or clobbered', async () => {
  await withEditor(shippedText, async ({ root, editor }) => {
    const { json } = await call(editor, '/api/config');
    const edited = shippedText.replace('1800', '900'); // someone edits it by hand meanwhile
    writeFileSync(resolve(root, '.agents/config.json'), edited);
    json.config.workerTimeoutSeconds = 60;
    const res = await call(editor, '/api/save', { method: 'POST', body: { config: json.config, etag: json.etag } });
    assert.equal(res.status, 409);
    assert.equal(readFileSync(resolve(root, '.agents/config.json'), 'utf8'), edited);
  });
});

// ─── the page's logic ──────────────────────────────────────────────────────

test('a role survives the round trip through its form unchanged', () => {
  for (const [name, role] of Object.entries(shipped().roles)) {
    assert.deepEqual(formToRole(roleToForm(role, ENGINES), ENGINES), role, name);
  }
});

test('a role form reads back as the shortest config that means the same thing', () => {
  const form = roleToForm({}, ENGINES);
  assert.equal(formToRole(form, ENGINES).engine, null, 'following the default is null');
  form.follow = false;
  form.rank.codex = 1;
  assert.equal(formToRole(form, ENGINES).engine, 'codex', 'one engine is a string');
  form.rank.claude = 2;
  form.rank.codex = 2; form.rank.claude = 1;
  assert.deepEqual(formToRole(form, ENGINES).engine, ['claude', 'codex'], 'order follows the ranks, not the rows');
  form.rank = { inherit: 0, claude: 0, codex: 0, antigravity: 0 };
  assert.deepEqual(formToRole(form, ENGINES).engine, [], 'nothing chosen is left for validation to name');
});

test('a blank model or effort is dropped rather than written as an empty pin', () => {
  const form = roleToForm({ engine: 'claude', models: { claude: 'opus' }, effort: { claude: 'high' } }, ENGINES);
  form.models.claude = '  ';
  form.effort.claude = '';
  const role = formToRole(form, ENGINES);
  assert.deepEqual(role.models, {});
  assert.deepEqual(role.effort, {});
});

test('the effective chain shows what will run: the role\'s pin, else the engine\'s default for its profile', () => {
  const config = shipped();
  const chain = effectiveChain(config, config.roles.planner, 'reasoning');
  assert.deepEqual(chain.map(step => step.engine), ['claude', 'codex']);
  assert.deepEqual(chain[0], { engine: 'claude', model: 'claude-opus-5', modelFrom: 'role', effort: 'high', effortFrom: 'role' });
  assert.deepEqual(chain[1], { engine: 'codex', model: 'gpt-6-astra', modelFrom: 'profile', effort: 'high', effortFrom: 'profile' });
});

test('a role that names no engine follows the default, and "inherit" stays unresolved', () => {
  const config = shipped();
  assert.deepEqual(effectiveChain(config, config.roles.researcher, 'fast'), [{ engine: 'inherit' }]);
  config.defaultEngine = 'codex';
  assert.equal(effectiveChain(config, config.roles.researcher, 'fast')[0].model, 'gpt-5.6-luna');
  assert.deepEqual(effectiveChain(config, undefined, 'fast').map(step => step.engine), ['codex'], 'a role absent from the file too');
});

test('assembling keeps roles the page does not know about, and only adds a role once it is customized', () => {
  const config = shipped();
  config.roles.retired = { engine: 'claude', models: {}, effort: {} };
  const forms = { adversary: roleToForm(config.roles.adversary, ENGINES), newcomer: roleToForm({}, ENGINES) };
  let next = assembleConfig(config, forms, ENGINES);
  assert.deepEqual(Object.keys(next.roles), Object.keys(config.roles), 'same roles, same order, orphan kept');
  assert.equal('newcomer' in next.roles, false, 'a role left at its defaults is not written');

  forms.newcomer.follow = false;
  forms.newcomer.rank.claude = 1;
  next = assembleConfig(config, forms, ENGINES);
  assert.deepEqual(next.roles.newcomer, { engine: 'claude', models: {}, effort: {} });
  assert.deepEqual(assembleConfig(config, forms, ENGINES, { drop: ['retired'] }).roles.retired, undefined);
});

test('a list box becomes a clean list: trimmed, blanks dropped', () => {
  assert.deepEqual(linesToList('  npm test \r\n\ngit status\n  '), ['npm test', 'git status']);
  assert.deepEqual(linesToList(''), []);
});

// ─── repairing a file the stricter loader now rejects ──────────────────────
// The loader turned silently-ignored keys into errors, so a project that syncs
// can be told "unknown key" about a file the page has no field for. The page has
// to be able to remove what it does not know, or it cannot fix the very error
// it displays.

test('finds every key the loader would reject as unknown, and only those', () => {
  assert.deepEqual(findUnknownKeys(shipped(), CONFIG_KEYS), []);
  assert.deepEqual(findUnknownKeys({ ...shipped(), $comment: 'a note' }, CONFIG_KEYS), [], '$comment is allowed');

  const config = shipped();
  config.worktreeSetups = ['npm ci'];
  config.engines.claude.model = 'opus';
  config.roles.planner.modles = {};
  config.architecture.comand = 'npm run arch';
  assert.deepEqual(findUnknownKeys(config, CONFIG_KEYS).map(found => found.path.join('.')).sort(), [
    'architecture.comand', 'engines.claude.model', 'roles.planner.modles', 'worktreeSetups'
  ]);
});

test('an unknown key is reported with where it sits, so the page can say so and remove it', () => {
  const [found] = findUnknownKeys({ ...shipped(), protectedPath: ['docs'] }, CONFIG_KEYS);
  assert.deepEqual(found, { path: ['protectedPath'], key: 'protectedPath', where: 'the top level' });
  const [nested] = findUnknownKeys({ ...shipped(), engines: { claude: { ...shipped().engines.claude, model: 'x' } } }, CONFIG_KEYS);
  assert.equal(nested.where, 'engines.claude');
});

test('a config missing engine blocks or profiles is completed for editing, without touching what is there', () => {
  const partial = shipped();
  delete partial.engines.codex;
  delete partial.engines.claude.effort.fast;
  const done = completeShape(partial, ENGINES, ['reasoning', 'balanced', 'fast']);
  assert.deepEqual(done.engines.codex,
    { executable: '', models: { reasoning: null, balanced: null, fast: null }, effort: { reasoning: null, balanced: null, fast: null } });
  assert.equal(done.engines.claude.effort.fast, null);
  assert.equal(done.engines.claude.effort.high, undefined);
  assert.equal(done.engines.claude.models.reasoning, 'claude-opus-5', 'existing values are kept');
  assert.equal(partial.engines.codex, undefined, 'the input is not mutated');
  assert.deepEqual(completeShape(shipped(), ENGINES, ['reasoning', 'balanced', 'fast']), shipped(), 'a complete config is unchanged');
  assert.deepEqual(completeShape({ version: 1 }, ENGINES, ['reasoning', 'balanced', 'fast']).roles, {}, 'even a bare file opens');
});

// ─── the order engines are tried in ────────────────────────────────────────
// The page lists a role's engines top to bottom in the order they run, and lets
// them be dragged. What "moved to here" means is decided in the model, so it is
// tested here rather than through a browser.

test('a role\'s engines are listed in the order they are tried, then the ones it does not use', () => {
  const form = roleToForm(shipped().roles.adversary, ENGINES);
  assert.deepEqual(chainRows(form, ENGINES), { used: ['codex', 'antigravity', 'claude'], unused: ['inherit'] });
  assert.deepEqual(chainRows(roleToForm({}, ENGINES), ENGINES), { used: [], unused: ['inherit', ...ENGINES] });
});

test('moving an engine reorders the chain, and the config it writes follows', () => {
  const form = roleToForm(shipped().roles.adversary, ENGINES);
  placeInChain(form, 'claude', 0, ENGINES);
  assert.deepEqual(chainRows(form, ENGINES).used, ['claude', 'codex', 'antigravity']);
  assert.deepEqual(form.rank, { inherit: 0, claude: 1, codex: 2, antigravity: 3 }, 'ranks stay 1..n with no gaps');
  assert.deepEqual(formToRole(form, ENGINES).engine, ['claude', 'codex', 'antigravity']);
});

test('an index counts positions among the other engines, so an engine lands where it was dropped', () => {
  const form = () => roleToForm(shipped().roles.adversary, ENGINES); // codex, antigravity, claude
  let moved = form();
  placeInChain(moved, 'codex', 1, ENGINES); // dragged down past antigravity
  assert.deepEqual(chainRows(moved, ENGINES).used, ['antigravity', 'codex', 'claude']);
  moved = form();
  placeInChain(moved, 'codex', 2, ENGINES); // dragged to the very end
  assert.deepEqual(chainRows(moved, ENGINES).used, ['antigravity', 'claude', 'codex']);
  moved = form();
  placeInChain(moved, 'claude', 99, ENGINES);
  assert.deepEqual(chainRows(moved, ENGINES).used, ['codex', 'antigravity', 'claude'], 'past the end clamps to the end');
  placeInChain(moved, 'claude', -3, ENGINES);
  assert.deepEqual(chainRows(moved, ENGINES).used, ['claude', 'codex', 'antigravity'], 'before the start clamps to the start');
});

test('an unused engine joins at the position given, and taking one out closes the gap', () => {
  const form = roleToForm(shipped().roles.adversary, ENGINES);
  placeInChain(form, 'inherit', 1, ENGINES);
  assert.deepEqual(chainRows(form, ENGINES), { used: ['codex', 'inherit', 'antigravity', 'claude'], unused: [] });
  removeFromChain(form, 'codex', ENGINES);
  assert.deepEqual(chainRows(form, ENGINES), { used: ['inherit', 'antigravity', 'claude'], unused: ['codex'] });
  assert.deepEqual(form.rank, { inherit: 1, claude: 3, codex: 0, antigravity: 2 });
  removeFromChain(form, 'codex', ENGINES); // already out: nothing changes
  assert.deepEqual(chainRows(form, ENGINES).used, ['inherit', 'antigravity', 'claude']);
});

test('a model or effort pinned for an engine survives moving it and taking it out', () => {
  const form = roleToForm(shipped().roles.adversary, ENGINES);
  placeInChain(form, 'codex', 2, ENGINES);
  removeFromChain(form, 'codex', ENGINES);
  assert.equal(form.models.codex, 'gpt-6-astra');
  assert.equal(form.effort.codex, 'medium');
  assert.deepEqual(formToRole(form, ENGINES).models, { codex: 'gpt-6-astra' }, 'and is still written, so nothing is lost silently');
});

test('dragging an engine away and back leaves the role exactly as it was found', () => {
  const config = shipped();
  const form = roleToForm(config.roles.adversary, ENGINES);
  placeInChain(form, 'claude', 0, ENGINES);
  placeInChain(form, 'claude', 2, ENGINES);
  assert.equal(JSON.stringify(assembleConfig(config, { adversary: form }, ENGINES)), JSON.stringify(config));
});

// ─── the model dropdown ────────────────────────────────────────────────────

test('every engine offers model ids the launcher would accept, and none twice', () => {
  for (const name of ENGINES) {
    const ids = ADAPTERS[name].knownModels;
    assert.ok(Array.isArray(ids) && ids.length, `${name} has a list to offer`);
    assert.equal(new Set(ids).size, ids.length, `${name}: no duplicates`);
    for (const id of ids) assert.match(id, MODEL, `${name}: ${id}`);
  }
});

test('a dropdown offers the engine own ids first, then ids the config already uses for it', () => {
  const config = shipped();
  config.roles.developer.models = { codex: 'gpt-x-custom' };
  const choices = modelChoices('codex', config, ['gpt-a', 'gpt-b']);
  assert.deepEqual(choices.slice(0, 2), ['gpt-a', 'gpt-b']);
  assert.ok(choices.includes('gpt-6-astra'), 'a role pin on this engine');
  assert.ok(choices.includes('gpt-5.6-terra'), 'a profile default on this engine');
  assert.ok(choices.includes('gpt-x-custom'), 'an id typed once shows up wherever it can be chosen');
});

test('a dropdown never offers the ids of another engine, and never a blank', () => {
  const config = shipped();
  config.engines.codex.models.fast = null;
  config.roles.developer.models = { codex: '' };
  const choices = modelChoices('codex', config, []);
  assert.ok(!choices.includes('claude-opus-5') && !choices.includes('gemini-3.8-flash'));
  assert.ok(choices.every(id => typeof id === 'string' && id !== ''));
  assert.equal(new Set(choices).size, choices.length);
});

test('a value the list does not know is still offered, so choosing nothing new never changes it', () => {
  assert.deepEqual(modelChoices('claude', shipped(), ['claude-opus-5'], 'claude-legacy-1').at(-1), 'claude-legacy-1');
  assert.equal(modelChoices('claude', shipped(), ['claude-opus-5'], 'claude-opus-5').filter(id => id === 'claude-opus-5').length, 1);
});
