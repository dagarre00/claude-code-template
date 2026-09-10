import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../config.mjs';
import { prepareDispatch, buildRunnableCommand } from '../dispatch.mjs';
import { cleanup, fixture } from './helpers.mjs';

const CONFIG = {
  version: 1, defaultEngine: 'inherit', workerTimeoutSeconds: 1800, workerCommands: ['npm test'],
  roles: { developer: { engine: null, models: {}, effort: {} },
    adversary: { engine: 'codex', models: {}, effort: {} } },
  engines: {
    claude: { executable: 'claude', models: { reasoning: 'opus', balanced: 'sonnet', fast: 'haiku' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    codex: { executable: 'codex', models: { reasoning: null, balanced: null, fast: null },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } },
    antigravity: { executable: 'agy', models: { reasoning: 'pro', balanced: 'inherit', fast: 'flash' },
      effort: { reasoning: 'high', balanced: 'medium', fast: 'low' } }
  }
};

const withRepo = (fn, overrides = {}) => {
  const root = fixture({ '.agents/config.json': JSON.stringify(CONFIG), ...overrides });
  try { return fn(root); } finally { cleanup(root); }
};

const base = { role: 'developer', instructions: 'Implement login.', owned_paths: ['src'] };

test('config validates and reports the engine each role resolves to', () => {
  withRepo(root => {
    const config = loadConfig(root);
    assert.equal(config.roles.adversary.engine, 'codex');
    assert.equal(config.defaultEngine, 'inherit');
  });
});

test('an unknown key in a role config fails loudly instead of being ignored', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /modell|Unknown key/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    roles: { developer: { modell: 'sonnet' } } }) });
});

test('a settings block for an unregistered engine is an error', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /gemini/);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines, gemini: { executable: 'gemini', models: {}, effort: {} } } }) });
});

test('a shell shim is refused as an executable', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /shim|executable/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines,
      claude: { ...CONFIG.engines.claude, executable: 'claude.cmd' } } }) });
});

test('codex context-management overrides accept a positive integer', () => {
  withRepo(root => {
    const config = loadConfig(root);
    assert.equal(config.engines.codex.toolOutputTokenLimit, 2000);
    assert.equal(config.engines.codex.modelAutoCompactTokenLimit, 50000);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines,
      codex: { ...CONFIG.engines.codex, toolOutputTokenLimit: 2000, modelAutoCompactTokenLimit: 50000 } } }) });
});

test('a non-integer context-management override fails loudly instead of reaching argv', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /toolOutputTokenLimit|positive integer/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines,
      codex: { ...CONFIG.engines.codex, toolOutputTokenLimit: '2000' } } }) });
});

// These fields are Codex config.toml keys with no argv slot on the other two
// adapters; setting one elsewhere would be silently inert, which is exactly
// the class of typo this loader exists to catch.
test('a context-management override on a non-codex engine is rejected', () => {
  withRepo(root => {
    assert.throws(() => loadConfig(root), /claude.*toolOutputTokenLimit|Codex-only/i);
  }, { '.agents/config.json': JSON.stringify({ ...CONFIG,
    engines: { ...CONFIG.engines,
      claude: { ...CONFIG.engines.claude, toolOutputTokenLimit: 2000 } } }) });
});

test('writes the prompt and the exact stdin bytes, and returns a runnable command', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, command: 'work', conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'claude');
    assert.equal(result.executable, 'claude');
    // The prompt is on disk for a human to read, and the stdin file is what
    // actually gets piped — same bytes here, different for antigravity.
    assert.match(readFileSync(result.prompt_file, 'utf8'), /Implement login\./);
    assert.equal(readFileSync(result.stdin_file, 'utf8'), readFileSync(result.prompt_file, 'utf8'));
    assert.ok(result.command.includes('<'), 'command must pipe the stdin file');
    assert.ok(Array.isArray(result.args));
  });
});

// Claude Code has no --cd flag: it works in the process's working directory. So
// a command that does not change directory first would run the worker against
// the conductor's own checkout, which is the one thing the worktree exists to
// prevent. The returned command must be runnable exactly as given.
test('the returned command runs in the worktree, not the conductor checkout', () => {
  withRepo(root => {
    const workspace = resolve(root, '.worktrees/x');
    for (const cli_engine of ['claude', 'codex', 'antigravity']) {
      const result = prepareDispatch(root, { ...base, cli_engine, conductorEngine: 'claude', workspace });
      assert.equal(result.cwd, workspace);
      assert.ok(result.command.includes(workspace) || result.command.includes(workspace.replaceAll('\\', '/')),
        `${cli_engine} command does not enter the worktree`);
    }
  });
});

