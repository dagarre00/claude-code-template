// The command as an adopting project runs it. `startConfigServer` is covered in
// config-ui.test.mjs; what is not is everything around it that the guide promises:
// it runs with no `npm install` (adoption copies `tools/workflow-mcp/` without
// node_modules or test/), from any working directory, and finds the project by
// its own location. This lays out exactly that tree and runs the real script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fixture } from './helpers.mjs';

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// A project shaped like one that ran scripts/adopt.sh, minus the npm install.
const adopted = () => {
  const root = fixture({ '.agents/config.json': JSON.stringify({ version: 1, defaultEngine: 'inherit' }) });
  cpSync(TOOL, resolve(root, 'tools/workflow-mcp'), {
    recursive: true,
    filter: source => !['node_modules', 'test'].includes(relative(TOOL, source).split(sep)[0])
  });
  return root;
};

const run = (args, cwd) => {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  const done = new Promise(resolveExit => child.on('exit', code => resolveExit({ code, out, err })));
  const printedUrl = () => new Promise((found, fail) => {
    const started = Date.now();
    const poll = setInterval(() => {
      // The whole token and the newline after it: stdout can arrive in pieces, and
      // a URL cut mid-token is a 403 that looks like a bug in the server.
      const match = /http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{32}(?=\s)/.exec(out);
      if (match) { clearInterval(poll); found(match[0]); }
      else if (Date.now() - started > 10000) { clearInterval(poll); fail(new Error(`no URL printed; stdout=${out} stderr=${err}`)); }
    }, 25);
  });
  return { child, done, printedUrl };
};

test('with no node_modules and from any directory, it finds the project by where the script lives', async () => {
  const root = adopted();
  const elsewhere = mkdtempSync(resolve(tmpdir(), 'elsewhere-'));
  const { child, done, printedUrl } = run([resolve(root, 'tools/workflow-mcp/config-ui.mjs'), '--no-open'], elsewhere);
  try {
    const url = new URL(await printedUrl());
    const res = await fetch(`${url.origin}/api/config`, { headers: { 'X-Config-Token': url.searchParams.get('t') } });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.path, '.agents/config.json');
    assert.deepEqual(body.meta.roles.map(role => role.name).sort(), ['adversary', 'developer'],
      'the roles of the project the script sits in, not of the directory it was run from');
  } finally {
    // Wait for it to be gone before deleting what it has open: on Windows a
    // just-killed process still holds its files, and the delete fails with EBUSY.
    child.kill();
    await done;
    cleanup(root); cleanup(elsewhere);
  }
});

test('--root points it at a project, and a path with no .agents/ is refused with the fix', async () => {
  const root = adopted();
  const empty = mkdtempSync(resolve(tmpdir(), 'no-agents-'));
  try {
    const refused = await run([resolve(root, 'tools/workflow-mcp/config-ui.mjs'), '--root', empty, '--no-open'], empty).done;
    assert.equal(refused.code, 1);
    assert.match(refused.err, /No \.agents\/ directory.*--root/);
  } finally { cleanup(root); cleanup(empty); }
});

test('--help prints the usage and exits without starting a server', async () => {
  const root = adopted();
  try {
    const help = await run([resolve(root, 'tools/workflow-mcp/config-ui.mjs'), '--help'], root).done;
    assert.equal(help.code, 0);
    for (const flag of ['--root', '--port', '--no-open']) assert.ok(help.out.includes(flag), flag);
  } finally { cleanup(root); }
});
