// A new project used to start as a clone of the whole template, so it inherited
// the template's own test suite, its CI (which runs that suite, and so failed on
// the project's first push), adopt.sh and the template's front page.
// scripts/release.mjs builds what a project starts from instead: one tagged
// tree, minus what only the template uses. Each check below is a way that zip
// could quietly ship the wrong thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { REWRITTEN, TEMPLATE_ONLY } from '../../../scripts/release.mjs';
import { cleanup } from './helpers.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RELEASE = resolve(REPO, 'scripts/release.mjs');

const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const put = (root, path, body) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), body); };

const TEMPLATE_README = '# Agentic Development Template\n\ngit clone <this-template> my-project\n';
const PACKAGE = {
  name: 'workflow-mcp',
  scripts: { config: 'node config-ui.mjs', test: 'node --test "test/*.test.mjs"', e2e: 'node e2e/run.mjs' },
  dependencies: { zod: '^3.25.76' }
};

// A template shaped like this one, committed and tagged 1.2.3.
function template(fn) {
  const root = mkdtempSync(resolve(tmpdir(), 'release-'));
  const out = resolve(root, '.out');
  const files = {
    'README.md': TEMPLATE_README,
    'LICENSE': 'MIT License\n',
    '.gitattributes': 'docs/wiki/log.md merge=union\n',
    '.gitignore': 'node_modules/\n.out/\n',
    '.agents/rules.md': '# Behavioral Rules\n\n1. **Wiki-first.**\n',
    'docs/raw/README.md': '# Raw sources\n',
    'docs/wiki/log.md': '# Log\n',
    'tools/workflow-mcp/server.mjs': 'export {};\n',
    'tools/workflow-mcp/package.json': JSON.stringify(PACKAGE, null, 2) + '\n',
    'tools/workflow-mcp/e2e/run.mjs': 'export {};\n',
    'tools/workflow-mcp/test/server.test.mjs': 'export {};\n',
    '.github/workflows/verify.yml': 'name: verify\n',
    'scripts/adopt.sh': '#!/usr/bin/env bash\n'
  };
  for (const [path, body] of Object.entries(files)) put(root, path, body);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@e.com');
  git(root, 'config', 'user.name', 'T');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'base');
  git(root, 'tag', '1.2.3');
  try { return fn(root, out); } finally { cleanup(root); }
}

const release = (root, out, ...args) =>
  spawnSync(process.execPath, [RELEASE, ...args, '--repo', root, '--out', out], { encoding: 'utf8' });

// The entries of a zip, path → text: just enough of the format to read what
// `git archive` writes, without a dependency. Directory entries are skipped.
function unzip(file) {
  const zip = readFileSync(file);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = zip.readUInt32LE(end + 16);
  const entries = new Map();
  for (let left = zip.readUInt16LE(end + 10); left > 0; left--) {
    const nameLength = zip.readUInt16LE(at + 28);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + zip.readUInt32LE(at + 20));
    if (!name.endsWith('/')) entries.set(name, (zip.readUInt16LE(at + 10) === 8 ? inflateRawSync(data) : data).toString('utf8'));
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return entries;
}

// Builds and reads back one release, with the folder prefix stripped.
function built(root, out, version, ...args) {
  const run = release(root, out, version, ...args);
  assert.equal(run.status, 0, run.stderr);
  const zip = resolve(out, `claude-code-template-${version}.zip`);
  assert.equal(run.stdout.trim(), zip, 'stdout is the path of the zip, and only that');
  const folder = `claude-code-template-${version}/`;
  const files = new Map();
  for (const [name, body] of unzip(zip)) {
    assert.ok(name.startsWith(folder), `${name} is outside the release's one folder, ${folder}`);
    files.set(name.slice(folder.length), body);
  }
  return files;
}

