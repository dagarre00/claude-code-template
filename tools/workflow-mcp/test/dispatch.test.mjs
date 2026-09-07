import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config.mjs';
import { prepareDispatch } from '../dispatch.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800,
  roles: { developer: { engine: null, models: {}, effort: {} },
    adversary: { engine: 'codex', models: {}, effort: {} } },
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const withRepo = (fn, overrides = {}) => {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG), ...overrides });
  try { return fn(root); } finally { cleanup(root); }
};

const base = { role: 'developer', instructions: 'Implement login.', owned_paths: ['src'] };

test('config validates and reports the engine each role resolves to', () => {
  withRepo(root => {
    const config = loadConfig(root);
    assert.equal(config.roles.adversary.engine, 'codex');
    assert.equal(config.defaultEngine, 'inherit');
  });
});

test('an unknown key in a role config fails loudly instead of being ignored', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /modell|Unknown key/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    roles: { developer: { modell: 'sonnet' } } }) });
});

test('a settings block for an unregistered engine is an error', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /gemini/);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines, gemini: { executable: 'gemini', models: {}, effort: {} } } }) });
});

test('a shell shim is refused as an executable', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /shim|executable/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines,
      claude: { ...CONFIG.engines.claude, executable: 'claude.cmd' } } }) });
});

test('writes the prompt and the exact stdin bytes, and returns a runnable command', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, command: 'work', conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'claude');
    assert.equal(result.executable, 'claude');
    // The prompt is on disk for a human to read, and the stdin file is what
    // actually gets piped — same bytes here, different for antigravity.
    assert.match(readFileSync(result.prompt_file, 'utf8'), /Implement login\./);
    assert.equal(readFileSync(result.stdin_file, 'utf8'), readFileSync(result.prompt_file, 'utf8'));
    assert.ok(result.command.includes('<'), 'command must pipe the stdin file');
    assert.ok(Array.isArray(result.args));
  });
});

test('antigravity gets NDJSON on stdin while the readable prompt stays plain', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, conductorEngine: 'claude', cli_engine: 'antigravity',
      workspace: resolve(root, '.worktrees/x') });
    const prompt = readFileSync(result.prompt_file, 'utf8');
    const stdin = readFileSync(result.stdin_file, 'utf8');
    assert.doesNotMatch(prompt, /^\{"event"/);
    assert.equal(JSON.parse(stdin.trim()).message.content[0].text, prompt);
  });
});

test('"inherit" resolves to the conductor\'s own engine', () => {
  withRepo(root => {
    const asCodex = prepareDispatch(root, { ...base, conductorEngine: 'codex',
      workspace: resolve(root, '.worktrees/x') });
    assert.equal(asCodex.engine, 'codex');
  });
});

test('a per-role engine beats the inherited default', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { role: 'adversary', instructions: 'Review.',
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'codex');
  });
});

test('reports the prompt size so the conductor can see what it is paying for', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, command: 'work', conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.ok(result.prompt_bytes > 100);
    assert.equal(result.prompt_bytes, readFileSync(result.prompt_file, 'utf8').length);
  });
});

test('a role with no config entry still dispatches on the inherited engine', () => {
  withRepo(root => {
    writeFileSync(resolve(root, '.agents/agents/scout.md'),
      '---\nname: scout\ndescription: d\nprofile: fast\naccess: read-only\n---\n\nBody.\n');
    const result = prepareDispatch(root, { role: 'scout', instructions: 'Look around.',
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'claude');
    assert.equal(result.model, 'haiku');
  });
});
