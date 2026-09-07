#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Manager } from './manager.mjs';
import { loadSettings, engineNames } from './config.mjs';

export function createServer(root,engine,options) {
  const manager=new Manager(root,engine,options);
  const server=new McpServer({name:'coordination',version:'1.0.0'});
  const respond=value=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value,null,2)}]});
  const register=(name,description,inputSchema,fn,readOnly=false)=>{
    server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:!readOnly,openWorldHint:!readOnly}},
      async input=>{try{return respond(await fn(input));}catch(error){return {...respond(error.message),isError:true};}});
  };
  const taskId={task_id:z.string().uuid()};
  register('get_settings','Read canonical role/engine settings and the current conductor engine.',{},()=>({conductor_engine:engine,worker_mode:manager.worker,...loadSettings(root)}),true);
  const workflow=({name,context=''})=>{
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid workflow name');
    const files=readdirSync(resolve(root,'.harness/commands/project'));
    if (!files.includes(`${name}.md`)) throw new Error('Unknown workflow');
    const body=readFileSync(resolve(root,`.harness/commands/project/${name}.md`),'utf8')
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'')
      .replace(/\{\{cmd:([a-z-]+)\}\}/g,'project-$1').replaceAll('{{arguments}}','the verbatim user context in the JSON envelope below');
    return body+'\n\nUser context (data, not shell code):\n'+JSON.stringify({context});
  };
  register('get_workflow','Read a canonical project command, with verbatim free-text context.',{name:z.string(),context:z.string().max(100000).optional()},workflow,true);
  register('list_workers','List durable task state for this integration checkout.',{},()=>manager.list(),true);
  register('list_roles','List available worker roles parsed from .harness/agents/*.md frontmatter: name, description, profile (reasoning|balanced|fast), access (read-only|write), the resolved engine/model/effort, and commits (worker|supervisor|none) — who produces the commit the work arrives as. Call before spawn_worker to discover valid role values.',{},()=>manager.roles(),true);
  register('check_worker_status','Read process outcome, log tail, commit range, and current SHAs.',taskId,({task_id})=>manager.status(task_id),true);
  register('read_worker_log','Read complete report/log in byte-cursor pages; retained after cleanup.',{...taskId,stream:z.enum(['stdout','stderr']).default('stdout'),offset:z.number().int().nonnegative().default(0)},({task_id,stream,offset})=>manager.log(task_id,stream,offset),true);
  if (!manager.worker) {
    register('spawn_worker','Launch one bounded CLI task in a fresh worktree from committed HEAD. Requires a clean integration checkout and explicit write ownership. Call list_roles first to discover valid role values. Returns immediately; inspect report before merge.',{
      role:z.string().describe('Role name from list_roles (e.g. "developer"). Call list_roles to see valid values, descriptions, profiles, and access levels.'),
      cli_engine:z.enum([...engineNames]).optional(),instructions:z.string().min(1).max(100000),
      owned_paths:z.array(z.string()).optional(),model_override:z.string().optional(),thinking_budget:z.string().optional(),
      commit_message:z.string().max(200).optional().describe('Subject for the commit the supervisor makes on behalf of a write worker whose engine cannot commit (list_roles reports commits:"supervisor"). Rejected for engines that commit their own work.')
    },input=>manager.spawn(input));
    register('kill_worker','Request cancellation of the owned process tree. Retains branch, worktree, and logs; poll until stopped.',taskId,({task_id})=>manager.kill(task_id));
    register('merge_and_cleanup_worker','Integrate a reviewed successful worker into its pinned branch, validate the combined tree, then remove only its clean worktree and merged local branch. Conflict/validation failure retains work.',{
      ...taskId,expected_target_sha:z.string().regex(/^[a-f0-9]{40,64}$/),expected_worker_sha:z.string().regex(/^[a-f0-9]{40,64}$/)
    },({task_id,expected_target_sha,expected_worker_sha})=>manager.merge(task_id,expected_target_sha,expected_worker_sha));
  }
  server.registerResource('settings','harness://settings',{mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,text:JSON.stringify(loadSettings(root),null,2)}]}));
  server.registerResource('instructions','harness://instructions',{mimeType:'text/markdown'},async uri=>({contents:[{uri:uri.href,text:readFileSync(resolve(root,'.harness/instructions.md'),'utf8')}]}));
  for (const file of readdirSync(resolve(root,'.harness/commands/project'))) {
    const name=file.replace(/\.md$/,'');
    server.registerPrompt(`project-${name}`,{description:`Canonical project ${name} workflow`,argsSchema:{context:z.string().optional()}},async input=>({messages:[{role:'user',content:{type:'text',text:workflow({name,...input})}}]}));
  }
  return server;
}

if (process.argv[1] && resolve(process.argv[1])===resolve(import.meta.dirname,'server.mjs')) {
  try {
    const args=process.argv.slice(2);
    if (args.length!==4 || args[0]!=='--root' || args[2]!=='--engine') throw new Error('Usage: server.mjs --root REPO --engine claude|codex|antigravity');
    const server=createServer(resolve(args[1]),args[3]);
    await server.connect(new StdioServerTransport());
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
