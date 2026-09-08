#!/usr/bin/env node
// MCP server: a prompt factory and a generator, and nothing else.
//
// It composes worker prompts from `.agents/`, prepares isolated worktrees, and
// regenerates the two root files the CLIs hardcode. It deliberately does not
// spawn processes, commit, merge, or push — the conductor has a shell and owns
// all of that. Keeping the control plane this small is what makes it auditable.
//
// Top-level commands (`work`, `review`, …) have no surface here on purpose: a
// conductor that can read `.agents/commands/` — Claude Code natively via its
// plugin, any other CLI when a human points it there — never needs an MCP
// round-trip to reach one. MCP is worker-dispatch plumbing, nothing else.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { engineNames } from './engines/index.mjs';
import { makeTools } from './tools.mjs';

export function createServer(root, conductorEngine) {
  if (!engineNames.includes(conductorEngine)) {
    throw new Error(`Unknown conductor engine "${conductorEngine}"; expected one of ${engineNames.join(', ')}`);
  }
  const api = makeTools(root, conductorEngine);
  const server = new McpServer({ name: 'workflow', version: '1.0.0' });

  const respond = value => ({
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  });
  const register = (name, description, inputSchema, fn, readOnly = true) =>
    server.registerTool(name, { description, inputSchema,
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly } },
    async input => {
      // A thrown error must come back as tool output, not as a transport fault:
      // the conductor needs to read the message and correct the call.
      try { return respond(await fn(input ?? {})); }
      catch (error) { return { ...respond(error.message), isError: true }; }
    });

  register('list_roles',
    'List worker roles from .agents/roles/, with the profile, access level, and the CLI engine each resolves to. Call before build_worker_prompt to discover valid role names.',
    {}, () => api.list_roles());

  register('build_worker_prompt',
    'Compose the complete prompt for one worker from .agents/ and return the exact command to run it. '
    + 'Writes prompt.txt (readable) and stdin.txt (the bytes to pipe). The worker receives this prompt and '
    + 'nothing else — every engine is launched with project-file discovery suppressed. Run the returned '
    + 'command yourself; this server never spawns anything.',
    {
      role: z.string().describe('Role name from list_roles.'),
      instructions: z.string().min(1).max(100000).describe('What this worker must do.'),
      command: z.string().optional().describe('Workflow command whose declared skills to inline.'),
      skills: z.array(z.string()).optional().describe('Narrows the command\'s declared skills. Cannot add skills the command did not declare — pass fewer to cut prompt size.'),
      context: z.string().max(100000).optional().describe('Verbatim user free text, carried as data.'),
      owned_paths: z.array(z.string()).optional().describe('Repository-relative paths this worker may write. Required for write roles.'),
      commit_message: z.string().max(200).optional().describe('Subject the conductor will use when committing this worker\'s output. Rejected for read-only roles.'),
      workspace: z.string().optional().describe('Worktree path from prepare_worktree.'),
      task_id: z.string().optional(),
      cli_engine: z.enum([...engineNames]).optional(),
      model_override: z.string().optional(),
      thinking_budget: z.string().optional()
    },
    input => api.build_worker_prompt(input));

  register('prepare_worktree',
    'Create an isolated checkout at committed HEAD on its own worker/<id> branch. Requires a clean checkout. Not a security sandbox — it prevents collisions, not malice.',
    { task_id: z.string().optional() },
    input => api.prepare_worktree(input), false);

  register('list_worktrees', 'List the worker worktrees this repository currently has.',
    {}, () => api.list_worktrees());

  register('remove_worktree',
    'Remove a worker worktree and its branch. Refuses when the checkout has uncommitted work or the branch holds unmerged commits, so nothing is lost.',
    { task_id: z.string() }, input => api.remove_worktree(input), false);

  register('sync',
    'Regenerate AGENTS.md and CLAUDE.md from .agents/. Nothing else is generated — skills, commands and agents are read in place.',
    {}, () => api.sync(), false);

  register('check',
    'Report whether AGENTS.md and CLAUDE.md still match .agents/.',
    {}, () => api.check());

  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'server.mjs')) {
  try {
    const args = process.argv.slice(2);
    const at = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
    const root = at('--root') ?? process.cwd();
    const engine = at('--engine') ?? 'claude';
    await createServer(resolve(root), engine).connect(new StdioServerTransport());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
