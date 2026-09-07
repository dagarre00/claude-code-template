// Reader for `.agents/` — the one canonical source. Every consumer (prompt
// composition, the root-file generator, the MCP catalog) goes through here, so
// a malformed file fails once, loudly, naming the file, instead of producing a
// silently degraded prompt somewhere downstream.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROFILES = Object.freeze(['reasoning', 'balanced', 'fast']);
export const ACCESS = Object.freeze(['read-only', 'write']);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// Only these keys read an inline `[a, b]` as a list. Prose values legitimately
// start and end with brackets — `argument-hint: [todo, entity, or scope …]` is
// the shape every command uses — and splitting those on commas silently
// shredded the hint into fragments.
const LIST_KEYS = new Set(['skills', 'aliases', 'tags', 'cssclasses']);

// A deliberately small YAML subset: scalars, inline lists, and block lists.
// Anything richer is a sign the frontmatter is growing logic it should not have,
// so it fails rather than being half-understood.
export function parseFrontmatter(text, where) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = FRONTMATTER.exec(normalized);
  if (!match) return { data: {}, body: normalized };
  const data = {};
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const scalar = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!scalar) throw new Error(`Unreadable frontmatter line in ${where}: ${line}`);
    const [, key, raw] = scalar;
    if (raw === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(unquote(lines[++i].replace(/^\s*-\s+/, '').trim()));
      }
      data[key] = items;
      continue;
    }
    data[key] = LIST_KEYS.has(key) && raw.startsWith('[') && raw.endsWith(']')
      ? raw.slice(1, -1).split(',').map(part => unquote(part.trim())).filter(Boolean)
      : unquote(raw.trim());
  }
  return { data, body: normalized.slice(match[0].length) };
}

const unquote = value =>
  (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
    ? value.slice(1, -1)
    : value;

// Rules a worker must not receive, marked in `.agents/rules.md` with a trailing
// HTML comment so the file stays readable and renders unchanged.
//
// This is not a token optimisation, it is a correctness fix: the worker contract
// forbids every mutating git command, while the conductor rules instruct you to
// branch, commit, push and open a pull request. A worker handed both is handed a
// contradiction, and which half it obeys is luck. So it is handed only one.
// Two regexes on purpose. A /g regex is stateful across .test() calls, so using
// one object for both the filter and the strip would make the filter alternate.
const CONDUCTOR_ONLY = /<!--\s*conductor-only\s*-->/;
const CONDUCTOR_ONLY_ALL = /<!--\s*conductor-only\s*-->/g;
const RULE_START = /^\d+\.\s+\*\*/;

export function workerRules(rules) {
  const lines = rules.replace(/\r\n/g, '\n').split('\n');
  const preamble = [];
  const blocks = [];
  for (const line of lines) {
    // The trailing prose sections ("## Adding rules") are instructions for
    // editing this file, which is not a worker's job.
    if (/^##\s/.test(line) && blocks.length) break;
    if (RULE_START.test(line)) blocks.push([line]);
    else if (blocks.length) blocks[blocks.length - 1].push(line);
    else preamble.push(line);
  }
  const kept = blocks
    .filter(block => !CONDUCTOR_ONLY.test(block.join('\n')))
    .map((block, index) => block.join('\n').replace(RULE_START, `${index + 1}. **`));
  return [preamble.join('\n').trim(), kept.join('\n\n').trim()]
    .filter(Boolean).join('\n\n').replace(CONDUCTOR_ONLY_ALL, '').trimEnd() + '\n';
}

const read = path => readFileSync(path, 'utf8');
const markdown = dir => existsSync(dir)
  ? readdirSync(dir).filter(name => name.endsWith('.md')).sort()
  : [];

function requireText(value, field, where) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${field} in ${where}`);
  return value.trim();
}

function loadRoles(root) {
  const dir = resolve(root, '.agents/agents');
  return markdown(dir).map(file => {
    const where = `.agents/agents/${file}`;
    const name = file.replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(read(resolve(dir, file)), where);
    // Identity is the filename. A disagreeing `name:` means one of the two is a
    // typo, and guessing which would dispatch the wrong role under the right label.
    if (data.name !== undefined && data.name !== name) {
      throw new Error(`Role name "${data.name}" disagrees with its filename in ${where}`);
    }
    if (!PROFILES.includes(data.profile)) {
      throw new Error(`Invalid profile "${data.profile}" in ${where}; expected one of ${PROFILES.join(', ')}`);
    }
    if (!ACCESS.includes(data.access)) {
      throw new Error(`Invalid access "${data.access}" in ${where}; expected one of ${ACCESS.join(', ')}`);
    }
    return { name, description: requireText(data.description, 'description', where),
      profile: data.profile, access: data.access, body: body.trim() };
  });
}

function loadSkills(root) {
  const dir = resolve(root, '.agents/skills');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => statSync(resolve(dir, name)).isDirectory()).sort().map(name => {
    const where = `.agents/skills/${name}/SKILL.md`;
    const path = resolve(dir, name, 'SKILL.md');
    // A directory without SKILL.md is a half-finished skill, and a command that
    // declares it would compose a prompt with a silently empty procedure.
    if (!existsSync(path)) throw new Error(`Skill directory "${name}" has no SKILL.md (${where})`);
    const { data, body } = parseFrontmatter(read(path), where);
    if (data.name !== undefined && data.name !== name) {
      throw new Error(`Skill name "${data.name}" disagrees with its directory in ${where}`);
    }
    // Supporting files are listed, never inlined: llm-handoff's TEMPLATE.md alone
    // is 39KB, and a prompt that carries every attachment defeats the point of
    // choosing which skills to send.
    const files = readdirSync(resolve(dir, name)).filter(file => file !== 'SKILL.md').sort()
      .map(file => `.agents/skills/${name}/${file}`);
    return { name, description: requireText(data.description, 'description', where),
      body: body.trim(), files };
  });
}

function loadCommands(root, skills) {
  const dir = resolve(root, '.agents/commands');
  const known = new Set(skills.map(skill => skill.name));
  return markdown(dir).map(file => {
    const where = `.agents/commands/${file}`;
    const name = file.replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(read(resolve(dir, file)), where);
    if (data.name !== undefined && data.name !== name) {
      throw new Error(`Command name "${data.name}" disagrees with its filename in ${where}`);
    }
    const declared = data.skills ?? [];
    if (!Array.isArray(declared)) throw new Error(`skills must be a list in ${where}`);
    for (const skill of declared) {
      if (!known.has(skill)) throw new Error(`Command "${name}" declares unknown skill "${skill}" (${where})`);
    }
    return { name, description: requireText(data.description, 'description', where),
      argumentHint: data['argument-hint'] ?? '', skills: declared, body: body.trim() };
  });
}

export function loadCanonical(root) {
  const base = resolve(root, '.agents');
  if (!existsSync(base)) throw new Error(`No canonical source at ${base}`);
  const rulesPath = resolve(base, 'rules.md');
  if (!existsSync(rulesPath)) throw new Error('Missing .agents/rules.md');
  const contractPath = resolve(base, 'worker-contract.md');
  if (!existsSync(contractPath)) throw new Error('Missing .agents/worker-contract.md');
  const skills = loadSkills(root);
  const projectPath = resolve(base, 'project.md');
  return {
    root,
    rules: read(rulesPath).replace(/\r\n/g, '\n').trim(),
    contract: read(contractPath).replace(/\r\n/g, '\n').trim(),
    project: existsSync(projectPath) ? read(projectPath).replace(/\r\n/g, '\n').trim() : '',
    roles: loadRoles(root),
    skills,
    commands: loadCommands(root, skills)
  };
}
