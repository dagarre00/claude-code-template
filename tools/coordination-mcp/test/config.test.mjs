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
