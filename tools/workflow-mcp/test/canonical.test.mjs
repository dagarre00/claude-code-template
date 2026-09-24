import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCanonical, workerRules } from '../canonical.mjs';
import { composePrompt } from '../compose.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
    '.agents/roles/developer.md':
      '---\nname: developer\ndescription: d\nprofile: turbo\naccess: write\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer\.md/);
  });
});

test('an unknown access level is an error', () => {
  withFixture({
    '.agents/roles/developer.md':
      '---\nname: developer\ndescription: d\nprofile: balanced\naccess: sudo\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer\.md/);
  });
});

test('a role whose frontmatter name disagrees with its filename is an error', () => {
  withFixture({
    '.agents/roles/developer.md':
      '---\nname: coder\ndescription: d\nprofile: balanced\naccess: write\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /developer/);
  });
});

// A role file that carries `model: opus` reads as though it controls the model,
// and it does not — model selection lives in .agents/config.json. Silently
// ignoring the key is how a person spends an afternoon tuning a value that was
// never consulted, so it is rejected and the error says where to go instead.
test('a role declaring an engine-specific model is rejected, pointing at config.json', () => {
  withFixture({
    '.agents/roles/developer.md':
      '---\nname: developer\ndescription: d\nprofile: balanced\naccess: write\nmodel: opus\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), err =>
      /model/.test(err.message) && /config\.json/.test(err.message));
  });
});

test('any unknown key in a role is rejected rather than ignored', () => {
  for (const key of ['color', 'tools', 'disallowedTools', 'moddel']) {
    withFixture({
      '.agents/roles/developer.md':
        `---\nname: developer\ndescription: d\nprofile: balanced\naccess: write\n${key}: x\n---\n\nBody.\n`
    }, root => {
      assert.throws(() => loadCanonical(root), new RegExp(key),
        `${key} was accepted`);
    });
  }
});

test('an unknown key in a command is rejected too', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills: [tdd-loop]\nmoddel: x\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /moddel/);
  });
});

test('the keys a role legitimately uses are all accepted', () => {
  withFixture({
    '.agents/roles/developer.md':
      '---\nname: developer\ndescription: d\ntype: agent\nprofile: balanced\naccess: write\n---\n\nBody.\n'
  }, root => {
    assert.equal(loadCanonical(root).roles.find(r => r.name === 'developer').profile, 'balanced');
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

// The preamble of the real rules file is written for whoever edits it: it says
// rules are withheld from workers, which is the one thing the contiguous
// renumbering exists to keep a worker from dwelling on. Frontmatter ("Loaded at
// session start") is equally not the worker's.
test('worker rules carry no frontmatter and no preamble paragraph marked conductor-only', () => {
  const rules = '---\nname: behavioral-rules\ndescription: Loaded at session start.\n---\n\n# Behavioral Rules\n\n'
    + 'Hard constraints.\n\n**Numbering is positional.** Some rules are stripped. <!-- conductor-only -->\n\n'
    + '1. **One.** Body.\n';
  const worker = workerRules(rules);
  assert.match(worker, /^# Behavioral Rules/);
  assert.match(worker, /Hard constraints/);
  assert.doesNotMatch(worker, /Loaded at session start|behavioral-rules/);
  assert.doesNotMatch(worker, /stripped|positional/);
});

test('rules with no markers are returned intact apart from the meta section', () => {
  const plain = '# Behavioral Rules\n\n1. **One.** Body.\n\n2. **Two.** Body.\n';
  const worker = workerRules(plain);
  assert.match(worker, /One/);
  assert.match(worker, /Two/);
});

// A command that dispatches several roles must say which skills go to WHICH
// role. Declaring one flat list for the whole command sent every worker the
// same nine skills — 93% identical prompts across planner, developer and
// adversary — which both wastes tokens and, worse, hands the adversary the
// developer's procedures when its entire value is reading without them.
test('skills can be declared per role', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills:\n  developer: [tdd-loop]\n  adversary: [wiki-update]\n---\n\nBody.\n'
  }, root => {
    const work = loadCanonical(root).commands.find(c => c.name === 'work');
    assert.deepEqual(work.skillsFor('developer'), ['tdd-loop']);
    assert.deepEqual(work.skillsFor('adversary'), ['wiki-update']);
    assert.deepEqual(work.skillsFor('planner'), []);
  });
});

test('a flat list still works and applies to every role', () => {
  withFixture({}, root => {
    const work = loadCanonical(root).commands.find(c => c.name === 'work');
    assert.deepEqual(work.skillsFor('developer'), ['tdd-loop', 'wiki-update']);
    assert.deepEqual(work.skillsFor('adversary'), ['tdd-loop', 'wiki-update']);
  });
});

test('two roles of one command may not share a skill', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills:\n  developer: [tdd-loop, wiki-update]\n  adversary: [wiki-update]\n---\n\nBody.\n'
  }, root => {
    // If two roles need the same procedure, one agent would have done better —
    // that is the signal, so it fails loudly naming the skill and both roles.
    assert.throws(() => loadCanonical(root), err =>
      /wiki-update/.test(err.message) && /developer/.test(err.message) && /adversary/.test(err.message));
  });
});

