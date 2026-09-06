// Protocol-boundary tests. The unit suites drive Manager directly; these speak
// real MCP over stdio to a spawned server.mjs, so they are the only coverage of
// tool registration, schema shape, read-only annotations, and the worker-mode
// recursion guard — the surface a non-Claude conductor actually sees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { copyRecursiveSync } from '../../../tests/helpers/copy-recursive.mjs';

const source = resolve(import.meta.dirname, '../../..');
const server = resolve(import.meta.dirname, '../server.mjs');
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// A worker-mode server must be spawned with COORDINATION_WORKER=1 in its own env;
// the guard is read at construction, so it cannot be toggled after connect.
async function connect(t, { worker = false } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'server-test-'));
  copyRecursiveSync(resolve(source, '.harness'), resolve(root, '.harness'));
  writeFileSync(resolve(root, 'sample.txt'), 'base\n');
  git(root, 'init', '-b', 'integration');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'user.name', 'Fixture');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'fixture');
  const client = new Client({ name: 'test-conductor', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server, '--root', root, '--engine', 'claude'],
    env: { ...process.env, ...(worker ? { COORDINATION_WORKER: '1' } : { COORDINATION_WORKER: '0' }) },
  });
  await client.connect(transport);
  t.after(async () => {
    await client.close().catch(() => {});
    rmSync(root, { recursive: true, force: true });
  });
  return { root, client };
}
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `${name} failed: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content[0].text);
};

test('conductor sees the full control plane; every mutating tool is annotated as such', async t => {
  const { client } = await connect(t);
  const { tools } = await client.listTools();
  const names = tools.map(tool => tool.name).sort();
  assert.deepEqual(names, ['check_worker_status', 'get_settings', 'get_workflow', 'kill_worker',
    'list_roles', 'list_workers', 'merge_and_cleanup_worker', 'read_worker_log', 'spawn_worker']);
  const readOnly = tools.filter(tool => tool.annotations?.readOnlyHint).map(tool => tool.name).sort();
  assert.deepEqual(readOnly, ['check_worker_status', 'get_settings', 'get_workflow', 'list_roles',
    'list_workers', 'read_worker_log']);
  // The three tools that change the repository must never claim to be read-only.
  for (const name of ['spawn_worker', 'kill_worker', 'merge_and_cleanup_worker']) {
    const tool = tools.find(entry => entry.name === name);
    assert.equal(tool.annotations.readOnlyHint, false, `${name} must not be read-only`);
    assert.equal(tool.annotations.destructiveHint, true, `${name} must be marked destructive`);
  }
});

test('list_roles makes the worker catalog discoverable without out-of-band instructions', async t => {
  const { client } = await connect(t);
  const roles = await call(client, 'list_roles');
  assert.deepEqual(roles.map(role => role.name),
    ['adversary', 'developer', 'planner', 'researcher', 'reviewer', 'wiki-maintainer']);
  for (const role of roles) {
    assert.deepEqual(Object.keys(role).sort(),
      ['access', 'description', 'effort', 'engine', 'model', 'name', 'profile']);
    assert.ok(['reasoning', 'balanced', 'fast'].includes(role.profile));
    // Resolved, not merely configured: the conductor can see what a role will
    // actually run without spawning a worker to find out.
    assert.ok(['claude', 'codex', 'antigravity'].includes(role.engine), `${role.name} resolves an engine`);
    assert.ok(['read-only', 'write'].includes(role.access));
    assert.ok(role.description.length > 0, `${role.name} needs a description to be selectable`);
    // A leaked macro or stray YAML quote would reach the conductor verbatim.
    assert.ok(!role.description.includes('{{cmd:'), `${role.name} leaks an unexpanded macro`);
    assert.ok(!/^"|"$/.test(role.description), `${role.name} leaks YAML quoting`);
  }
  const byName = Object.fromEntries(roles.map(role => [role.name, role]));
  assert.equal(byName.adversary.access, 'read-only');
  assert.equal(byName.adversary.profile, 'reasoning');
  assert.equal(byName.developer.access, 'write');
  // defaultEngine is "inherit", so every role follows the conductor's own CLI
  // until a per-role override in .harness/settings.json says otherwise.
  assert.equal(byName.developer.engine, 'claude');
  assert.equal(byName.adversary.model, 'opus');
  assert.equal(byName.developer.model, 'sonnet');
  assert.equal(byName.researcher.model, 'haiku');
  // spawn_worker must point at this catalog rather than expecting prior knowledge.
  const { tools } = await client.listTools();
  const spawn = tools.find(tool => tool.name === 'spawn_worker');
  assert.match(spawn.description, /list_roles/);
  assert.match(spawn.inputSchema.properties.role.description, /list_roles/);
});

test('settings and workflows reach the conductor with user context kept as data', async t => {
  const { client } = await connect(t);
  const settings = await call(client, 'get_settings');
  assert.equal(settings.conductor_engine, 'claude');
  assert.equal(settings.worker_mode, false);
  assert.deepEqual(Object.keys(settings.engines).sort(), ['antigravity', 'claude', 'codex']);
  const { prompts } = await client.listPrompts();
  assert.ok(prompts.some(prompt => prompt.name === 'project-work'));
  // Free text must survive verbatim and stay quarantined as JSON, never spliced
  // into anything a shell or the model could read as an instruction.
  const context = 'ship "auth" & rm -rf /; café\nsecond line';
  const workflow = await client.callTool({ name: 'get_workflow', arguments: { name: 'work', context } });
  const text = workflow.content[0].text;
  assert.ok(!text.includes('{{arguments}}'), 'argument macro must be expanded');
  assert.ok(text.includes(JSON.stringify({ context })), 'context must be delivered as a JSON envelope');
  for (const bad of ['..', 'work/../init', 'Work', 'nonexistent']) {
    const rejected = await client.callTool({ name: 'get_workflow', arguments: { name: bad } });
    assert.ok(rejected.isError, `get_workflow must reject ${bad}`);
  }
});

test('a worker-mode server cannot dispatch, cancel, or integrate', async t => {
  const { client } = await connect(t, { worker: true });
  const { tools } = await client.listTools();
  const names = tools.map(tool => tool.name);
  for (const forbidden of ['spawn_worker', 'kill_worker', 'merge_and_cleanup_worker']) {
    assert.ok(!names.includes(forbidden), `worker mode must not expose ${forbidden}`);
  }
  // Read-only introspection stays available so a worker can still orient itself.
  assert.ok(names.includes('list_roles') && names.includes('get_settings'));
  assert.equal((await call(client, 'get_settings')).worker_mode, true);
  // An unregistered tool must fail rather than fall through to the manager.
  const attempt = await client.callTool({ name: 'spawn_worker', arguments: { role: 'developer', instructions: 'x' } })
    .then(result => result, error => ({ isError: true, error }));
  assert.ok(attempt.isError, 'worker-mode spawn_worker must not succeed');
});
