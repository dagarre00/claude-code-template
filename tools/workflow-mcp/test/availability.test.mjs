// F-C: four roles resolved to one engine, so when that engine hit its usage
// limit all four became undispatchable at once — with no signal until a 45 KB
// prompt had already been composed and run. The only remedy was a manual
// per-dispatch cli_engine override the conductor had to think of
// (dispatch-findings 2026-09-10, F-C). Two answers: a role can declare an
// ordered chain, and the conductor can ask which engines are actually there
// before composing anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { findExecutable, grantAntigravitySetup } from '../availability.mjs';
import { loadConfig, resolveEngine, resolveEngineChain } from '../config.mjs';
import { prepareDispatch } from '../dispatch.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

// Isolates $HOME/$USERPROFILE for the duration of `fn`, the way agy's
// engineSetup tests already do, so a real machine's own antigravity-cli
// settings are never at risk of being read, let alone written, by this suite.
const withHome = fn => {
  const home = fixture();
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home; process.env.USERPROFILE = home;
  try { return fn(home); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    cleanup(home);
  }
};

// A real executable that exists on every machine this suite runs on, and a name
// that exists on none. Availability has to be measured, not stubbed, or the test
// proves nothing about the lookup.
const PRESENT = process.execPath;
const ABSENT = 'workflow-mcp-definitely-not-installed';