// The conductor decides whether an engine is appropriate for a task, and it can
// only do that if the dispatch states what the engine cannot enforce.
test('dispatch warns when the engine cannot enforce the leaf-worker rule', () => {
  withRepo(root => {
    const workspace = resolve(root, '.worktrees/x');
    const agy = prepareDispatch(root, { ...base, cli_engine: 'antigravity', conductorEngine: 'claude', workspace });
    assert.ok(agy.warnings.some(w => /subagent|leaf/i.test(w)), 'no warning for antigravity');
    for (const cli_engine of ['claude', 'codex']) {
      assert.deepEqual(prepareDispatch(root, { ...base, cli_engine, conductorEngine: 'claude', workspace }).warnings, []);
    }
  });
});

// codex separates its report from its (very large) tool-call transcript via
// -o; claude never needed one (stdout is already just the final message);
// antigravity has neither flag, so dispatch.mjs wraps its command instead —
// all three end up with a usable report_file, none with a transcript warning.
test('report_file is set for codex and antigravity, and null for claude', () => {
  withRepo(root => {
    const workspace = resolve(root, '.worktrees/x');
    const codex = prepareDispatch(root, { ...base, cli_engine: 'codex', conductorEngine: 'claude', workspace });
    assert.equal(typeof codex.report_file, 'string');
    assert.ok(codex.report_file.endsWith('report.txt'));
    assert.ok(codex.args.includes(codex.report_file), 'report_file must be the same path passed to -o');
    assert.doesNotMatch(codex.command, /extract-agy-result/, 'codex needs no extraction step');

    const claude = prepareDispatch(root, { ...base, cli_engine: 'claude', conductorEngine: 'claude', workspace });
    assert.equal(claude.report_file, null);
    assert.ok(!claude.command.startsWith('('), 'claude is never wrapped — its stdout is already the report');
    assert.doesNotMatch(claude.command, /exit \$ec|extract-agy-result/, 'no wrapper leaked into claude\'s command');

    const agy = prepareDispatch(root, { ...base, cli_engine: 'antigravity', conductorEngine: 'claude', workspace });
    assert.equal(typeof agy.report_file, 'string');
    assert.ok(agy.command.includes('extract-agy-result.mjs'), 'antigravity needs the post-processing step');

    for (const result of [codex, agy]) {
      assert.ok(!result.warnings.some(w => /transcript/i.test(w)),
        `${result.engine} solved the transcript problem and should carry no warning about it`);
    }
  });
});

// The wrapper is a real shell pipeline, not just string content. These build
// it with a fake "engine" — no real CLI involved, just `cat`/`sh`, so nothing
// here depends on codex or agy actually being installed — and run it for real.

const wrapperFixture = root => {
  const workspace = resolve(root, '.worktrees/x');
  mkdirSync(workspace, { recursive: true });
  const dir = resolve(root, '.worktrees/.dispatch/wrapper-test');
  mkdirSync(dir, { recursive: true });
  const stdin_file = resolve(dir, 'stdin.txt');
  writeFileSync(stdin_file, '');
  return { workspace, dir, stdin_file,
    report_file: resolve(dir, 'report.txt'), raw_file: resolve(dir, 'raw.txt') };
};
const adapter = { writesReportFile: true, extractReportFrom: 'extract-agy-result.mjs' };

test('the report-file wrapper extracts the report and hides the raw transcript', () => {
  withRepo(root => {
    const { workspace, dir, stdin_file, report_file, raw_file } = wrapperFixture(root);
    // Pre-written, not piped through a shell one-liner: a JSON string can
    // contain characters (quotes, real newlines) no shell-quoting scheme
    // handles safely, which is exactly why extract-agy-result.mjs is a real
    // file instead of an inline script — this fixture gets the same courtesy.
    const transcript = resolve(dir, 'fake-transcript.txt');
    writeFileSync(transcript, JSON.stringify({ event: 'init' }) + '\n'
      + JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'hello from the fake worker' } }) + '\n');
    const command = { executable: 'cat', args: [transcript] };

    const wrapped = buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter });
    const outcome = spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });

    assert.equal(outcome.status, 0);
    assert.match(outcome.stdout, /hello from the fake worker/,
      'the wrapper must print the extracted report, not the raw transcript');
    assert.doesNotMatch(outcome.stdout, /"event":"init"/, 'the raw transcript must not reach stdout');
    assert.match(readFileSync(raw_file, 'utf8'), /"event":"init"/, 'raw_file keeps the full transcript for debugging');
    assert.equal(readFileSync(report_file, 'utf8').trim(),
      JSON.stringify({ status: 'SUCCESS', response: 'hello from the fake worker' }, null, 2).trim());
  });
});

