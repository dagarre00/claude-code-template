// The conductor side of the workflow had no mechanical check at all: nothing
// stopped a code change landing without its wiki update, a broken wikilink, a
// log entry out of order, or an architecture rule loosened without an ADR — and
// the template's own history broke two of those. verify.mjs is the stack-
// independent half of CI: git and files only, so it runs anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generate } from '../generate.mjs';
import { sortLog, verify } from '../verify.mjs';
import { cleanup, fixture } from './helpers.mjs';

const LOG = kinds => '# Log\n\n' + kinds.map(([stamp, kind]) => `## [${stamp}] ${kind}\n\n- entry\n`).join('\n');
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const put = (root, path, body) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), body); };

function project(files, fn) {
  const root = fixture({
    '.agents/config.json': JSON.stringify({ version: 1, protectedPaths: ['.agents'], architecture: { command: null, rules: ['arch.rules'] } }),
    'docs/wiki/log.md': LOG([['2026-09-01 10:00', 'init'], ['2026-09-02 09:00', 'work']]),
    'docs/wiki/entities/auth.md': '# Auth\n\nSee [[gotchas]] and [[decisions/2026-09-01-jwt|the JWT decision]].\n',
    'docs/wiki/gotchas.md': '# Gotchas\n\n```markdown\n**Related:** [[entities/<slug>]], [[concepts/never-exists]]\n```\n\nInline `[[not-a-link]]`.\n',
    'docs/wiki/decisions/2026-09-01-jwt.md': '# JWT\n\nBack to [[auth]] and [[#Context]].\n',
    'arch.rules': 'layers\n',
    ...files
  });
  generate(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@e.com');
  git(root, 'config', 'user.name', 'T');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'base');
  try { return fn(root); } finally { cleanup(root); }
}

const failing = result => result.checks.filter(check => !check.ok).map(check => check.id);

test('a healthy project passes: links resolve by path or by basename, code and templates are ignored', () => {
  project({}, root => {
    const result = verify(root);
    assert.deepEqual(failing(result), [], JSON.stringify(result.checks, null, 2));
    assert.equal(result.ok, true);
  });
});

test('a broken wikilink fails, naming the page and the target', () => {
  project({ 'docs/wiki/concepts/retry.md': '# Retry\n\nUses [[entities/billing]].\n' }, root => {
    const check = verify(root).checks.find(entry => entry.id === 'wikilinks');
    assert.equal(check.ok, false);
    assert.match(check.details.join('\n'), /concepts\/retry\.md.*entities\/billing/);
  });
});

test('generated-file drift fails', () => {
  project({}, root => {
    put(root, 'AGENTS.md', 'hand edited\n');
    assert.deepEqual(failing(verify(root)), ['generated']);
  });
});

// Measured from a Codex conductor's report on Windows: its stdout encoding did
// not round-trip UTF-8, so every non-ASCII character it wrote came out as a
// literal `?`, plus a stray BOM at the top of the file — and nothing here
// caught either, since both are valid text on their own.
test('a UTF-8 BOM at the top of a wiki page fails', () => {
  project({ 'docs/wiki/concepts/retry.md': '﻿# Retry\n\nBackoff.\n' }, root => {
    const check = verify(root).checks.find(entry => entry.id === 'encoding');
    assert.equal(check.ok, false);
    assert.match(check.details.join('\n'), /concepts\/retry\.md.*BOM/);
  });
});

test('a literal "?" between two digits — a mangled dash, ×, or ° — fails', () => {
  project({ 'docs/wiki/concepts/retry.md': '# Retry\n\nMeasured 2026-09-10?14, three runs.\n' }, root => {
    const check = verify(root).checks.find(entry => entry.id === 'encoding');
    assert.equal(check.ok, false);
    assert.match(check.details.join('\n'), /concepts\/retry\.md.*between two digits/);
  });
});

test('a "?" inside a fenced code block or as a real question mark is left alone', () => {
  project({ 'docs/wiki/concepts/retry.md':
    '# Retry\n\nIs 3 retries enough? Maybe.\n\n```\n2026-09-10?14\n```\n' }, root => {
    assert.equal(verify(root).checks.find(entry => entry.id === 'encoding').ok, true);
  });
});

test('log entries must use the closed kind vocabulary and be oldest first', () => {
  project({ 'docs/wiki/log.md': LOG([['2026-09-03 10:00', 'work'], ['2026-09-02 09:00', 'chore'], ['2026-09-04 09:00', 'shipping']]) }, root => {
    const check = verify(root).checks.find(entry => entry.id === 'log');
    assert.equal(check.ok, false);
    const details = check.details.join('\n');
    assert.match(details, /out of order/);
    assert.match(details, /shipping/);
  });
});

