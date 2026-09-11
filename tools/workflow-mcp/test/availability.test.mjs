// F-C: four roles resolved to one engine, so when that engine hit its usage
// limit all four became undispatchable at once — with no signal until a 45 KB
// prompt had already been composed and run. The only remedy was a manual
// per-dispatch cli_engine override the conductor had to think of
// (dispatch-findings 2026-09-10, F-C). Two answers: a role can declare an
// ordered chain, and the conductor can ask which engines are actually there
// before composing anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findExecutable } from '../availability.mjs';
import { loadConfig, resolveEngine, resolveEngineChain } from '../config.mjs';
import { prepareDispatch } from '../dispatch.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

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
  antigravity: { executable: ABSENT, models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
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
