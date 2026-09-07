#!/usr/bin/env node
// Canonical instructions are data; this program never executes their contents.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSettings, engineNames } from '../tools/coordination-mcp/config.mjs';
import { engines as engineAdapters } from '../tools/coordination-mcp/engines/index.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const normalize = s => typeof s === 'string' ? s.replace(/\r\n/g, '\n') : s;
const hash = s => createHash('sha256').update(normalize(s)).digest('hex');
const promptFile = path => /\.(?:md|toml|tmpl)$/.test(path);
const marker = source => `<!-- Generated from ${source}; DO NOT EDIT. Run node scripts/sync-harness.mjs. -->\n`;
const slug = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function inside(root, path) {
  if (isAbsolute(path) || /[\\:\0]/.test(path) || path.split('/').some(p=>p==='..' || !p || /[. ]$/.test(p))) {
    throw new Error(`Unsafe path: ${path}`);
  }
  const full = resolve(root, path);
  if (!relative(root, full) || relative(root, full).startsWith(`..${sep}`)) {
    throw new Error(`Unsafe path: ${path}`);
  }
  let cursor = root;
  for (const part of path.split('/')) {
    cursor = resolve(cursor, part);
    if (lstatSync(cursor,{throwIfNoEntry:false})?.isSymbolicLink()) {
      throw new Error(`Symlink/reparse point is not a generated target: ${path}`);
    }
  }
  return full;
}

function read(root, path) { return normalize(readFileSync(inside(root, path), 'utf8')); }

function walk(root, dir) {
  return readdirSync(inside(root, dir), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const path = `${dir}/${entry.name}`;
      inside(root, path);
      return entry.isDirectory() ? walk(root, path) : [path];
    });
}

// Deliberately small authoring format: one scalar per line, quoted with JSON
// syntax when necessary. Native YAML serializers receive only supported fields.
function document(root, path) {
  const raw = read(root, path);
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z][a-z-]*): (.+)$/);
    if (!field || field[1] in meta) throw new Error(`Invalid/duplicate metadata in ${path}: ${line}`);
    meta[field[1]] = field[2].startsWith('"') ? JSON.parse(field[2]) : field[2];
  }
  if (!slug.test(meta.name ?? '') || typeof meta.description !== 'string' || !meta.description.trim()) {
    throw new Error(`Invalid name/description: ${path}`);
  }
  return { path, meta, body: raw.slice(match[0].length).trimStart() };
}

function yaml(meta, body, source) {
  return '---\n' + Object.entries(meta).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n')
    + '\n---\n\n' + marker(source) + '\n' + body.trimEnd() + '\n';
}

