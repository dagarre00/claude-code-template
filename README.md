# Agentic Development Template

A shared development workflow for **Claude Code, Codex, and Antigravity CLI**.
The wiki defines the application; one developer owns the test-first cycle;
skills load as needed; independent agents plan and review complex changes.

## Start a project

Use GitHub's **Use this template** or extract a source archive into a new project.
Open that directory with `claude`, `codex`, or `agy`.

| Claude Code | Codex | Antigravity CLI |
| --- | --- | --- |
| `/project:init` | `$project-init` | `/project-init` |
| `/project:interview the login feature` | `$project-interview the login feature` | `/project-interview the login feature` |
| `/project:work` | `$project-work` | `/project-work` |

Initialization detects the adopting project's stack, asks for missing facts,
fills the blank wiki scaffolds, verifies an application test command, and
personalizes `.harness/project.md`. The template ships no project requirements,
todos, decisions, or operational history.

All nine workflows appear in the generated [command catalog](AGENTS.md#native-command-catalog).
Read [getting started](docs/getting-started.md) for the full workflow or
[HUMAN.md](HUMAN.md) for the day-to-day guide.

## Change the workflow once

The editable source is **`.harness/`**. Native files are generated and committed,
so a new checkout works without generating anything first.

```text
node scripts/sync-harness.mjs
node scripts/sync-harness.mjs --check
node --test tests/harness.test.mjs
```

Node.js 22 or newer is needed for template maintenance, independently of your
application's stack. No npm dependencies or installation are required. CI checks
for drift on Windows and Linux.

| Edit | Purpose |
| --- | --- |
| `.harness/project.md` | Project identity and confirmed context |
| `.harness/instructions.md`, `.harness/rules/` | Shared instructions and constraints |
| `.harness/commands/project/` | Human-invoked workflows |
| `.harness/skills/` | Procedures and supporting files |
| `.harness/agents/` | Portable roles, model profiles, access intent |
| `.harness/adapters.json` | Native model and tool mappings |

Generated outputs include `AGENTS.md`, the importing `CLAUDE.md`, Claude's
commands/skills/agents, shared `.agents/skills`, Antigravity's `.agents/agents`,
and Codex's `.codex/agents`. Do not edit those copies. The generator detects manual
edits, updates registered files, and removes retired outputs while preserving
unrelated settings and files.

[Harness details](docs/harnesses.md) covers native formats, file inclusion, model
selection, compatibility checks, and CLI smoke tests.

## Development principles

- The wiki is the spec; code and wiki changes ship together in adopting projects.
- Behavior cases lead to failing tests, minimal implementation, and refactoring.
- Complex work gets a planner and an adversary in independent contexts.
- Reviewers return findings; the caller records them and the human directs fixes.
- Skills contain project procedures; domain knowledge does not require new agents.
- Maintaining this template preserves blank wiki and raw-source scaffolds.

MIT — see [LICENSE](LICENSE).
