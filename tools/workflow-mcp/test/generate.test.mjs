import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate, checkGenerated, GENERATED } from '../generate.mjs';
import { cleanup, fixture } from './helpers.mjs';

const withRepo = (fn, overrides = {}) => {
  const root = fixture(overrides);
  try { return fn(root); } finally { cleanup(root); }
};
const read = (root, file) => readFileSync(resolve(root, file), 'utf8');

test('writes exactly the two root files the CLIs hardcode, and no copies', () => {
  withRepo(root => {
    const written = generate(root);
    assert.deepEqual(written.map(w => w.path).sort(), ['AGENTS.md', 'CLAUDE.md']);
    // The point of the whole design: skills are read in place from .agents/,
    // never duplicated into a per-CLI directory.
    assert.ok(!written.some(w => w.path.includes('skills/')));
  });
});

test('AGENTS.md carries the project, the full rules, and both catalogs', () => {
  withRepo(root => {
    generate(root);
    const agents = read(root, 'AGENTS.md');
    assert.match(agents, /Wiki-first/);              // rules
    assert.match(agents, /Branch and commit/);       // conductor rules included here
    assert.match(agents, /\/project:work/);          // command catalog
    assert.match(agents, /developer/);               // agent catalog
    assert.match(agents, /balanced/);                // profile is visible
  });
});

test('CLAUDE.md imports AGENTS.md rather than restating it', () => {
  withRepo(root => {
    generate(root);
    const claude = read(root, 'CLAUDE.md');
    assert.match(claude, /@AGENTS\.md/);
    // Restating the rules would create a second source of truth to drift.
    assert.doesNotMatch(claude, /Wiki-first/);
  });
});

test('both files say they are generated and name the source', () => {
  withRepo(root => {
    generate(root);
    for (const file of GENERATED) {
      assert.match(read(root, file), /DO NOT EDIT/i);
      assert.match(read(root, file), /\.agents\//);
    }
  });
});

test('check passes immediately after generate', () => {
  withRepo(root => {
    generate(root);
    assert.deepEqual(checkGenerated(root).drifted, []);
  });
});

test('check reports a hand-edited generated file by name', () => {
  withRepo(root => {
    generate(root);
    writeFileSync(resolve(root, 'AGENTS.md'), 'hand-written nonsense\n');
    const result = checkGenerated(root);
    assert.deepEqual(result.drifted, ['AGENTS.md']);
    assert.equal(result.ok, false);
  });
});

test('check reports a missing generated file rather than throwing', () => {
  withRepo(root => {
    const result = checkGenerated(root);
    assert.ok(result.drifted.includes('AGENTS.md'));
  });
});

test('generate is deterministic — running twice changes nothing', () => {
  withRepo(root => {
    generate(root);
    const first = GENERATED.map(f => read(root, f));
    generate(root);
    assert.deepEqual(GENERATED.map(f => read(root, f)), first);
  });
});

test('a new command appears in the catalog without any file being copied', () => {
  withRepo(root => {
    writeFileSync(resolve(root, '.agents/commands/ship.md'),
      '---\nname: ship\ndescription: Ship it.\nskills: [tdd-loop]\n---\n\nBody.\n');
    generate(root);
    assert.match(read(root, 'AGENTS.md'), /\/project:ship/);
  });
});