// A union merge of two branches' appended entries keeps both, in branch order
// rather than time order — so the fix is one command, not a hand edit.
test('sortLog puts entries back in time order, keeping the preamble and every entry intact', () => {
  project({ 'docs/wiki/log.md': '---\ntype: reference\n---\n\n# Log\n\n> preamble\n\n'
    + LOG([['2026-09-03 10:00', 'work'], ['2026-09-02 09:00', 'chore'], ['2026-09-02 09:00', 'pr']]).replace('# Log\n\n', '') }, root => {
    assert.equal(sortLog(root), 3);
    const text = readFileSync(resolve(root, 'docs/wiki/log.md'), 'utf8');
    assert.match(text, /^---\ntype: reference\n---\n\n# Log\n\n> preamble\n\n## \[2026-09-02 09:00\] chore/);
    assert.ok(text.indexOf('] pr') < text.indexOf('] work'), 'equal stamps keep their order, and precede later ones');
    assert.equal(verify(root).checks.find(entry => entry.id === 'log').ok, true);
  });
});

test('against a base: code without a wiki change and a change without a log entry both fail', () => {
  project({}, root => {
    put(root, 'src/app.mjs', 'export {};\n');
    git(root, 'add', '-A'); git(root, 'commit', '-qm', 'feat: code only');
    const ids = failing(verify(root, { base: 'HEAD~1' }));
    assert.ok(ids.includes('range.wiki'), ids.join());
    assert.ok(ids.includes('range.log'), ids.join());
  });
});

test('against a base: code with its wiki page and a log entry passes', () => {
  project({}, root => {
    put(root, 'src/app.mjs', 'export {};\n');
    put(root, 'docs/wiki/entities/auth.md', '# Auth\n\nImplemented in src/app.mjs. See [[gotchas]].\n');
    put(root, 'docs/wiki/log.md', LOG([['2026-09-01 10:00', 'init'], ['2026-09-02 09:00', 'work'], ['2026-09-03 09:00', 'work']]));
    git(root, 'add', '-A'); git(root, 'commit', '-qm', 'feat: code with wiki');
    assert.deepEqual(failing(verify(root, { base: 'HEAD~1' })), []);
  });
});

test('against a base: an architecture rule changed without an ADR fails', () => {
  project({}, root => {
    put(root, 'arch.rules', 'layers, loosened\n');
    put(root, 'docs/wiki/log.md', LOG([['2026-09-01 10:00', 'init'], ['2026-09-02 09:00', 'work'], ['2026-09-03 09:00', 'chore']]));
    git(root, 'add', '-A'); git(root, 'commit', '-qm', 'chore: loosen');
    const check = verify(root, { base: 'HEAD~1' }).checks.find(entry => entry.id === 'range.architecture');
    assert.equal(check.ok, false);
    assert.match(check.details.join('\n'), /arch\.rules/);

    put(root, 'docs/wiki/decisions/2026-09-03-loosen-layers.md', '# Loosen\n\nSee [[auth]].\n');
    git(root, 'add', '-A'); git(root, 'commit', '-qm', 'docs: ADR');
    assert.equal(verify(root, { base: 'HEAD~2' }).checks.find(entry => entry.id === 'range.architecture').ok, true);
  });
});

test('a commit trailer can state that a code change needs no wiki update, with its reason', () => {
  project({}, root => {
    put(root, 'src/app.mjs', 'export {};\n');
    put(root, 'docs/wiki/log.md', LOG([['2026-09-01 10:00', 'init'], ['2026-09-02 09:00', 'work'], ['2026-09-03 09:00', 'chore']]));
    git(root, 'add', '-A'); git(root, 'commit', '-qm', 'refactor: rename a local', '-m', 'Wiki-Update: none (no behavior change)');
    assert.deepEqual(failing(verify(root, { base: 'HEAD~1' })), []);
  });
});

test('layers declared in the wiki with no architecture check configured is a warning, not a failure', () => {
  project({ '.agents/config.json': JSON.stringify({ version: 1 }),
    'docs/wiki/architecture.md': '# Architecture\n\n## Layers\n\n| Layer | May depend on |\n| --- | --- |\n| domain | nothing |\n' }, root => {
    const result = verify(root);
    assert.equal(result.ok, true);
    assert.match(result.warnings.join('\n'), /Layers.*no architecture check/);
  });
});
