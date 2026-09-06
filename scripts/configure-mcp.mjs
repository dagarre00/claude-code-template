#!/usr/bin/env node
// Machine-local registration only; canonical workflow/settings stay in .harness.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { loadSettings } from '../tools/coordination-mcp/config.mjs';

const start='# BEGIN GENERATED COORDINATION MCP';
const end='# END GENERATED COORDINATION MCP';
function target(root,path) {
  let current=root;
  for (const part of relative(root,path).split(sep)) {
    current=resolve(current,part);
    if (lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink()) throw new Error(`Refusing linked configuration: ${path}`);
  }
  return path;
}
export function configure(root,{check=false}={}) {
  root=realpathSync(root);
  loadSettings(root);
  const launch=engine=>({command:process.execPath,args:[resolve(root,'tools/coordination-mcp/server.mjs'),'--root',root,'--engine',engine]});
  const changes=[];
  for (const [name,engine] of [['.mcp.json','claude'],['.agents/mcp_config.json','antigravity']]) {
    const path=target(root,resolve(root,name));
    const config=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
    if (!config || typeof config!=='object' || Array.isArray(config) || config.mcpServers && (typeof config.mcpServers!=='object' || Array.isArray(config.mcpServers))) throw new Error(`Invalid MCP config: ${name}`);
    const desired=launch(engine);
    const old=config.mcpServers?.coordination;
    if (old && !old.args?.some(value=>typeof value==='string' && /[/\\]tools[/\\]coordination-mcp[/\\]server\.mjs$/.test(value))) {
      throw new Error(`Existing unowned coordination server in ${name}; rename it before setup`);
    }
    if (JSON.stringify(old)!==JSON.stringify(desired)) {
      config.mcpServers={...config.mcpServers,coordination:desired};
      changes.push({name,path,content:JSON.stringify(config,null,2)+'\n'});
    }
  }
  const name='.codex/config.toml',path=target(root,resolve(root,name));
  const original=existsSync(path)?readFileSync(path,'utf8'):'';
  const expected=launch('codex');
  const block=start+'\n[mcp_servers.coordination]\ncommand = '+JSON.stringify(expected.command)
    +'\nargs = '+JSON.stringify(expected.args)+'\nstartup_timeout_sec = 20\ntool_timeout_sec = 120\n'+end;
  const begin=original.indexOf(start),finish=original.indexOf(end);
  if ((begin===-1)!==(finish===-1) || begin!==-1 && (finish<begin || original.indexOf(start,begin+1)!==-1 || original.indexOf(end,finish+1)!==-1)) throw new Error('Malformed generated MCP config block');
  const unmanaged=begin===-1?original:original.slice(0,begin)+original.slice(finish+end.length);
  if (/^\s*\[\s*mcp_servers\s*\.\s*["']?coordination["']?(?:\s*\.|\s*\])/m.test(unmanaged)) throw new Error('Existing unowned Codex coordination config; rename it before setup');
  const content=begin===-1?original+(original && !original.endsWith('\n')?'\n':'')+'\n'+block+'\n'
    :original.slice(0,begin)+block+original.slice(finish+end.length);
  if (content!==original) changes.push({name,path,content});
  if (!check) for (const change of changes) {mkdirSync(dirname(change.path),{recursive:true});writeFileSync(change.path,change.content);}
  return changes.map(c=>c.name);
}
if (process.argv[1] && resolve(process.argv[1])===resolve(import.meta.dirname,'configure-mcp.mjs')) {
  try {
    const args=process.argv.slice(2);
    if (args.some(arg=>arg!=='--check')) throw new Error('Usage: node scripts/configure-mcp.mjs [--check]');
    const changed=configure(resolve(import.meta.dirname,'..'),{check:args.includes('--check')});
    if (args.includes('--check') && changed.length) {console.error('MCP registration needs setup: '+changed.join(', '));process.exitCode=1;}
    else console.log(changed.length?'Configured local MCP for all three harnesses. Approve project trust/MCP access in each client.':'Local MCP registration is current.');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
