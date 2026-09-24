import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUN_WORKER = fileURLToPath(new URL('../run-worker.mjs', import.meta.url));

export const readRun = built => JSON.parse(readFileSync(resolve(dirname(built.report_file), 'run.json'), 'utf8'));

// Runs a composed dispatch through the real runner, with a stand-in in place of
// the engine: run.json is the one record of what runs, so pointing it at `sh`
// (or node) exercises everything but the engine itself. `run` overrides any
// other run.json field, such as timeout_seconds.
//
// Stand-ins print plain text, while a real claude worker prints a JSON result the
// runner extracts. Unless a test is about that extraction (`engineOutput`), a
// claude stand-in's stdout is captured as the report directly.
export function runAs(built, executable, args = [], { env = process.env, run = {}, engineOutput = false } = {}) {
  const dir = dirname(built.report_file);
  const current = readRun(built);
  const plain = !engineOutput && current.extract === 'extract-claude-result.mjs'
    ? { stdout: 'report', stderr: 'inherit', extract: null } : {};
  writeFileSync(resolve(dir, 'run.json'), JSON.stringify({ ...current, executable, args, ...plain, ...run }, null, 2) + '\n');
  return spawnSync(process.execPath, [RUN_WORKER, dir], { encoding: 'utf8', env });
}

// A throwaway canonical tree. Tests that care about one field override just that
// field, so a failure names the field under test rather than the fixture.
export function fixture(overrides = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'workflow-mcp-'));
  const files = {
    '.agents/rules.md':
      '# Behavioral Rules\n\n1. **Wiki-first.** Spec before code.\n\n'
      + '2. **Branch and commit.** Push and open a PR. <!-- conductor-only -->\n',
    '.agents/worker-contract.md':
      '# Worker contract\n\nYou never dispatch another worker, and you never change branches.\n',
    '.agents/project.md': '# Project\n\n- Name: `<set during project initialization>`\n',
    '.agents/roles/developer.md':
      '---\nname: developer\ndescription: TDD in one agent.\nprofile: balanced\naccess: write\n---\n\nYou run red, green, refactor.\n',
    '.agents/roles/adversary.md':
      '---\nname: adversary\ndescription: Read-only diff hunter.\nprofile: reasoning\naccess: read-only\n---\n\nYou raise findings only.\n',
    '.agents/commands/work.md':
      '---\nname: work\ndescription: The core TDD loop.\nargument-hint: "[todo]"\nskills: [tdd-loop, wiki-update]\n---\n\n# /project:work\n\nStep 1. Read the spec.\n',
    '.agents/skills/tdd-loop/SKILL.md':
      '---\nname: tdd-loop\ndescription: Red-green-refactor for this project.\n---\n\nWrite the failing test first.\n',
    '.agents/skills/wiki-update/SKILL.md':
      '---\nname: wiki-update\ndescription: How to structure a wiki page.\n---\n\nCheck for an existing page first.\n',
    ...overrides
  };
  for (const [path, body] of Object.entries(files)) {
    if (body === null) continue; // an explicit null removes a default file
    const full = resolve(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

// What prepare_worktree leaves behind, without git: the workspace directory and
// the record a dispatch is checked against. For unit tests of composition that
// never run a worker; anything that inspects a real worktree prepares one.
export function stubWorktree(root, task_id = 'x', workspace = resolve(root, '.worktrees', task_id)) {
  mkdirSync(workspace, { recursive: true });
  const dir = resolve(root, '.worktrees', '.dispatch', task_id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'worktree.json'), JSON.stringify({ task_id, workspace, branch: `worker/${task_id}`,
    base_sha: null, integration_branch: null, created_at: new Date().toISOString() }, null, 2) + '\n');
  return { task_id, workspace };
}

// prepareDispatch for unit tests that compose without git: the worktree record
// for the task is stubbed first, pointing at whatever workspace the test names.
// Tests of the refusal itself call the real prepareDispatch.
export const composeIn = prepare => (root, input = {}) => {
  const task_id = input.task_id ?? 'x';
  if (typeof input.workspace === 'string' && input.workspace.trim()) stubWorktree(root, task_id, input.workspace);
  return prepare(root, { ...input, task_id });
};

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}
