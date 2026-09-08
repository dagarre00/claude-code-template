import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from '../server.mjs';
import { makeTools } from '../tools.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: { developer: {}, adversary: {} },
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const withRepo = fn => {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG) });
  try { return fn(root); } finally { cleanup(root); }
};

test('the server constructs — commands get no MCP surface, only worker dispatch does', () => {
  withRepo(root => {
    assert.ok(createServer(root, 'claude'));
  });
});

test('an unknown conductor engine is refused at construction', () => {
  withRepo(root => {
    assert.throws(() => createServer(root, 'gemini'), /gemini/);
  });
});

test('list_roles reports the engine each role would actually run on', () => {
  withRepo(root => {
    const roles = makeTools(root, 'codex').list_roles();
    assert.ok(roles.every(role => role.engine === 'codex'), 'inherit should follow the conductor');
    assert.ok(roles.some(role => role.name === 'developer' && role.access === 'write'));
  });
});

test('check fails before sync and passes after', () => {
  withRepo(root => {
    const api = makeTools(root, 'claude');
    assert.equal(api.check().ok, false);
    api.sync();
    assert.equal(api.check().ok, true);
  });
});

// The server is the process a CLI actually launches, so a syntax or import error
// in any module would only show up at runtime. This catches that at test time.
test('the server module starts as a real process without crashing', () => {
  withRepo(root => {
    const result = spawnSync(process.execPath,
      [new URL('../server.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
        '--root', root, '--engine', 'claude'],
      { encoding: 'utf8', timeout: 8000, input: '' });
    // Clean shutdown on stdin EOF; what matters is that it did not throw on boot.
    assert.doesNotMatch(result.stderr ?? '', /Cannot find module|SyntaxError|ReferenceError/);
  });
});