const engines = (claude, codex) => ({
  claude: { executable: claude, models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
  codex: { executable: codex, models: { reasoning: null, balanced: null, fast: null },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
  antigravity: { executable: ABSENT, models: { reasoning: 'gemini-3.8-pro', balanced: 'inherit', fast: 'gemini-3.8-flash' },
    effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
});

const config = (roles, engineOverrides = engines(PRESENT, ABSENT)) => JSON.stringify({
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles, engines: engineOverrides
});

const withRepo = (roles, fn, engineOverrides) => {
  const root = fixture({ '.agents/config.json': config(roles, engineOverrides) });
  try { return fn(root); } finally { cleanup(root); }
};

test('finds an executable that exists and reports one that does not', () => {
  assert.equal(findExecutable(PRESENT), PRESENT, 'an absolute path is used as given');
  assert.equal(findExecutable(ABSENT), null);
  assert.equal(findExecutable('node') !== null, true, 'a bare name is looked up on PATH');
  assert.equal(findExecutable(resolve(PRESENT, 'nope')), null, 'a path that is not there is not found');
});

test('a role can declare an ordered chain of engines instead of exactly one', () => {
  withRepo({ developer: { engine: ['codex', 'claude'] } }, root => {
    const loaded = loadConfig(root);
    assert.deepEqual(resolveEngineChain(loaded, 'developer', 'antigravity'), ['codex', 'claude']);
    assert.equal(resolveEngine(loaded, 'developer', 'antigravity'), 'codex',
      'the first entry is still what the role resolves to');
  });
});

test('"inherit" inside a chain means the conductor, and a repeat is collapsed', () => {
  withRepo({ developer: { engine: ['inherit', 'claude', 'codex'] } }, root => {
    assert.deepEqual(resolveEngineChain(loadConfig(root), 'developer', 'claude'), ['claude', 'codex'],
      'inherit resolved to claude, so the later claude entry is redundant');
  });
});

test('a chain entry that is not an engine fails at load, not at dispatch', () => {
  withRepo({ developer: { engine: ['codex', 'gemini'] } }, root => {
    assert.throws(() => loadConfig(root), /gemini/);
  });
  withRepo({ developer: { engine: [] } }, root => {
    assert.throws(() => loadConfig(root), /empty|at least one/i);
  });
});

// The whole point: the fallback fires without the conductor thinking of it, and
// says so, because a worker silently running on a different model than the role
// was pinned to is a result the conductor must be able to weigh.
test('dispatch falls through to the next engine in the chain when the first is not installed', () => {
  withRepo({ developer: { engine: ['codex', 'claude'] } }, root => {
    const result = prepareDispatch(root, { role: 'developer', instructions: 'Implement login.',
      owned_paths: ['src'], conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'claude');
    assert.deepEqual(result.engine_chain, ['codex', 'claude']);
    assert.ok(result.warnings.some(w => /codex/.test(w) && /fall|chain|not (found|installed)/i.test(w)),
      'switching engines behind the conductor\'s back must be announced');
  });
});

test('an explicit cli_engine still wins over the chain', () => {
  withRepo({ developer: { engine: ['claude', 'codex'] } }, root => {
    const result = prepareDispatch(root, { role: 'developer', instructions: 'Implement login.',
      owned_paths: ['src'], cli_engine: 'codex', conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'codex', 'an override is the conductor deciding; the chain does not argue');
  });
});

test('a role whose whole chain is missing still dispatches, and says the command will likely fail', () => {
  withRepo({ developer: { engine: ['codex', 'antigravity'] } }, root => {
    const result = prepareDispatch(root, { role: 'developer', instructions: 'Implement login.',
      owned_paths: ['src'], conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'codex', 'with nothing available, the declared first choice stands');
    assert.equal(result.engine_available, false);
    assert.ok(result.warnings.some(w => /no .*engine|not (found|installed)/i.test(w)));
  });
});

// Failing fast here is worth more than retrying: the conductor learns before it
// composes a 45 KB prompt, not after a worker burns 260k tokens and returns
// nothing.
test('check reports which engines are installed and which roles that leaves dispatchable', () => {
  withRepo({ developer: { engine: ['codex'] }, adversary: { engine: 'claude' } }, root => {
    const report = makeTools(root, 'claude').check();
    const byName = Object.fromEntries(report.engines.map(engine => [engine.name, engine]));
    assert.equal(byName.claude.available, true);
    assert.equal(byName.codex.available, false);
    assert.equal(byName.claude.path, PRESENT);
    assert.deepEqual(byName.codex.roles, ['developer'], 'each engine names the roles resting on it');
    assert.deepEqual(report.roles_without_an_available_engine, ['developer']);
  });
});

// agy denies any command without an exact `command(<line>)` grant in its
// user-global settings, and headless mode cannot ask: the run ends and the report
// is discarded. That is computable before a single token is spent, so check does it.
test('check names every worker command agy has no exact grant for', () => {
  const home = fixture({ '.gemini/antigravity-cli/settings.json': JSON.stringify({
    permissions: { allow: ['command(npm test)', 'command(git status --porcelain)', 'read_file(C:/x)'] } }) });
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home; process.env.USERPROFILE = home;
  try {
    const root = fixture({ '.agents/config.json': JSON.stringify({ ...JSON.parse(config({})),
      workerCommands: ['npm test', 'git status', 'git status --porcelain'] }) });
    try {
      const agy = makeTools(root, 'claude').check().engines.find(engine => engine.name === 'antigravity');
      assert.deepEqual(agy.setup.missing_command_grants, ['git status'],
        'matching is exact: `git status --porcelain` does not grant `git status`');
      assert.equal(agy.setup.ok, false);
      assert.match(agy.setup.settings_file, /antigravity-cli[\\/]settings\.json$/);
    } finally { cleanup(root); }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    cleanup(home);
  }
});

// F-C's silent-failure shape again, one layer up: an engine can be installed
// (available: true) and still refuse a worker's first command. `ok` stays
// about drift alone, so this is the separate signal a conductor would
// otherwise only find by reading each engine's `setup` block by hand.
test('check names every role whose engine has an unmet setup requirement', () => {
  withHome(() => {
    // antigravity is installed in this fixture, so developer really would run
    // on it — and the fixture HOME has no settings file, so its grants are
    // absent. adversary's claude has nothing to set up at all.
    const installed = engines(PRESENT, ABSENT);
    installed.antigravity = { ...installed.antigravity, executable: PRESENT };
    withRepo({
      developer: { engine: ['antigravity', 'claude'] },
      adversary: { engine: 'claude' }
    }, root => {
      assert.deepEqual(makeTools(root, 'claude').check().roles_with_unmet_setup, ['developer']);
    }, installed);
  });
});

test('check reports a missing agy settings file as every grant missing, not as fine', () => {
  const home = fixture();
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home; process.env.USERPROFILE = home;
  try {
    withRepo({}, root => {
      const agy = makeTools(root, 'claude').check().engines.find(engine => engine.name === 'antigravity');
      assert.deepEqual(agy.setup.missing_command_grants, ['npm test']);
      assert.equal(agy.setup.ok, false);
      const claude = makeTools(root, 'claude').check().engines.find(engine => engine.name === 'claude');
      assert.equal(claude.setup, undefined, 'engines with nothing to set up carry no setup block');
    });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    cleanup(home);
  }
});

test('list_roles reports the chain, not just the winner', () => {
  withRepo({ developer: { engine: ['codex', 'claude'] } }, root => {
    const developer = makeTools(root, 'claude').list_roles().find(role => role.name === 'developer');
    assert.deepEqual(developer.engine_chain, ['codex', 'claude']);
    assert.equal(developer.engine, 'codex');
  });
});

test('a chain in the config survives a round trip through the real project config', () => {
  const root = fixture();
  try {
    // The shipped config uses plain strings; both forms must load.
    writeFileSync(resolve(root, '.agents/config.json'), config({ developer: { engine: 'claude' } }));
    assert.deepEqual(resolveEngineChain(loadConfig(root), 'developer', 'codex'), ['claude']);
  } finally { cleanup(root); }
});

// engine-setup.md otherwise walks a human through pasting this merge in by
// hand, because a conductor's own edit tools are commonly denied from
// touching a file outside the repo. This server process is not gated the same
// way, so it can perform the exact additive merge directly.
test('grantAntigravitySetup writes the missing grants and creates the file if absent', () => {
  withHome(home => {
    withRepo({}, root => {
      const config = loadConfig(root);
      const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
      assert.equal(existsSync(settings_file), false, 'nothing written yet');

      const result = grantAntigravitySetup(config);
      assert.deepEqual(result.added, ['command(npm test)']);
      assert.equal(result.already_granted, false);
      assert.equal(result.settings_file, settings_file);

      const written = JSON.parse(readFileSync(settings_file, 'utf8'));
      assert.deepEqual(written.permissions.allow, ['command(npm test)']);
    });
  });
});

test('grantAntigravitySetup only adds what is missing, and never touches existing grants', () => {
  withHome(home => {
    const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
    mkdirSync(dirname(settings_file), { recursive: true });
    writeFileSync(settings_file, JSON.stringify({
      permissions: { allow: ['command(git status --porcelain)', 'read_file(C:/shared/vendor)'] }, otherTopLevelKey: true }));

    withRepo({}, root => {
      const config = { ...loadConfig(root), workerCommands: ['git status --porcelain', 'npm test', 'git diff'] };
      const result = grantAntigravitySetup(config);
      assert.deepEqual(result.added, ['command(npm test)', 'command(git diff)']);

      const written = JSON.parse(readFileSync(settings_file, 'utf8'));
      assert.deepEqual(written.permissions.allow,
        ['command(git status --porcelain)', 'read_file(C:/shared/vendor)', 'command(npm test)', 'command(git diff)'],
        'the pre-existing grants, interactive or not, are kept verbatim and in place');
      assert.equal(written.otherTopLevelKey, true, 'unrelated keys in the file are preserved');
    });
  });
});

test('grantAntigravitySetup is a no-op once every command is already granted', () => {
  withHome(home => {
    const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
    mkdirSync(dirname(settings_file), { recursive: true });
    writeFileSync(settings_file, JSON.stringify({ permissions: { allow: ['command(npm test)'] } }));

    withRepo({}, root => {
      const config = loadConfig(root);
      const before = readFileSync(settings_file, 'utf8');
      const result = grantAntigravitySetup(config);
      assert.deepEqual(result.added, []);
      assert.equal(result.already_granted, true);
      assert.equal(readFileSync(settings_file, 'utf8'), before, 'nothing was rewritten');
    });
  });
});

test('check names every role whose chain reaches an engine lacking a capability it needs', () => {
  const root = fixture({
    '.agents/config.json': config({ researcher: { engine: ['antigravity', 'codex'] } }),
    '.agents/roles/researcher.md': '---\nname: researcher\ndescription: Web research.\nprofile: fast\naccess: write\ncapabilities: [web]\n---\n\nResearch.\n'
  });
  try {
    assert.deepEqual(makeTools(root, 'claude').check().capability_gaps,
      [{ role: 'researcher', engine: 'antigravity', missing: ['web'] }]);
  } finally { cleanup(root); }
});

// Adversary round 1 on fix/workflow-mcp-hardening, F2: every read failure used
// to collapse to "nothing granted", and the additive merge then wrote that
// nothing back over the file — a BOM from a Windows editor or one trailing
// comma was enough to lose every interactive grant silently. The promise is
// "never dropped", so an unparseable file is a refusal, not an empty one.
test('grantAntigravitySetup refuses a settings file it cannot parse, and leaves it byte for byte', () => {
  withHome(home => {
    const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
    mkdirSync(dirname(settings_file), { recursive: true });
    const original = '\uFEFF{ "permissions": { "allow": ["command(git status)", "read_file(C:/shared)",] } }';
    writeFileSync(settings_file, original);
    withRepo({}, root => {
      assert.throws(() => grantAntigravitySetup(loadConfig(root)), /parse|by hand/i);
      assert.equal(readFileSync(settings_file, 'utf8'), original, 'nothing was rewritten');
      assert.deepEqual(readdirSync(dirname(settings_file)), ['settings.json'], 'no staging file left beside it');
    });
  });
});

test('grantAntigravitySetup refuses a permissions.allow that is not an array, and leaves it byte for byte', () => {
  withHome(home => {
    const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
    mkdirSync(dirname(settings_file), { recursive: true });
    const original = JSON.stringify({ permissions: { allow: { 'command(npm test)': true } } });
    writeFileSync(settings_file, original);
    withRepo({}, root => {
      assert.throws(() => grantAntigravitySetup(loadConfig(root)), /permissions\.allow/);
      assert.equal(readFileSync(settings_file, 'utf8'), original, 'nothing was rewritten');
    });
  });
});

// The same failure one layer up: check used to report an unparseable file as
// "every grant missing", which is what sends a conductor to grant_antigravity_setup
// in the first place. A file that cannot be read is a setup problem in its own
// right, named as such, and still not ok.
test('check reports an unparseable agy settings file as a named problem, not as every grant missing', () => {
  withHome(home => {
    const settings_file = resolve(home, '.gemini', 'antigravity-cli', 'settings.json');
    mkdirSync(dirname(settings_file), { recursive: true });
    writeFileSync(settings_file, '{ not json');
    withRepo({ developer: { engine: ['antigravity', 'claude'] } }, root => {
      const agy = makeTools(root, 'claude').check().engines.find(engine => engine.name === 'antigravity');
      assert.equal(agy.setup.ok, false);
      assert.match(agy.setup.problem, /parse/i);
      assert.deepEqual(agy.setup.missing_command_grants, [], 'nothing is known to be missing from a file that could not be read');
    });
  });
});

// Adversary round 1, F3: the flag keyed on the chain's first entry whether or
// not that engine was installed, so a role chained [antigravity, claude] on a
// machine without agy was flagged — and the dispatch skill turns that into a
// human-checkpoint — although dispatch falls through to claude and never runs
// on agy. The engine that matters is the one dispatch would pick.
test('roles_with_unmet_setup keys on the engine dispatch would pick, not on an uninstalled first choice', () => {
  withHome(() => {
    // antigravity is ABSENT in the fixture engines and there is no settings
    // file, so its setup is unmet — but this chain never runs on it.
    withRepo({ developer: { engine: ['antigravity', 'claude'] } }, root => {
      assert.deepEqual(makeTools(root, 'claude').check().roles_with_unmet_setup, []);
    });
  });
});
