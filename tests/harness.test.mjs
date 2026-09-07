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
  // Neither command nor agent bodies are expanded into files any more, so the
  // unresolved-token guard applies to what is still generated: skills, rules,
  // and the shared instructions folded into AGENTS.md.
  const skill = resolve(dir,'.harness/skills/tdd-loop/SKILL.md');
  const skillOriginal = readFileSync(skill,'utf8');
  writeFileSync(skill,skillOriginal+'\n{{typo:unresolved}}\n');
  assert.throws(()=>sync(dir),/Unresolved token/);
  assert.deepEqual(readFileSync(resolve(dir,'AGENTS.md')),before);
  writeFileSync(skill,skillOriginal);
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
  const generatedDir = resolve(dir,'.claude/skills');
  rmSync(generatedDir,{recursive:true});
  symlinkSync(outside,generatedDir,'junction');
  assert.throws(()=>sync(dir,{force:true}),/Symlink/);
  assert.deepEqual(readdirSync(outside),[]);
});

test('check detects missing, changed, and obsolete output without writing', t => {
  const dir = fixture(t);
  const target = resolve(dir,'.claude/skills/tdd-loop/SKILL.md');
  writeFileSync(target,'manual change\n');
  unlinkSync(resolve(dir,'.agents/skills/tdd-loop/SKILL.md'));
  rmSync(resolve(dir,'.harness/skills/gotcha-recording'),{recursive:true});
  const manifest = readFileSync(resolve(dir,'.harness/generated.json'));
  const drift = sync(dir,{check:true});
  assert.ok(drift.includes('.claude/skills/tdd-loop/SKILL.md'), 'manual edit is drift');
  assert.ok(drift.includes('.agents/skills/tdd-loop/SKILL.md'), 'missing output is drift');
  assert.ok(drift.includes('.claude/skills/gotcha-recording/SKILL.md'), 'retired output is drift');
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
  // Agents generate nothing either: the manager prepends the canonical role body
  // to every worker prompt, and the permission mode carries read-only isolation,
  // so a per-engine agent file would only duplicate the role.
  for (const file of readdirSync(resolve(root, '.harness/agents'))) {
    const name = file.replace(/\.md$/, '');
    for (const path of [`.claude/agents/${name}.md`,`.agents/agents/${name}.md`,`.codex/agents/${name}.toml`]) {
      assert.ok(!existsSync(resolve(root,path)), `no generated agent file at ${path}`);
    }
    assert.ok(read('AGENTS.md').includes(`\`${name}\``), `${name} is listed in the agent catalog`);
  }
  // Only skills, the two root documents, and the worker-scoped instructions.
  assert.deepEqual(
    [...new Set(Object.keys(JSON.parse(read('.harness/generated.json')).files)
      .map(p => p.startsWith('.') ? p.split('/').slice(0,2).join('/') : p))].sort(),
    ['.agents/skills','.claude/skills','.harness/worker-instructions.md','AGENTS.md','CLAUDE.md']);

  // The worker document is AGENTS.md minus everything a worker may not act on.
  // It exists because that half is not free: measured at 4805 tokens per Codex
  // dispatch. Both halves come from one source, so they cannot drift apart.
  const worker = read('.harness/worker-instructions.md'), agents = read('AGENTS.md');
  assert.ok(worker.length < agents.length / 2, 'the worker subset is materially smaller');
  for (const conductorOnly of ['## Command catalog','## Agent catalog','## Workflow and delegation',
    '## Canonical authoring','MCP is the worker control plane','Two-strike pivot','Scoped context for sub-agents']) {
    assert.ok(agents.includes(conductorOnly), `AGENTS.md keeps ${conductorOnly}`);
    assert.ok(!worker.includes(conductorOnly), `the worker never receives ${conductorOnly}`);
  }
  for (const shared of ['Tests before implementation','Never modify tests to make them pass',
    'A dirty tree you did not dirty','Wiki-first, code-second','## Wiki map']) {
    assert.ok(worker.includes(shared), `the worker still receives ${shared}`);
  }
});