export function render(root) {
  const outputs = new Map();
  const settings = loadSettings(root);
  const adapters = settings.engines;
  function namedDocument(path) {
    const doc = document(root,path);
    if (posix.basename(path) !== `${doc.meta.name}.md`) throw new Error(`Name does not match filename: ${path}`);
    return doc;
  }
  const commands = walk(root, '.harness/commands/project').map(namedDocument);
  const names = new Set(commands.map(c => c.meta.name));
  if (names.size !== commands.length) throw new Error('Duplicate command name');
  const agents = walk(root, '.harness/agents').map(namedDocument);
  const skills = walk(root, '.harness/skills');

  function emit(path, content) {
    if (outputs.has(path)) throw new Error(`Duplicate output: ${path}`);
    outputs.set(path, content);
  }

  function expand(body, source, target, harness) {
    body = body.replace(/\{\{cmd:([a-z-]+)\}\}/g, (_, name) => {
      if (!names.has(name)) throw new Error(`Unknown command ${name} in ${source}`);
      return harness === 'claude' ? `/project:${name}` : `project-${name}`;
    }).replaceAll('{{arguments}}', harness === 'claude' ? '$ARGUMENTS'
      : 'user-provided context following this skill invocation (empty if omitted)');
    // Uppercase placeholders belong to the external-handoff template and must
    // survive until that workflow fills them; lowercase tokens are compiler syntax.
    if (/\{\{[a-z][^\n]*?\}\}/.test(body)) throw new Error(`Unresolved token: ${source}`);
    // Resolve relative markdown links against the SOURCE, then rebase into the
    // native output. Markdown links do not implicitly import prompt contents.
    return body.replace(/(\]\()([^\s)]+)(\))/g, (all, before, href, after) => {
      if (/^(?:[a-z]+:|#|\/)/i.test(href) || /[<>]/.test(href)) return all;
      const [path, fragment] = href.split('#');
      const resolved = posix.normalize(posix.join(posix.dirname(source), path));
      const rebased = posix.relative(posix.dirname(target), resolved);
      return before + rebased + (fragment ? `#${fragment}` : '') + after;
    });
  }

  const intro = expand(read(root, '.harness/instructions.md'), '.harness/instructions.md', 'AGENTS.md', 'shared');
  const rules = walk(root, '.harness/rules').map(path =>
    expand(read(root,path).replace(/^---\n[\s\S]*?\n---\n/, ''), path, 'AGENTS.md', 'shared')).join('\n');
  const catalog = '\n## Native command catalog\n\nEach command accepts trailing free-text context. '
    + 'Logical IDs in shared procedures name the corresponding entry below.\n\n'
    + '| Claude Code | Codex | Antigravity CLI |\n| --- | --- | --- |\n'
    + commands.map(c => `| \`/project:${c.meta.name}\` | \`$project-${c.meta.name}\` | \`/project-${c.meta.name}\` |`).join('\n')
    + '\n\n## Native agent catalog\n\n'
    + agents.map(a => `- \`${a.meta.name}\` (${a.meta.profile}): ${expand(a.meta.description,a.path,'AGENTS.md','shared')}`).join('\n') + '\n';
  const project = expand(read(root, '.harness/project.md'), '.harness/project.md', 'AGENTS.md', 'shared');
  emit('AGENTS.md', marker('.harness/') + '\n' + project + '\n' + intro + '\n' + rules + catalog);
  emit('CLAUDE.md', marker('.harness/instructions.md') + '\n@AGENTS.md\n');

  for (const command of commands) {
    const {name,description} = command.meta;
    if (!command.meta['argument-hint'] || !command.body.includes('{{arguments}}')) {
      throw new Error(`Command lacks argument contract: ${command.path}`);
    }
    for (const [harness,target] of [['claude',`.claude/commands/project/${name}.md`],
      ['shared',`.agents/skills/project-${name}/SKILL.md`]]) {
      const meta = { name: harness === 'claude' ? name : `project-${name}`,
        description: expand(description,command.path,target,harness) };
      if (harness === 'claude') meta['argument-hint'] = command.meta['argument-hint'];
      emit(target, yaml(meta,expand(command.body,command.path,target,harness),command.path));
    }
  }

  for (const path of skills) {
    const suffix = path.slice('.harness/skills/'.length);
    for (const [harness,target] of [['claude',`.claude/skills/${suffix}`],['shared',`.agents/skills/${suffix}`]]) {
      if (path.endsWith('/SKILL.md')) {
        const skill = document(root,path);
        if (suffix !== `${skill.meta.name}/SKILL.md` || names.has(skill.meta.name.replace(/^project-/,'')) && skill.meta.name.startsWith('project-')) {
          throw new Error(`Skill name/path collision: ${path}`);
        }
        emit(target,yaml({name:skill.meta.name,description:expand(skill.meta.description,path,target,harness)},
          expand(skill.body,path,target,harness),path));
      } else if (promptFile(path)) {
        emit(target,marker(path)+'\n'+expand(read(root,path),path,target,harness));
      } else {
        emit(target,readFileSync(inside(root,path)));
      }
    }
  }

  for (const agent of agents) {
    const {name,description,profile,access} = agent.meta;
    if (!['reasoning','balanced','fast'].includes(profile) || !['read-only','write'].includes(access)) {
      throw new Error(`Invalid agent profile/access: ${agent.path}`);
    }
    const startup = 'Read AGENTS.md and its included behavioral rules before acting.\n\n';
    const roleSettings = settings.roles[name] ?? {};
    const modelFor = engine => roleSettings.models?.[engine] ?? adapters[engine].models[profile];
    const effortFor = engine => roleSettings.effort?.[engine] ?? adapters[engine].effort[profile];
    // Each engine owns its own native file format; the loop owns none of them.
    // An engine with no nativeAgent (MCP-only) simply generates nothing.
    const helpers = {
      source: agent.path,
      expand: (text,target,harness) => expand(text,agent.path,target,harness),
      yaml: (meta,body) => yaml(meta,body,agent.path),
    };
    for (const engineName of engineNames) {
      const native = engineAdapters[engineName].nativeAgent;
      if (!native) continue;
      const output = native({name,description,profile,access,body:agent.body,startup,
        modelFor,effortFor,config:adapters[engineName],helpers});
      if (output) emit(output.path,output.content);
    }
  }
  return outputs;
}

