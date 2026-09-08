// The generator, and it is deliberately tiny.
//
// Exactly two files are produced, because exactly two filenames are hardcoded by
// the CLIs we support: Codex reads AGENTS.md, Claude Code reads CLAUDE.md.
// Everything else — skills, commands, agent definitions — is read in place from
// `.agents/`, so there is nothing to copy and nothing to keep in sync. An
// earlier design generated three copies of every skill plus a SHA manifest to
// police them; measuring what the CLIs actually discover made all of that
// unnecessary.
//
// CLAUDE.md is a two-line import rather than a rendering of the same content:
// two files carrying the same rules is two sources of truth, and one of them
// will eventually be edited alone.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCanonical } from './canonical.mjs';

export const GENERATED = Object.freeze(['AGENTS.md', 'CLAUDE.md']);

const BANNER = '<!-- Generated from .agents/ by tools/workflow-mcp. DO NOT EDIT.\n'
  + '     Edit the canonical source in .agents/ and regenerate. -->';

function renderAgents(canonical) {
  const commands = canonical.commands.map(command => {
    const byRole = command.skillsByRole;
    const dispatches = byRole
      ? Object.entries(byRole).map(([role, list]) =>
          `**${role}**: ${list.map(s => `\`${s}\``).join(', ')}`).join('<br>')
      : 'conductor only';
    return `| \`/project:${command.name}\` | ${command.description.replace(/\|/g, '\\|')} | ${dispatches} |`;
  }).join('\n');

  const roles = canonical.roles.map(role =>
    `| \`${role.name}\` | ${role.profile} | ${role.access} | ${role.description.replace(/\|/g, '\\|')} |`).join('\n');

  const skills = canonical.skills.map(skill => `- \`${skill.name}\` — ${skill.description}`).join('\n');

  return `${BANNER}

${canonical.project}

# How this repository works

\`.agents/\` is the single canonical source for the agent workflow. Every CLI
reads it directly:

- **Claude Code** loads \`.agents/\` as a plugin named \`project\` — skills,
  commands and agent definitions — configured in \`.claude/settings.json\`.
- **Codex** reads \`.agents/skills/\` natively, plus this file.
- **Antigravity** reads no repository files in print mode; its workers receive
  everything in the prompt composed by the workflow MCP.

Nothing under \`.agents/\` is ever copied. Only this file and \`CLAUDE.md\` are
generated, because those two filenames are hardcoded by the CLIs that read them.

Top-level commands have no MCP surface — they are a conductor concern, and a
conductor that can read \`.agents/commands/\` never needs a tool call to reach
one. Claude Code is the only conductor with a native command surface today
(the plugin above); when another CLI conducts, point it at
\`.agents/commands/<name>.md\` directly and it reads that like any other
project file.

## Working here

1. Read the behavioral rules below — they override default inclinations.
2. Before implementation, read \`docs/wiki/gotchas.md\`, \`docs/wiki/todos.md\`,
   the matching entity Behavior cases, and the relevant requirements and
   architecture.
3. Search \`docs/wiki/\` for related concepts and decisions before changing
   behavior.
4. Load only the skills the task needs. If a CLI exposes no skill loader, read
   \`.agents/skills/<name>/SKILL.md\` directly.

To change the workflow itself, edit \`.agents/\` and regenerate — never edit
\`AGENTS.md\` or \`CLAUDE.md\` by hand.

## Delegating work

Workers are dispatched through the workflow MCP server
(\`tools/workflow-mcp\`), which composes a prompt from \`.agents/\` and hands
back a command to run. A worker receives that prompt and nothing else: every
engine is launched with its project-file discovery suppressed, so the prompt is
the complete statement of how it must work. The conductor owns branches,
commits, pushes and pull requests; workers deliver files.

**MCP is the only dispatch path.** Never delegate a role to a host CLI's own
subagent mechanism, and never recreate \`.agents/agents/\` — roles deliberately
live in \`.agents/roles/\`, which no plugin loader scans, so they cannot be
published as native subagent types. A natively dispatched role would inherit the
conductor's whole context and run in the conductor's checkout with no worktree,
no owned paths and no suppression: every guarantee above, lost silently. This
holds even when a role's configured engine is identical to the conductor's own
— Claude Code conducting and also running \`developer\` on Sonnet still
dispatches through \`prepare_worktree\`/\`build_worker_prompt\`, never through
its own native Task/Agent tool. Same engine is not the same process.

Only a dispatched worker is a leaf. The conductor may dispatch as many workers
as a cycle needs — \`/project:work\` runs a planner, a developer and an
adversary — and it is not itself a worker.

## Commands

Reachable today as native Claude Code slash commands (\`/project:<name>\`);
another CLI's conductor reads the file in \`.agents/commands/\` directly when a
human names one. \`skills\` names what each **dispatched role** receives
inlined in its composed prompt — not what the conductor uses, which it loads
itself from \`.agents/skills/\`. Two roles dispatched by one command may never
share a skill: if both need the same procedure, one role would have done the
work of both.

| Command | Purpose | Skills per dispatched role |
| --- | --- | --- |
${commands}

## Roles

| Role | Profile | Access | Purpose |
| --- | --- | --- | --- |
${roles}

## Skills

${skills}

## Wiki map

- \`docs/raw/\`: immutable input; append new sources, never edit old ones.
- \`docs/wiki/requirements.md\`: what the application must do.
- \`docs/wiki/architecture.md\`: stack, layout, patterns, testing strategy.
- \`docs/wiki/entities/\`: feature/module specs and Behavior cases.
- \`docs/wiki/concepts/\`, \`decisions/\`, \`summaries/\`: patterns, ADRs, sources.
- \`docs/wiki/commands.md\`: verified application commands.
- \`docs/wiki/todos.md\`, \`gotchas.md\`, \`log.md\`, \`wiki-todos.md\`: work,
  traps, history, deferred wiki maintenance.

${canonical.rules}
`;
}

function renderClaude() {
  return `${BANNER}

@AGENTS.md

Claude Code reads this file; everything else lives in \`AGENTS.md\`, which is
imported above, and in \`.agents/\`, which is loaded as the \`project\` plugin.
Keeping the content in one place is the point — do not restate it here.
`;
}

function render(root) {
  const canonical = loadCanonical(root);
  return [
    { path: 'AGENTS.md', content: renderAgents(canonical) },
    { path: 'CLAUDE.md', content: renderClaude(canonical) }
  ];
}

export function generate(root) {
  const files = render(root);
  for (const file of files) writeFileSync(resolve(root, file.path), file.content);
  return files;
}

export function checkGenerated(root) {
  const drifted = render(root).filter(file => {
    const path = resolve(root, file.path);
    // Compare ignoring line endings: Git may check these out as CRLF on Windows,
    // and failing a drift check over that would be noise, not signal.
    const normalize = text => text.replace(/\r\n/g, '\n');
    return !existsSync(path) || normalize(readFileSync(path, 'utf8')) !== normalize(file.content);
  }).map(file => file.path);
  return { ok: drifted.length === 0, drifted };
}
