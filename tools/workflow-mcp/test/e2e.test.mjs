// The e2e run spends real model calls, so `npm test` only proves the parts that
// do not: the fixture is a green project, every dispatch composes for every
// engine, and a dry run cleans up after itself. A broken harness should fail here,
// not an hour into a paid run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { buildFixture, findPosixShell, runE2E } from '../e2e/run.mjs';

test('the e2e fixture is a committed, green project with an unimplemented stub', () => {
  const base = mkdtempSync(resolve(tmpdir(), 'wmcp-fixture-test-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  try {
    const root = buildFixture(resolve(base, 'fx'));
    assert.equal(spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '');
    assert.equal(spawnSync('npm test', { cwd: root, shell: true }).status, 0);
    assert.match(readFileSync(resolve(root, 'src/slugify.mjs'), 'utf8'), /return text;/);
    assert.ok(existsSync(resolve(root, '.agents/roles/developer.md')), 'the fixture runs on this template\'s own .agents/');
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
});

test('a POSIX shell is found that is not WSL', () => {
  const shell = findPosixShell();
  assert.ok(shell === '/bin/sh' || existsSync(shell), shell);
  assert.doesNotMatch(shell.toLowerCase(), /system32/, 'System32\\bash.exe is WSL, which cannot see C:\\ paths');
});

// Adversary round on the e2e run: a failed check could still be recorded as an
// accepted decision (F1, and the same bug on the probe), a probe that wrote a
// file aborted the whole run before its result or cleanup (F2), and an engine with
// no transcript audit scored "no subagent was called" as a pass (F3). Stand-ins run
// through the real wrapper and the real checks, without an engine.
test('failed checks reject their dispatch, a writing probe does not abort the run, and unobservable checks are not passes', async () => {
  const base = mkdtempSync(resolve(tmpdir(), 'wmcp-standin-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  try {
    const write = (ws, path, text) => { mkdirSync(dirname(resolve(ws, path)), { recursive: true }); writeFileSync(resolve(ws, path), text); };
    const result = await runE2E({ engine: 'claude', log: () => {}, standIns: {
      probe: { script: 'echo "(a) created it"', effect: ws => write(ws, 'PROBE_WRITE.txt', 'probe\n') },
      'dev-b1': { script: 'echo "B1: Red was AssertionError, now green"', effect: ws => {
        write(ws, 'test/slugify.test.mjs', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n"
          + "import { slugify } from '../src/slugify.mjs';\n\ntest('B1: lowercases and hyphen-joins', () => {\n"
          + "  assert.equal(slugify('Hello World'), 'hello-world');\n});\n");
        write(ws, 'src/slugify.mjs', "export function slugify(text) {\n  return text.toLowerCase().split(' ').join('-');\n}\n");
        const entity = resolve(ws, 'docs/wiki/entities/slugify.md');
        writeFileSync(entity, readFileSync(entity, 'utf8').replace('- [ ] **B1**', '- [x] **B1**'));
      } },
      adversary: { script: 'echo "Looks fine to me."' }
    } });
    const check = id => result.checks.find(entry => entry.id === id);
    assert.ok(existsSync(result.result_file), 'the result is written even though a probe wrote a file');
    assert.equal(check('probe.no_write').pass, false);
    assert.equal(check('probe.no_subagent').status, 'unobserved');
    assert.equal(check('dev.integrated').pass, true, JSON.stringify(result.checks.filter(c => c.status === 'fail')));
    assert.equal(check('adversary.format').pass, false);
    assert.equal(check('cleanup.worktrees').pass, true);
    assert.equal(check('cleanup.trust').pass, true);
    const decisions = Object.fromEntries(result.dispatches.map(d => [d.task_id, d.decision]));
    assert.deepEqual(decisions, { probe: 'rejected', 'dev-b1': 'accepted', adversary: 'rejected' });
    assert.ok(result.unobserved >= 1);
    assert.equal(result.passed + result.failed + result.unobserved, result.checks.length);
    rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
});

// Measured on a live agy run: the adversary ended SUCCESS with nothing right
// after agy rejected its own malformed tool call. A conductor retries that once,
// unchanged; so does the e2e, and the retry shows up in the numbers.
test('a transient engine fault is retried once, and the retry is counted', async () => {
  const base = mkdtempSync(resolve(tmpdir(), 'wmcp-retry-'));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  const event = (i, tool, output) => JSON.stringify({ event: 'step_update', step_update: { step_index: i, state: 'DONE',
    step_type: 'tool', tool_name: tool, tool_info: { name: tool, parameters: {}, output } } });
  const done = response => JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response, usage: { total_tokens: 10 } } });
  const transcript = (ws, task, lines) => writeFileSync(resolve(ws, '..', `${task}.transcript`), lines.join('\n') + '\n');
  try {
    const result = await runE2E({ engine: 'antigravity', log: () => {}, standIns: {
      probe: [
        { script: 'cat ../probe.transcript', effect: ws => transcript(ws, 'probe',
          [event(2, 'find_by_name', "invalid arguments:\n- missing property 'Pattern'"), done('')]) },
        { script: 'cat ../probe.transcript', effect: ws => transcript(ws, 'probe',
          [event(2, 'view_file', '3 lines'), done('(a) NO SUCH TOOL (b) NO SUCH TOOL')]) }
      ],
      'dev-b1': { script: 'cat ../dev-b1.transcript', effect: ws => transcript(ws, 'dev-b1', [done('Blocked: nothing done.')]) }
    } });
    const check = id => result.checks.find(entry => entry.id === id);
    assert.equal(check('probe.verdict').pass, true, JSON.stringify(result.checks.filter(c => c.status === 'fail')));
    assert.equal(check('probe.no_subagent').status, 'pass', 'agy exposes an audit, so this is observed');
    const probe = result.dispatches.find(d => d.task_id === 'probe');
    assert.equal(probe.attempt, 2);
    assert.equal(probe.decision, 'accepted');
    const row = result.stats.find(r => r.role === 'planner');
    assert.equal(row.retries, 1);
    assert.equal(row.rejected, 1);
    assert.equal(check('stats.recorded').pass, true);
    rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
});

const withGlobalGit = async (prefix, fn) => {
  const base = mkdtempSync(resolve(tmpdir(), prefix));
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
  try { return await fn(base); } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(base, { recursive: true, force: true });
  }
};

// The lazy-skills experiment needs a developer that SHOULD record a gotcha, or
// "the lazy arm recorded none" measures nothing. The trap is a classic one: the
// module the wiki names is generated from another file on every `npm test`, and
// the wiki does not say so. An edit to the named file is silently undone.
test('the trap fixture is green and clean, and npm test overwrites the file the wiki names', async () => {
  await withGlobalGit('wmcp-trap-', async base => {
    const root = buildFixture(resolve(base, 'fx'), { trap: true });
    assert.equal(spawnSync('npm test', { cwd: root, shell: true }).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '',
      'a green run must not dirty the tree, or prepare_worktree refuses it');
    writeFileSync(resolve(root, 'src/slugify.mjs'), 'export function slugify(text) {\n  return text.toLowerCase();\n}\n');
    spawnSync('npm test', { cwd: root, shell: true });
    assert.match(readFileSync(resolve(root, 'src/slugify.mjs'), 'utf8'), /return text;/, 'the edit is undone');
    assert.doesNotMatch(readFileSync(resolve(root, 'docs/wiki/architecture.md'), 'utf8'), /slugify\.src|pretest|generated/i,
      'the wiki must not already document the trap');
  });
});

test('a dry run of the lazy arm defers the rarely used skills and costs fewer bytes than the inline arm', async () => {
  await withGlobalGit('wmcp-arms-', async () => {
    const arm = async skills => {
      const result = await runE2E({ engine: 'antigravity', dryRun: true, skills, log: () => {} });
      const prompt = readFileSync(resolve(result.result_file, '..', 'dispatch', 'dev-b1', 'prompt.txt'), 'utf8');
      rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
      assert.deepEqual(result.checks.filter(check => !check.pass), []);
      return { result, prompt };
    };
    const inline = await arm('inline');
    const lazy = await arm('lazy');
    assert.equal(inline.result.experiment.skills_mode, 'inline');
    assert.deepEqual(inline.result.experiment.lazy_skills, []);
    assert.deepEqual(lazy.result.experiment.lazy_skills, ['gotcha-recording', 'decision-recording']);
    assert.deepEqual(lazy.result.experiment.skills, inline.result.experiment.skills, 'both arms send the same skills');
    assert.match(inline.prompt, /## Skill: gotcha-recording/);
    assert.doesNotMatch(lazy.prompt, /## Skill: gotcha-recording/);
    assert.match(lazy.prompt, /\.agents\/skills\/gotcha-recording\/SKILL\.md/);
    assert.ok(lazy.result.experiment.prompt_bytes < inline.result.experiment.prompt_bytes,
      `${lazy.result.experiment.prompt_bytes} < ${inline.result.experiment.prompt_bytes}`);
  });
});

test('an experiment run scores the gotcha and the deferred reads without gating integration on them', async () => {
  await withGlobalGit('wmcp-lazy-', async () => {
    const write = (ws, path, text) => { mkdirSync(dirname(resolve(ws, path)), { recursive: true }); writeFileSync(resolve(ws, path), text); };
    const view = (i, path) => JSON.stringify({ event: 'step_update', step_update: { step_index: i, state: 'DONE',
      step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: path } } } });
    const done = response => JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response, usage: { total_tokens: 42 } } });
    const transcript = (ws, task, lines) => writeFileSync(resolve(ws, '..', `${task}.transcript`), lines.join('\n') + '\n');
    const result = await runE2E({ engine: 'antigravity', skills: 'lazy', log: () => {}, standIns: {
      probe: { script: 'cat ../probe.transcript', effect: ws => transcript(ws, 'probe', [done('(a) NO SUCH TOOL (b) NO SUCH TOOL')]) },
      'dev-b1': { script: 'cat ../dev-b1.transcript', effect: ws => {
        write(ws, 'test/slugify.test.mjs', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n"
          + "import { slugify } from '../src/slugify.mjs';\n\ntest('B1: lowercases and hyphen-joins', () => {\n"
          + "  assert.equal(slugify('Hello World'), 'hello-world');\n});\n");
        const impl = "export function slugify(text) {\n  return text.toLowerCase().split(' ').join('-');\n}\n";
        write(ws, 'src/slugify.src.mjs', impl);
        write(ws, 'src/slugify.mjs', impl);
        const entity = resolve(ws, 'docs/wiki/entities/slugify.md');
        writeFileSync(entity, readFileSync(entity, 'utf8').replace('- [ ] **B1**', '- [x] **B1**'));
        write(ws, 'docs/wiki/gotchas.md', readFileSync(resolve(ws, 'docs/wiki/gotchas.md'), 'utf8').replace('*(None yet.)*',
          '### src/slugify.mjs is generated\n\n**When:** editing src/slugify.mjs\n**Symptom:** the edit vanishes on npm test\n'
          + '**Cause:** the pretest script copies src/slugify.src.mjs over it\n**Fix:** edit src/slugify.src.mjs\n'
          + '**Related:** [[entities/slugify]]'));
        transcript(ws, 'dev-b1', [view(1, `${ws}/.agents/skills/gotcha-recording/SKILL.md`), done('B1: Red was AssertionError, now green')]);
      } },
      adversary: { script: 'cat ../adversary.transcript', effect: ws => transcript(ws, 'adversary',
        [done('Nothing above nit. Checked: correctness, tests.')]) }
    } });
    const check = id => result.checks.find(entry => entry.id === id);
    assert.equal(check('dev.red_real').pass, true, 'Red is proven against the generated file\'s real source');
    assert.equal(check('dev.integrated').pass, true, JSON.stringify(result.checks.filter(c => c.status === 'fail')));
    const { experiment } = result;
    assert.deepEqual(experiment.gotcha, { recorded: true, well_formed: true, on_topic: true });
    assert.deepEqual(experiment.lazy_skills_read, ['gotcha-recording']);
    assert.equal(experiment.usage.total_tokens, 42);
    assert.ok(experiment.prompt_bytes > 0);
    assert.ok(!result.checks.some(entry => /gotcha/.test(entry.id)), 'the measured outcome is not a pass/fail check');
    rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
  });
});

for (const engine of ['antigravity', 'codex', 'claude']) {
  test(`a dry run on ${engine} composes every dispatch and leaves nothing behind`, async () => {
    const base = mkdtempSync(resolve(tmpdir(), 'wmcp-dry-'));
    const previous = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = resolve(base, 'gitconfig');
    try {
      const result = await runE2E({ engine, dryRun: true, log: () => {} });
      const failed = result.checks.filter(check => !check.pass);
      assert.deepEqual(failed, [], JSON.stringify(failed));
      assert.ok(result.checks.some(check => check.id === 'dev-b1.compose'));
      assert.ok(result.checks.some(check => check.id === 'adversary.compose'));
      assert.ok(existsSync(result.result_file));
      assert.equal(result.fixture, null);
      assert.ok(existsSync(resolve(result.result_file, '..', 'dispatch', 'dev-b1', 'prompt.txt')),
        'the dispatch records outlive the fixture, so a failed check can be diagnosed');
      rmSync(resolve(result.result_file, '..'), { recursive: true, force: true });
    } finally {
      if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
      rmSync(base, { recursive: true, force: true });
    }
  });
}