const managed = path => ['AGENTS.md','CLAUDE.md'].includes(path)
  || /^(?:\.claude\/(?:agents|skills|commands\/project)|\.agents\/(?:agents|skills)|\.codex\/agents)\/.+/.test(path);

export function sync(root, { check = false, force = false } = {}) {
  root = realpathSync(root);
  const outputs = render(root);
  const manifestPath = inside(root,'.harness/generated.json');
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath,'utf8')).files : {};
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('Invalid generated manifest');
  const changes = [];
  for (const path of new Set([...Object.keys(previous),...outputs.keys()])) {
    if (!managed(path)) throw new Error(`Unmanaged manifest path: ${path}`);
    const full = inside(root,path);
    const current = existsSync(full) ? (promptFile(path) ? normalize(readFileSync(full,'utf8')) : readFileSync(full)) : null;
    const wanted = outputs.get(path);
    if (current === (wanted ?? null) || current !== null && wanted !== undefined && Buffer.from(current).equals(Buffer.from(wanted))) continue;
    if (!check && !force && current !== null && hash(current) !== previous[path]) {
      throw new Error(`Manual edit or unowned file: ${path}. Move edits to .harness/; --force replaces only managed outputs.`);
    }
    changes.push({path,full,wanted});
  }
  const manifest = JSON.stringify({version:1,files:Object.fromEntries([...outputs].sort(([a],[b])=>a.localeCompare(b)).map(([p,s])=>[p,hash(s)]))},null,2)+'\n';
  const manifestChanged = !existsSync(manifestPath) || normalize(readFileSync(manifestPath,'utf8')) !== manifest;
  if (check) return [...changes.map(c=>c.path),...(manifestChanged?['.harness/generated.json']:[])];
  // All inputs, destinations, and conflicts have been checked before any write.
  for (const change of changes) {
    if (change.wanted === undefined) unlinkSync(change.full);
    else { mkdirSync(dirname(change.full),{recursive:true}); writeFileSync(change.full,change.wanted); }
  }
  if (manifestChanged) writeFileSync(manifestPath,manifest);
  return changes.map(c=>c.path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
      console.log('Usage: node scripts/sync-harness.mjs [--check] [--force] [--root PATH]\n--check reports drift without writes. --force replaces manually changed managed outputs.');
    } else {
      let root = defaultRoot;
      for (let i=0;i<args.length;i++) {
        if (args[i]==='--root' && args[i+1]) root=resolve(args[++i]);
        else if (!['--check','--force'].includes(args[i])) throw new Error(`Unknown/missing argument: ${args[i]}`);
      }
      const changed = sync(root,{check:args.includes('--check'),force:args.includes('--force')});
      if (args.includes('--check') && changed.length) { console.error('Harness drift:\n'+changed.join('\n')); process.exitCode=1; }
      else console.log(args.includes('--check')?'Harness files are in sync.':`Synchronized ${changed.length} harness files.`);
    }
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