test('skills declared for a role that does not exist is an error', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills:\n  ghost: [tdd-loop]\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /ghost/);
  });
});

test('an unknown skill under a role is still caught by name', () => {
  withFixture({
    '.agents/commands/work.md':
      '---\nname: work\ndescription: d\nskills:\n  developer: [ghost-skill]\n---\n\nBody.\n'
  }, root => {
    assert.throws(() => loadCanonical(root), /ghost-skill/);
  });
});

// Fixtures prove the rules work; this proves THIS repository obeys them. It is
// the check that actually protects the project, because loadCanonical throws on
// every violation — an unknown key, a skill given to two roles of one command,
// a command declaring a skill for a role that does not exist.
test('the real .agents/ source loads and satisfies every rule', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const canonical = loadCanonical(root);
  assert.ok(canonical.roles.length >= 1);
  assert.ok(canonical.commands.length >= 1);

  for (const command of canonical.commands) {
    if (!command.skillsByRole) continue;
    const seen = new Map();
    for (const [role, list] of Object.entries(command.skillsByRole)) {
      assert.ok(canonical.roles.some(r => r.name === role),
        `/project:${command.name} declares skills for unknown role ${role}`);
      for (const skill of list) {
        assert.ok(!seen.has(skill),
          `/project:${command.name} gives "${skill}" to both ${seen.get(skill)} and ${role}`);
        seen.set(skill, role);
      }
    }
  }
});

// Roles live in .agents/roles/, NOT .agents/agents/, and the directory name is
// load-bearing. Claude Code's plugin loader scans `agents/`, so a role file
// there is published as a native subagent type (project:developer). A conductor
// that dispatched one would bypass the entire architecture at once: no worktree,
// no owned_paths, no context suppression, and the conductor's own context
// inherited wholesale — the opposite of every guarantee a composed prompt makes.
// Verified: after the rename, a session reports NONE for project:* agent types
// while /project:work and project:tdd-loop stay available.
test('roles are not published as native subagent types', () => {
  const root = resolve(import.meta.dirname, '../../..');
  assert.ok(existsSync(resolve(root, '.agents/roles')), 'roles must live in .agents/roles/');
  assert.ok(!existsSync(resolve(root, '.agents/agents')),
    '.agents/agents/ is scanned by the Claude Code plugin loader and would republish '
    + 'every role as a dispatchable subagent, bypassing the MCP. Keep roles in .agents/roles/.');
});

