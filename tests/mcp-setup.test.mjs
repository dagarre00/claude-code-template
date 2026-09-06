import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { configure } from '../scripts/configure-mcp.mjs';
import { copyRecursiveSync } from './helpers/copy-recursive.mjs';
test('machine-local MCP setup is idempotent and preserves other servers and Codex settings',t=>{
  // Non-ASCII-plus-space prefix is deliberate: it exercises path quoting. Use
  // copyRecursiveSync (not fs.cpSync) — see tests/helpers/copy-recursive.mjs.
  const root=mkdtempSync(resolve(tmpdir(),'mcp setup café '));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  copyRecursiveSync(resolve(import.meta.dirname,'../.harness'),resolve(root,'.harness'));
  mkdirSync(resolve(root,'.codex'));
  const prefix='model = "user-model"\n# keep my comment\n[mcp_servers.existing]\ncommand = "keep"\n';
  writeFileSync(resolve(root,'.codex/config.toml'),prefix);
  writeFileSync(resolve(root,'.mcp.json'),JSON.stringify({mcpServers:{existing:{command:'keep'}}}));
  assert.equal(configure(root,{check:true}).length,3);
  assert.equal(configure(root).length,3);
  assert.deepEqual(configure(root),[]);
  const claude=JSON.parse(readFileSync(resolve(root,'.mcp.json'),'utf8'));
  assert.equal(claude.mcpServers.existing.command,'keep');
  assert.equal(claude.mcpServers.coordination.args[2],root);
  assert.ok(readFileSync(resolve(root,'.codex/config.toml'),'utf8').startsWith(prefix));
  claude.mcpServers.coordination={command:'unowned'};
  writeFileSync(resolve(root,'.mcp.json'),JSON.stringify(claude));
  assert.throws(()=>configure(root),/unowned/);
});
