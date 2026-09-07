import assert from 'node:assert/strict';
import { readFileSync, readdirSync, cpSync, mkdtempSync, rmSync, mkdirSync, writeFileSync,
  unlinkSync, existsSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { sync } from '../scripts/sync-harness.mjs';

const root = resolve(import.meta.dirname, '..');
const read = p => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');

function fixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), 'harness-test-'));
  cpSync(resolve(root,'.harness'),resolve(dir,'.harness'),{recursive:true});
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  sync(dir);
  return dir;
}

test('invalid canonical input fails before changing any generated file', t => {
  const dir = fixture(t);
  const before = readFileSync(resolve(dir,'AGENTS.md'));
  const source = resolve(dir,'.harness/commands/project/work.md');
  const original = readFileSync(source,'utf8');
  const added = resolve(dir,'.harness/commands/project/new-command.md');
  writeFileSync(added,original.replace('name: work','name: mismatched-name'));
  assert.throws(()=>sync(dir),/name.*path|filename/i);
  assert.deepEqual(readFileSync(resolve(dir,'AGENTS.md')),before);
  unlinkSync(added);
  // Command bodies are no longer expanded into files — the server expands them at
  // dispatch — so the unresolved-token guard now applies to the artifacts that
  // are generated: agents, skills, rules, and the shared instructions.
  const agent = resolve(dir,'.harness/agents/developer.md');
  const agentOriginal = readFileSync(agent,'utf8');
  writeFileSync(agent,agentOriginal+'\n{{typo:unresolved}}\n');
  assert.throws(()=>sync(dir),/Unresolved token/);
  assert.deepEqual(readFileSync(resolve(dir,'AGENTS.md')),before);
  writeFileSync(agent,agentOriginal);
  // A command whose argument contract is broken must still fail at sync time,
  // even though nothing is generated from it.
  writeFileSync(source,original.replace('{{arguments}}','removed'));
  assert.throws(()=>sync(dir),/argument contract/i);
  assert.deepEqual(readFileSync(resolve(dir,'AGENTS.md')),before);
});

test('manifest paths and symlink destinations cannot escape the fixture', t => {
  const dir = fixture(t);
  const manifestPath = resolve(dir,'.harness/generated.json');
  const original = readFileSync(manifestPath,'utf8');
  writeFileSync(manifestPath,JSON.stringify({version:1,files:{'../outside.md':'abc'}}));
  assert.throws(()=>sync(dir,{force:true}),/Unsafe|Unmanaged/);
  writeFileSync(manifestPath,original);
  const outside = mkdtempSync(resolve(tmpdir(),'harness-outside-'));
  t.after(()=>rmSync(outside,{recursive:true,force:true}));
  const agentsDir = resolve(dir,'.codex/agents');
  rmSync(agentsDir,{recursive:true});
  symlinkSync(outside,agentsDir,'junction');
  assert.throws(()=>sync(dir,{force:true}),/Symlink/);
  assert.deepEqual(readdirSync(outside),[]);
});

test('check detects missing, changed, and obsolete output without writing', t => {
  const dir = fixture(t);
  const target = resolve(dir,'.claude/skills/tdd-loop/SKILL.md');
  writeFileSync(target,'manual change\n');
  unlinkSync(resolve(dir,'.codex/agents/developer.toml'));
  unlinkSync(resolve(dir,'.harness/agents/researcher.md'));
  const manifest = readFileSync(resolve(dir,'.harness/generated.json'));
  const drift = sync(dir,{check:true});
  assert.ok(drift.includes('.claude/skills/tdd-loop/SKILL.md'));
  assert.ok(drift.includes('.codex/agents/developer.toml'));
  assert.ok(drift.includes('.agents/agents/researcher.md'));
  assert.equal(readFileSync(target,'utf8'),'manual change\n');
  assert.deepEqual(readFileSync(resolve(dir,'.harness/generated.json')),manifest);
  assert.throws(()=>sync(dir),/Manual edit/);
});

