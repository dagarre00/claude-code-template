import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

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
    '.agents/agents/developer.md':
      '---\nname: developer\ndescription: TDD in one agent.\nprofile: balanced\naccess: write\n---\n\nYou run red, green, refactor.\n',
    '.agents/agents/adversary.md':
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

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}
