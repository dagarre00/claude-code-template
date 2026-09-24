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
import { loadCanonical, parseFrontmatter } from './canonical.mjs';

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

  return `${BANNER}

${canonical.project}

# How this repository works

\`.agents/\` is the single canonical source for the agent workflow, read in
place by every CLI and never copied:

- **Claude Code** loads it as a plugin named \`project\` (skills and commands),
  configured in \`.claude/settings.json\`.
- **Codex** reads \`.agents/skills/\` natively, plus this file.
- **Antigravity** reads no repository files in print mode; its workers get
  everything from the prompt the workflow MCP composes.

Only this file and \`CLAUDE.md\` are generated, because the CLIs hardcode those
names. To change the workflow, edit \`.agents/\` and regenerate (\`sync\`) — never
edit \`AGENTS.md\` or \`CLAUDE.md\` by hand.

Commands have no MCP surface. Claude Code runs them as \`/project:<name>\`; any
other conductor reads \`.agents/commands/<name>.md\` when a human names one.

## Working here

1. The behavioral rules below override default inclinations.
2. Before implementation, read \`docs/wiki/gotchas.md\`, \`docs/wiki/todos.md\`,
   the matching entity Behavior cases, and the relevant requirements and
   architecture. Search \`docs/wiki/\` for related concepts and decisions before
   changing behavior.
3. Load only the skills the task needs. A CLI with no skill loader reads
   \`.agents/skills/<name>/SKILL.md\` directly.

## Delegating work

Workers are dispatched only through the workflow MCP (\`tools/workflow-mcp\`;
procedure: the \`worker-dispatch\` skill). It composes a prompt from \`.agents/\`
and returns a command to run, and every engine is launched with project-file
discovery suppressed, so that prompt is all a worker knows. The conductor owns
branches, commits, pushes and pull requests; workers deliver files.

**Never dispatch a role through a host CLI's own subagent tool** (Task/Agent) —
not even when the role's engine is the conductor's own: Claude Code running
\`developer\` on Sonnet still goes through \`prepare_worktree\`/\`build_worker_prompt\`.
A native subagent inherits the conductor's context and checkout: no worktree,
no owned paths, no suppression. That is also why roles live in \`.agents/roles/\`,
which no plugin loader scans — never recreate \`.agents/agents/\`.

A dispatched worker is a leaf; the conductor may dispatch as many as a cycle needs.

## Commands

The last column is what each dispatched role receives inlined in its prompt, not
what the conductor loads. Two roles of one command never share a skill — if both
need the same procedure, one role would do.

| Command | Purpose | Skills per dispatched role |
| --- | --- | --- |
${commands}

## Roles

| Role | Profile | Access | Purpose |
| --- | --- | --- | --- |
${roles}

## Skills

Each skill is \`.agents/skills/<name>/SKILL.md\`, triggered by its \`description\`
frontmatter. Claude Code (as \`project:<name>\`) and Codex list them natively;
elsewhere, list that directory. Skills marked conductor-only are never sent to a
worker.

## Wiki map

- \`docs/raw/\` — immutable sources; add new ones, never edit old ones.
- \`docs/wiki/requirements.md\` — what the application must do;
  \`architecture.md\` — stack, layout, layers, testing strategy.
- \`docs/wiki/entities/\` — feature specs and their Behavior cases;
  \`concepts/\`, \`decisions/\`, \`summaries/\` — patterns, ADRs, source digests.
- \`docs/wiki/commands.md\` — verified application commands.
- \`docs/wiki/todos.md\`, \`gotchas.md\`, \`log.md\`, \`wiki-todos.md\` — work queue,
  traps, history, deferred wiki maintenance.

${parseFrontmatter(canonical.rules, '.agents/rules.md').body.trim()}
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