test('add, update, and retire assets while preserving local files and binary resources', t => {
  const dir = fixture(t);
  const source = resolve(dir,'.harness/skills/example');
  mkdirSync(source);
  writeFileSync(resolve(source,'SKILL.md'),'---\nname: example\ndescription: Example fixture skill\n---\n\nUse [script](helper.mjs).\n');
  const script = 'console.log("literal $ARGUMENTS @file 😀");\n';
  const binary = Buffer.from([0,255,254,13,10,128]);
  writeFileSync(resolve(source,'helper.mjs'),script);
  writeFileSync(resolve(source,'resource.bin'),binary);
  const local = resolve(dir,'.claude/settings.local.json');
  writeFileSync(local,'{"custom":true}\n');
  const custom = resolve(dir,'.agents/skills/personal/SKILL.md');
  mkdirSync(resolve(custom,'..'),{recursive:true});
  writeFileSync(custom,'personal skill\n');
  sync(dir);
  for (const harness of ['.claude','.agents']) {
    assert.equal(readFileSync(resolve(dir,harness,'skills/example/helper.mjs'),'utf8'),script);
    assert.deepEqual(readFileSync(resolve(dir,harness,'skills/example/resource.bin')),binary);
  }
  writeFileSync(resolve(source,'SKILL.md'),'---\nname: example\ndescription: Updated fixture skill\n---\n\nChanged procedure.\n');
  sync(dir);
  assert.match(readFileSync(resolve(dir,'.agents/skills/example/SKILL.md'),'utf8'),/Changed procedure/);
  rmSync(source,{recursive:true});
  sync(dir);
  assert.ok(!existsSync(resolve(dir,'.agents/skills/example/SKILL.md')));
  // Retiring the last file in a directory must prune the directory too. An empty
  // `example/` still looks like a skill to anything walking the tree.
  for (const harness of ['.claude','.agents']) {
    assert.ok(!existsSync(resolve(dir,harness,'skills/example')),`${harness} skill husk is pruned`);
  }
  assert.equal(readFileSync(local,'utf8'),'{"custom":true}\n');
  assert.equal(readFileSync(custom,'utf8'),'personal skill\n');
  assert.deepEqual(sync(dir,{check:true}),[]);
});

test('native harness entry points carry the canonical instructions', () => {
  assert.match(read('AGENTS.md'), /Generated from \.harness\//);
  assert.match(read('CLAUDE.md'), /^@AGENTS\.md$/m);
  // Commands generate nothing: they are MCP prompts, served by the coordination
  // server from .harness/commands/project. Assert the absence, so reintroducing
  // native command files (and the per-harness invocation split they forced) is a
  // test failure rather than a silent regression.
  for (const file of readdirSync(resolve(root, '.harness/commands/project'))) {
    const name = file.replace(/\.md$/, '');
    assert.ok(!existsSync(resolve(root,`.claude/commands/project/${name}.md`)), `no native command file for ${name}`);
    assert.ok(!existsSync(resolve(root,`.agents/skills/project-${name}/SKILL.md`)), `no skill wrapper for ${name}`);
    // The catalog is the only place a command name is published to agents.
    assert.ok(read('AGENTS.md').includes(`project-${name}`), `${name} is listed in the command catalog`);
  }
  assert.match(read('AGENTS.md'), /Commands are MCP prompts/);
  assert.match(read('AGENTS.md'), /get_workflow/);
  // Skills remain generated for every harness: Claude reads .claude/skills,
  // Codex and Antigravity both read .agents/skills.
  for (const dir of readdirSync(resolve(root, '.harness/skills'))) {
    for (const harness of ['.claude','.agents']) {
      assert.ok(existsSync(resolve(root,harness,'skills',dir,'SKILL.md')), `${harness} carries the ${dir} skill`);
    }
  }
  for (const file of readdirSync(resolve(root, '.harness/agents'))) {
    const name = file.replace(/\.md$/, '');
    const toml = read(`.codex/agents/${name}.toml`);
    const prompt = JSON.parse(toml.match(/^developer_instructions = (.+)$/m)[1]);
    assert.ok(prompt.includes('\n\n'), 'Codex receives real paragraph breaks');
    assert.ok(!prompt.includes('\\r'), 'no literal CR escapes inside the prompt');
    assert.match(read(`.agents/agents/${name}.md`), /^subagent: true$/m);
    assert.match(read(`.claude/agents/${name}.md`), /^model: /m);
  }
});
