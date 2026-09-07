import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCanonical, workerRules } from '../canonical.mjs';
import { cleanup, fixture } from './helpers.mjs';

const withFixture = (overrides, fn) => {
  const root = fixture(overrides);
  try { return fn(root); } finally { cleanup(root); }
};

test('reads roles with their profile and access', () => {
  withFixture({}, root => {
    const { roles } = loadCanonical(root);
    const developer = roles.find(r => r.name === 'developer');
    assert.equal(developer.profile, 'balanced');
    assert.equal(developer.access, 'write');
    assert.equal(developer.description, 'TDD in one agent.');
    // The body is what gets inlined into a prompt, so the frontmatter must be gone.
    assert.match(developer.body, /You run red, green, refactor\./);
    assert.doesNotMatch(developer.body, /profile:/);
  });
});

test('reads commands with their declared skills', () => {
  withFixture({}, root => {
    const { commands } = loadCanonical(root);
    const work = commands.find(c => c.name === 'work');
    assert.deepEqual(work.skills, ['tdd-loop', 'wiki-update']);
    assert.match(work.body, /Step 1\. Read the spec\./);
  });
});

test('accepts the YAML list form for declared skills', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: The core TDD loop.\nskills:\n  - tdd-loop\n  - wiki-update\n---\n\nBody.\n'
  }, root => {
    const { commands } = loadCanonical(root);
    assert.deepEqual(commands.find(c => c.name === 'work').skills, ['tdd-loop', 'wiki-update']);
  });
});

test('a bracketed argument-hint stays a string and is not split on commas', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nargument-hint: [todo, entity, or scope — e.g. "the login endpoint"]\nskills: [tdd-loop]\n---\n\nBody.\n'
  }, root => {
    const work = loadCanonical(root).commands.find(c => c.name === 'work');
    assert.equal(typeof work.argumentHint, 'string');
    assert.match(work.argumentHint, /the login endpoint/);
    assert.deepEqual(work.skills, ['tdd-loop']);
  });
});

test('a command declaring a skill that does not exist is an error naming both', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills: [tdd-loop, ghost-skill]\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), err =>
      /ghost-skill/.test(err.message) && /work/.test(err.message));
  });
});

test('an unknown profile is an error naming the file, never a silent drop', () => {
  withFixture({
    '.agents/agents/developer.md':
      '---\nname: developer\ndescription: d\nprofile: turbo\naccess: write\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer\.md/);
  });
});

test('an unknown access level is an error', () => {
  withFixture({
    '.agents/agents/developer.md':
      '---\nname: developer\ndescription: d\nprofile: balanced\naccess: sudo\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer\.md/);
  });
});

test('a role whose frontmatter name disagrees with its filename is an error', () => {
  withFixture({
    '.agents/agents/developer.md':
      '---\nname: coder\ndescription: d\nprofile: balanced\naccess: write\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer/);
  });
});

test('reads skills with the frontmatter stripped from the inlined body', () => {
  withFixture({}, root => {
    const { skills } = loadCanonical(root);
    const tdd = skills.find(s => s.name === 'tdd-loop');
    assert.equal(tdd.description, 'Red-green-refactor for this project.');
    assert.match(tdd.body, /Write the failing test first\./);
    assert.doesNotMatch(tdd.body, /^---/);
  });
});

test('reads the behavioral rules verbatim', () => {
  withFixture({}, root => {
    assert.match(loadCanonical(root).rules, /Wiki-first/);
  });
});

test('a skill directory with no SKILL.md is an error, not an empty skill', () => {
  withFixture({ '.agents/skills/broken/NOTES.md': 'stray\n' }, root => {
    assert.throws(() => loadCanonical(root), /broken/);
  });
});

// A worker is told "never run git" by the contract. Sending it a rule that says
// "branch, commit and open a PR" is a direct contradiction, so conductor-only
// rules must not reach a worker prompt at all.
const RULES = `# Behavioral Rules

Hard constraints from real failures.

1. **Wiki-first.** Spec before code.

2. **Branch and commit.** Open a PR when done. <!-- conductor-only -->

3. **Obsidian standard.** The invariants:
    - **Wikilinks.** Internal links are [[wiki-style]].
    - **Identity.** Filename is identity.

4. **Findings get dispositions.** Commit the record. <!-- conductor-only -->

## Adding rules

Append new rules here when a failure pattern emerges.
`;

test('worker rules drop the conductor-only ones and keep the rest whole', () => {
  const worker = workerRules(RULES);
  assert.match(worker, /Wiki-first/);
  assert.match(worker, /Obsidian standard/);
  assert.match(worker, /Filename is identity/);          // sub-bullets survive
  assert.doesNotMatch(worker, /Branch and commit/);
  assert.doesNotMatch(worker, /Findings get dispositions/);
  assert.doesNotMatch(worker, /conductor-only/);          // marker never leaks
});

test('worker rules drop the meta section about editing the rules', () => {
  assert.doesNotMatch(workerRules(RULES), /Append new rules here/);
});

test('worker rules keep the heading and renumber contiguously', () => {
  const worker = workerRules(RULES);
  assert.match(worker, /# Behavioral Rules/);
  // Gaps in numbering read as "rules were withheld from you", which invites a
  // worker to speculate about the missing ones. Contiguous is honest and quiet.
  assert.deepEqual(worker.match(/^\d+\./gm), ['1.', '2.']);
});

test('rules with no markers are returned intact apart from the meta section', () => {
  const plain = '# Behavioral Rules\n\n1. **One.** Body.\n\n2. **Two.** Body.\n';
  const worker = workerRules(plain);
  assert.match(worker, /One/);
  assert.match(worker, /Two/);
});
