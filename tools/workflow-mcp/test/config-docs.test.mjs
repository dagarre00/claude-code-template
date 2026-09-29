// The config guide is what an adopting project reads: the template's README is
// not copied to it, `tools/workflow-mcp/` is. So the guide has to live there, stay
// complete as the loader grows a key, and be reachable from the places a person
// already looks. Each check below is a way that documentation quietly rots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_KEYS } from '../config.mjs';
import { ENGINES } from '../engines/index.mjs';

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(TOOL, '../..');
const read = path => readFileSync(resolve(REPO, path), 'utf8');
const GUIDE = 'tools/workflow-mcp/config.md';

test('the guide exists next to the tool, where adoption copies it from', () => {
  assert.ok(existsSync(resolve(REPO, GUIDE)), `${GUIDE} is missing`);
});

test('the guide documents every key the loader accepts', () => {
  const guide = read(GUIDE);
  for (const [where, keys] of Object.entries(CONFIG_KEYS)) {
    for (const key of keys) {
      assert.ok(guide.includes(`\`${key}\``), `${GUIDE} never documents ${where} key \`${key}\``);
    }
  }
});

test('the guide documents the command, its flags, and how a changed setting takes effect', () => {
  const guide = read(GUIDE);
  for (const needle of ['node tools/workflow-mcp/config-ui.mjs', '--root', '--port', '--no-open',
    'grant_antigravity_setup', 'no restart']) {
    assert.ok(guide.includes(needle), `${GUIDE} does not mention ${needle}`);
  }
});

test('the guide lists the efforts each engine accepts, as the adapters define them', () => {
  const guide = read(GUIDE);
  for (const [name, engine] of Object.entries(ENGINES)) {
    assert.ok(guide.includes(`| \`${name}\` | ${engine.efforts.join(', ')} |`),
      `${GUIDE} does not list ${name}'s efforts as: ${engine.efforts.join(', ')}`);
  }
});

test('the guide lists the models each engine runs, as the adapters define them', () => {
  const guide = read(GUIDE);
  const code = list => list.map(prefix => `\`${prefix}\``).join(', ');
  for (const [name, engine] of Object.entries(ENGINES)) {
    const excludes = engine.modelExcludes?.length ? ` (not ${code(engine.modelExcludes)})` : '';
    assert.ok(guide.includes(`| \`${name}\` | ${code(engine.modelPrefixes)}${excludes} |`),
      `${GUIDE} does not list ${name}'s models as: ${code(engine.modelPrefixes)}${excludes}`);
  }
});

test('every relative link in the guide resolves, from where an adopting project has it', () => {
  const guide = read(GUIDE);
  const links = [...guide.matchAll(/\]\((?!https?:|#)([^)#\s]+)/g)].map(match => match[1]);
  assert.ok(links.length, 'a guide with no links to the docs around it is an island');
  for (const link of links) {
    // Relative to tools/workflow-mcp/, which is also where it sits in an adopting
    // project. `../..` therefore reaches that project's root, not the template's.
    assert.ok(existsSync(resolve(TOOL, link)), `${GUIDE} links to ${link}, which does not exist`);
  }
});

test('the places a person looks first all point at the editor', () => {
  const entryPoints = {
    'tools/workflow-mcp/getting-started.md': 'first-time setup, and the "something is wrong" table',
    'tools/workflow-mcp/engine-setup.md': 'where the workerCommands allowlist is explained',
    '.agents/commands/init.md': 'step 0a asks per role which engine and model',
    '.agents/commands/sync-template.md': 'step 7 tells you to fix a rejected config',
    'scripts/adopt.sh': 'what an adopter reads last, in the terminal',
    'README.md': 'the template\'s own front page',
    'scripts/release-readme.md': 'the README a project started from a release opens with'
  };
  for (const [path, why] of Object.entries(entryPoints)) {
    assert.match(read(path), /config-ui\.mjs|config\.md/, `${path} does not mention the editor or its guide (${why})`);
  }
});