// Workers receive the rules renumbered around the conductor-only ones, so a role
// or skill that says "behavioral rule 12" sends a worker to a different rule —
// measured: asked to quote rule 12, agy workers quoted "One agent owns the TDD
// loop" (canonical rule 15). .agents/rules.md says to cite rules by name in any
// text a worker can receive; this holds the real .agents/ to it.
test('text a worker can receive never cites a behavioral rule by bare number', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const canonical = loadCanonical(root);
  const workerSkills = new Set(canonical.commands.flatMap(command =>
    canonical.roles.flatMap(role => command.skillsFor(role.name))));
  const sources = [
    ['.agents/worker-contract.md', canonical.contract],
    ...canonical.roles.map(role => [`role ${role.name}`, role.body]),
    ...canonical.skills.filter(skill => workerSkills.has(skill.name)).map(skill => [`skill ${skill.name}`, skill.body])
  ];
  const offenders = sources.flatMap(([where, body]) =>
    [...body.matchAll(/(?:behavioral[ \t]+)?rules?[ \t]+#?\d+|rules\.md`?[ \t]+#\d+/gi)].map(match => `${where}: "${match[0]}"`));
  assert.deepEqual(offenders, []);
});

// Every worker prompt this repository can actually compose — each role with the
// skills its command declares for it, and each undeclared role with none — must
// be something a worker can obey. Measured contradictions this holds shut: a
// developer told to `git tag` a checkpoint (not allowlisted, and on agy one
// denied command discards the whole report), sent to skills it never received,
// and told to delete `.handoff/` scratch that sits outside its worktree.
test('every composable worker prompt is one a worker can obey', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const canonical = loadCanonical(root);
  const shapes = [];
  const declared = new Set();
  for (const command of canonical.commands) {
    for (const [role, skills] of Object.entries(command.skillsByRole ?? {})) {
      shapes.push({ where: `/project:${command.name} → ${role}`, role, skills });
      declared.add(role);
    }
  }
  for (const role of canonical.roles) {
    if (!declared.has(role.name)) shapes.push({ where: `${role.name} (no command skills)`, role: role.name, skills: [] });
  }
  const offenders = [];
  for (const { where, role, skills } of shapes) {
    const input = { role, skills, instructions: 'x', task_id: 't', workspace: '/w' };
    if (canonical.roles.find(r => r.name === role).access === 'write') input.owned_paths = ['src'];
    const { prompt } = composePrompt(canonical, input);
    for (const skill of canonical.skills) {
      if (!skills.includes(skill.name) && prompt.includes(`\`${skill.name}\``)) {
        offenders.push(`${where}: names skill \`${skill.name}\`, which it is not sent`);
      }
    }
    for (const match of prompt.matchAll(/\bgit (?:add|commit|tag|reset|rm|stash|checkout|switch|merge|rebase|push|worktree|restore|clean|cherry-pick|branch -[dDmM])\b/g)) {
      offenders.push(`${where}: tells a worker to run \`${match[0]}\``);
    }
    if (prompt.includes('.handoff')) offenders.push(`${where}: mentions .handoff/, which is outside every worktree`);
  }
  assert.deepEqual([...new Set(offenders)], []);
});

// A role that cannot do its job without the web says so, so the MCP can refuse
// to pretend an engine without web tools will run it (measured: the researcher on
// agy could neither search nor fetch).
test('a role may declare capabilities from a closed vocabulary', () => {
  const role = caps => `---\nname: researcher\ndescription: Web research.\nprofile: fast\naccess: write\n${caps}---\n\nResearch.\n`;
  withFixture({ '.agents/roles/researcher.md': role('capabilities: [web]\n') }, root => {
    assert.deepEqual(loadCanonical(root).roles.find(r => r.name === 'researcher').capabilities, ['web']);
    assert.deepEqual(loadCanonical(root).roles.find(r => r.name === 'developer').capabilities, []);
  });
  withFixture({ '.agents/roles/researcher.md': role('capabilities: [telepathy]\n') }, root => {
    assert.throws(() => loadCanonical(root), /telepathy/);
  });
});
