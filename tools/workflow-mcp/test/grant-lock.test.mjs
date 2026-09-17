// grantAntigravitySetup edits one user-global file that every conductor on the
// machine shares, and the workflow runs conductors concurrently. Adversary
// round 1 on fix/workflow-mcp-hardening, F4: an unlocked read-modify-write let
// two of them lose each other's additions, and the loser's next worker was
// then denied silently. The property under test is the one that matters — no
// grant is ever lost — measured across real processes, plus the two edges a
// lock file brings with it: a holder that died, and a holder that is alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { grantAntigravitySetup } from '../availability.mjs';
import { cleanup, fixture } from './helpers.mjs';

const MODULE = pathToFileURL(resolve(import.meta.dirname, '../availability.mjs')).href;
const settingsFile = home => resolve(home, '.gemini', 'antigravity-cli', 'settings.json');

// Isolates $HOME/$USERPROFILE for the duration of `fn`, so a real machine's
// own antigravity-cli settings are never read, let alone written, here.
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

test('grants from concurrent processes are all kept — none is lost to another writer', async () => {
  const home = fixture();
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const PROCESSES = 3;
  const GRANTS_EACH = 15;
  try {
    await Promise.all(Array.from({ length: PROCESSES }, (_, i) => new Promise((done, fail) => {
      const script = `import { grantAntigravitySetup } from ${JSON.stringify(MODULE)};\n`
        + `for (let k = 0; k < ${GRANTS_EACH}; k++) grantAntigravitySetup({ workerCommands: ['cmd-${i}-' + k] });\n`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', script],
        { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', fail);
      child.on('exit', code => code === 0 ? done() : fail(new Error(`process ${i} exited ${code}: ${stderr}`)));
    })));
    const allow = JSON.parse(readFileSync(settingsFile(home), 'utf8')).permissions.allow;
    const expected = Array.from({ length: PROCESSES }, (_, i) =>
      Array.from({ length: GRANTS_EACH }, (_, k) => `command(cmd-${i}-${k})`)).flat();
    assert.deepEqual([...allow].sort(), expected.sort(), 'every process\'s grants survived every other process\'s writes');
    assert.deepEqual(readdirSync(dirname(settingsFile(home))), ['settings.json'], 'no lock or staging file left behind');
  } finally { cleanup(home); }
});

test('a lock left behind by a dead process is taken over once it is stale', () => {
  withHome(home => {
    const file = settingsFile(home);
    mkdirSync(dirname(file), { recursive: true });
    const lock = `${file}.lock`;
    writeFileSync(lock, '99999');
    const fiveMinutesAgo = (Date.now() - 5 * 60_000) / 1000;
    utimesSync(lock, fiveMinutesAgo, fiveMinutesAgo);
    const result = grantAntigravitySetup({ workerCommands: ['npm test'] });
    assert.deepEqual(result.added, ['command(npm test)']);
    assert.equal(existsSync(lock), false, 'the stale lock is gone afterwards');
    assert.deepEqual(readdirSync(dirname(file)), ['settings.json']);
  });
});

test('a live lock is waited for, then refused with the file untouched and the lock left alone', () => {
  withHome(home => {
    const file = settingsFile(home);
    mkdirSync(dirname(file), { recursive: true });
    const original = JSON.stringify({ permissions: { allow: ['command(git status)'] } });
    writeFileSync(file, original);
    const lock = `${file}.lock`;
    writeFileSync(lock, String(process.pid));
    const started = Date.now();
    assert.throws(() => grantAntigravitySetup({ workerCommands: ['npm test'] }, { lockTimeoutMs: 150 }),
      /held by another process/);
    assert.ok(Date.now() - started >= 100, 'it waited for the holder before giving up');
    assert.equal(readFileSync(file, 'utf8'), original, 'nothing was written');
    assert.equal(existsSync(lock), true, 'a live lock is never deleted out from under its holder');
  });
});