test('a release is the tagged tree in one versioned folder: the workflow, the empty wiki and the license', () => {
  template((root, out) => {
    put(root, '.agents/rules.md', '# Behavioral Rules\n\n1. **Changed after the tag.**\n');
    git(root, 'commit', '-qam', 'after the tag');
    const files = built(root, out, '1.2.3');
    for (const path of ['.agents/rules.md', 'docs/raw/README.md', 'docs/wiki/log.md', 'tools/workflow-mcp/server.mjs',
      'tools/workflow-mcp/e2e/run.mjs', 'LICENSE', '.gitattributes', '.gitignore']) {
      assert.ok(files.has(path), `the release is missing ${path}`);
    }
    assert.match(files.get('.agents/rules.md'), /Wiki-first/, 'the release is built from the tag, not from a later commit');
  });
});

test('what only the template uses stays out: its test suite, its CI and its scripts', () => {
  template((root, out) => {
    const shipped = [...built(root, out, '1.2.3').keys()];
    for (const dropped of ['tools/workflow-mcp/test/', '.github/', 'scripts/']) {
      assert.deepEqual(shipped.filter(path => path.startsWith(dropped)), [], `${dropped} is template-only`);
    }
  });
});

test('the server keeps every npm script but the template-only test', () => {
  template((root, out) => {
    const pkg = JSON.parse(built(root, out, '1.2.3').get('tools/workflow-mcp/package.json'));
    assert.deepEqual(pkg.scripts, { config: PACKAGE.scripts.config, e2e: PACKAGE.scripts.e2e });
    assert.deepEqual(pkg.dependencies, PACKAGE.dependencies);
  });
});

test('the README is a starter for the new project that names the release it came from', () => {
  template((root, out) => {
    const readme = built(root, out, '1.2.3').get('README.md');
    assert.ok(readme, 'the release has no README.md');
    assert.notEqual(readme, TEMPLATE_README, "the template's own front page shipped");
    for (const needle of ['1.2.3', '/project:init', 'npm ci', 'tools/workflow-mcp/getting-started.md']) {
      assert.ok(readme.includes(needle), `the starter README does not mention ${needle}`);
    }
    assert.doesNotMatch(readme, /\{\{/, 'a placeholder was left unfilled');
  });
});

test('only committed content ships: never an uncommitted edit, an untracked file or an ignored one', () => {
  template((root, out) => {
    put(root, 'LICENSE', 'edited, not committed\n');
    put(root, 'docs/wiki/untracked.md', '# Untracked\n');
    put(root, 'tools/workflow-mcp/node_modules/zod/index.js', 'ignored\n');
    const files = built(root, out, 'preview', '--ref', 'HEAD');
    assert.equal(files.get('LICENSE'), 'MIT License\n');
    assert.equal(files.has('docs/wiki/untracked.md'), false);
    assert.deepEqual([...files.keys()].filter(path => path.includes('node_modules')), []);
  });
});

test("line endings are the repository's, whatever core.autocrlf says", () => {
  template((root, out) => {
    git(root, 'config', 'core.autocrlf', 'true');
    for (const [path, body] of built(root, out, '1.2.3')) {
      assert.doesNotMatch(body, /\r/, `${path} has CRLF line endings`);
    }
  });
});

test('without --ref the version must be a tag; a missing one is refused, saying how to preview', () => {
  template((root, out) => {
    const run = release(root, out, '9.9.9');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /9\.9\.9/);
    assert.match(run.stderr, /--ref HEAD/);
    assert.equal(existsSync(resolve(out, 'claude-code-template-9.9.9.zip')), false);
  });
});

test('a version that is not a plain name is refused before anything is built', () => {
  template((root, out) => {
    for (const version of ['../escape', 'a b', '.hidden']) {
      const run = release(root, out, version, '--ref', 'HEAD');
      assert.notEqual(run.status, 0, `"${version}" was accepted`);
      assert.match(run.stderr, /version/i);
    }
    assert.equal(existsSync(out), false, 'something was written for a refused version');
  });
});

test('no version prints the usage and fails', () => {
  const run = spawnSync(process.execPath, [RELEASE], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Usage/);
});

test('every path the release drops or rewrites exists in the template, so a rename cannot silently ship it', () => {
  const paths = [...Object.keys(TEMPLATE_ONLY), ...Object.keys(REWRITTEN)];
  assert.ok(paths.length, 'the release drops nothing');
  for (const path of paths) assert.ok(existsSync(resolve(REPO, path)), `${path} no longer exists in the template`);
});
