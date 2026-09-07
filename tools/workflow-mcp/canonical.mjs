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
    // A bare `key:` opens either a block list (`- item`) or one level of nesting
    // (`  subkey: value`). One level is all that is supported, and all that is
    // needed: `skills:` maps a role to the skills that role receives.
    if (raw === '') {
      const items = [];
      const map = {};
      let nested = false;
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (/^\s*-\s+/.test(next)) { items.push(unquote(next.replace(/^\s*-\s+/, '').trim())); i++; continue; }
        const pair = /^\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(next);
        if (!pair) break;
        nested = true;
        map[pair[1]] = inlineList(pair[2]) ?? unquote(pair[2].trim());
        i++;
      }
      data[key] = nested ? map : items;
      continue;
    }
    data[key] = LIST_KEYS.has(key) && raw.startsWith('[') && raw.endsWith(']')
      ? raw.slice(1, -1).split(',').map(part => unquote(part.trim())).filter(Boolean)
      : unquote(raw.trim());
  }
  return { data, body: normalized.slice(match[0].length) };
}

// `[a, b]` → ['a','b']; anything else → null, so a prose value that merely starts
// and ends with brackets stays a string.
const inlineList = raw => raw.startsWith('[') && raw.endsWith(']')
  ? raw.slice(1, -1).split(',').map(part => unquote(part.trim())).filter(Boolean)
  : null;

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

// Frontmatter is an allowlist, for the same reason .agents/config.json rejects
// an unknown role key: a field that is silently ignored looks exactly like a
// field that works. Role files used to carry Claude Code's own `model`, `color`
// and `tools` keys, which the workflow never reads — so tuning `model: opus`
// there changed nothing, while the setting that governs lives in config.json.
const ALLOWED = {
  role: ['name', 'description', 'type', 'profile', 'access'],
  command: ['name', 'description', 'type', 'argument-hint', 'skills'],
  skill: ['name', 'description', 'type']
};
// Keys worth explaining rather than just rejecting, because a person writing
// them has a specific intent that belongs somewhere real.
const REDIRECT = {
  model: 'model selection lives in .agents/config.json — set engines.<engine>.models.<profile>, '
    + 'or roles.<role>.models.<engine> to pin one role. Roles declare `profile`, not a model.',
  effort: 'effort lives in .agents/config.json — set engines.<engine>.effort.<profile>, '
    + 'or roles.<role>.effort.<engine>.',
  tools: 'tool access is decided by `access` (read-only or write), which each engine adapter '
    + 'translates into its own sandbox or permission mode.',
  disallowedTools: 'tool access is decided by `access` (read-only or write).'
};

function checkKeys(data, kind, where) {
  for (const key of Object.keys(data)) {
    if (ALLOWED[kind].includes(key)) continue;
    const hint = REDIRECT[key] ?? `expected one of ${ALLOWED[kind].join(', ')}`;
    throw new Error(`Unknown ${kind} key "${key}" in ${where}: ${hint}`);
  }
}

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
    checkKeys(data, 'role', where);
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
    checkKeys(data, 'skill', where);
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

function loadCommands(root, skills, roles) {
  const dir = resolve(root, '.agents/commands');
  const known = new Set(skills.map(skill => skill.name));
  const roleNames = new Set(roles.map(role => role.name));
  return markdown(dir).map(file => {
    const where = `.agents/commands/${file}`;
    const name = file.replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(read(resolve(dir, file)), where);
    checkKeys(data, 'command', where);
    if (data.name !== undefined && data.name !== name) {
      throw new Error(`Command name "${data.name}" disagrees with its filename in ${where}`);
    }
    const declared = data.skills ?? [];
    const check = skill => {
      if (!known.has(skill)) throw new Error(`Command "${name}" declares unknown skill "${skill}" (${where})`);
    };

    // Flat list: every role this command dispatches gets the same skills, which
    // is right for a single-role command and wrong for anything else.
    if (Array.isArray(declared)) {
      declared.forEach(check);
      return { name, description: requireText(data.description, 'description', where),
        argumentHint: data['argument-hint'] ?? '', skills: declared, skillsByRole: null,
        skillsFor: () => declared, body: body.trim() };
    }
    if (typeof declared !== 'object') throw new Error(`skills must be a list or a role map in ${where}`);

    // Role map: each role gets exactly what its step of the workflow needs.
    const owner = new Map();
    for (const [role, list] of Object.entries(declared)) {
      if (!roleNames.has(role)) {
        throw new Error(`Command "${name}" declares skills for unknown role "${role}" (${where})`);
      }
      if (!Array.isArray(list)) throw new Error(`skills.${role} must be a list in ${where}`);
      for (const skill of list) {
        check(skill);
        // Two roles needing the same procedure is the signal that the split is
        // not earning its keep — one agent would have done the work of both. It
        // also quietly defeats the point of an independent reviewer, which is to
        // read the change WITHOUT the author's procedures in its head.
        if (owner.has(skill)) {
          throw new Error(`Command "${name}" gives skill "${skill}" to both "${owner.get(skill)}" and `
            + `"${role}" (${where}). Roles dispatched by one command must not share skills: if both `
            + 'genuinely need it, a single role would have done better.');
        }
        owner.set(skill, role);
      }
    }
    return { name, description: requireText(data.description, 'description', where),
      argumentHint: data['argument-hint'] ?? '',
      skills: [...owner.keys()], skillsByRole: declared,
      skillsFor: role => declared[role] ?? [], body: body.trim() };
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
  const roles = loadRoles(root);
  const projectPath = resolve(base, 'project.md');
  return {
    root,
    rules: read(rulesPath).replace(/\r\n/g, '\n').trim(),
    contract: read(contractPath).replace(/\r\n/g, '\n').trim(),
    project: existsSync(projectPath) ? read(projectPath).replace(/\r\n/g, '\n').trim() : '',
    roles,
    skills,
    commands: loadCommands(root, skills, roles)
  };
}