test('the report-file wrapper preserves the wrapped process\'s real exit code', () => {
  withRepo(root => {
    const { workspace, stdin_file, report_file, raw_file } = wrapperFixture(root);
    const command = { executable: 'sh', args: ['-c', 'exit 7'] };
    const wrapped = buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter });
    const outcome = spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });
    assert.equal(outcome.status, 7, 'a trailing `cat` must not overwrite the wrapped process\'s own exit code');
  });
});

// Agy's own exit code is 0 whether or not a tool call was auto-denied — headless
// mode has no approval surface to fail loudly on. extract-agy-result.mjs is the
// only place that can see denied_actions, so it must fail the whole wrapped
// command itself rather than leaving that to whoever reads the report text.
test('a denied action fails the wrapped command even though the underlying process exits 0', () => {
  withRepo(root => {
    const { workspace, dir, stdin_file, report_file, raw_file } = wrapperFixture(root);
    const transcript = resolve(dir, 'denied-transcript.txt');
    writeFileSync(transcript, JSON.stringify({ event: 'init' }) + '\n'
      + JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '',
        denied_actions: [{ action: 'read_file', target: 'vendor/freecad-libs' }] } }) + '\n');
    const command = { executable: 'cat', args: [transcript] };

    const wrapped = buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter });
    const outcome = spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });

    assert.notEqual(outcome.status, 0, 'a denied action must not report success');
    assert.match(outcome.stdout, /denied_actions/, 'the report must still be printed so the denial is visible');
  });
});

test('a missing result event fails the wrapped command, not just an already-nonzero process exit', () => {
  withRepo(root => {
    const { workspace, stdin_file, report_file, raw_file } = wrapperFixture(root);
    const command = { executable: 'true', args: [] }; // exits 0, but produces no transcript at all
    const wrapped = buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter });
    const outcome = spawnSync('sh', ['-c', wrapped], { encoding: 'utf8' });
    assert.notEqual(outcome.status, 0, 'no result event must not report success');
    assert.match(outcome.stdout, /No "result" event found/);
  });
});

test('antigravity gets NDJSON on stdin while the readable prompt stays plain', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, conductorEngine: 'claude', cli_engine: 'antigravity',
      workspace: resolve(root, '.worktrees/x') });
    const prompt = readFileSync(result.prompt_file, 'utf8');
    const stdin = readFileSync(result.stdin_file, 'utf8');
    assert.doesNotMatch(prompt, /^\{"event"/);
    assert.equal(JSON.parse(stdin.trim()).message.content[0].text, prompt);
  });
});

test('"inherit" resolves to the conductor\'s own engine', () => {
  withRepo(root => {
    const asCodex = prepareDispatch(root, { ...base, conductorEngine: 'codex',
      workspace: resolve(root, '.worktrees/x') });
    assert.equal(asCodex.engine, 'codex');
  });
});

test('a per-role engine beats the inherited default', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { role: 'adversary', instructions: 'Review.',
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'codex');
  });
});

test('reports the prompt size so the conductor can see what it is paying for', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, command: 'work', conductorEngine: 'claude',
      workspace: resolve(root, '.worktrees/x') });
    assert.ok(result.prompt_bytes > 100);
    assert.equal(result.prompt_bytes, Buffer.byteLength(readFileSync(result.prompt_file, 'utf8'), 'utf8'));
  });
});

// A JS string's .length counts UTF-16 code units, not bytes — every non-ASCII
// character in a worker's instructions (accented names, curly quotes pasted
// from a doc, an emoji in a commit message) makes that number quietly wrong.
// Real-session evidence: a resumed dispatch reported prompt_bytes equal to
// prompt_file's .length, which is exactly this bug (workflow-resume-report,
// 2026-09-10, "Tighten metrics and permission descriptions").
test('prompt_bytes counts real UTF-8 bytes, not UTF-16 code units', () => {
  withRepo(root => {
    const result = prepareDispatch(root, { ...base, instructions: 'Implement login for the café 🚀 flow.',
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    const prompt = readFileSync(result.prompt_file, 'utf8');
    assert.notEqual(result.prompt_bytes, prompt.length, 'this prompt has multi-byte characters, so bytes must exceed code units');
    assert.equal(result.prompt_bytes, Buffer.byteLength(prompt, 'utf8'));
  });
});

test('a role with no config entry still dispatches on the inherited engine', () => {
  withRepo(root => {
    writeFileSync(resolve(root, '.agents/roles/scout.md'),
      '---\nname: scout\ndescription: d\nprofile: fast\naccess: read-only\n---\n\nBody.\n');
    const result = prepareDispatch(root, { role: 'scout', instructions: 'Look around.',
      conductorEngine: 'claude', workspace: resolve(root, '.worktrees/x') });
    assert.equal(result.engine, 'claude');
    assert.equal(result.model, 'haiku');
  });
});
