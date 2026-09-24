#!/usr/bin/env node
// The stack-independent half of CI: checks that need only git and the files,
// so they run in any project on any runner. The stack-specific half — install,
// test command, architecture check — is the project's own CI steps, written by
// /project:init.
//
// Every check here enforces something the workflow used to leave to discipline,
// on the one side of it nothing else guards — the conductor's:
//   generated          AGENTS.md / CLAUDE.md match .agents/
//   wikilinks          every [[link]] in docs/wiki/ resolves
//   log                log entries use the closed kind vocabulary, oldest first
//   encoding           no stray UTF-8 BOM, no mojibake "?" landed in tracked text
//   range.log          (with --base) a change ships with its log entry
//   range.wiki         (with --base) code ships with a wiki update, or says why not
//   range.architecture (with --base) an architecture rule changes only with an ADR
//
// Usage: node verify.mjs [--root <dir>] [--base <ref>] [--json]
//        node verify.mjs --sort-log     re-sort log entries after a union merge
// Exit:  0 all checks pass (warnings allowed), 1 a check failed, 2 verify itself failed.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { checkGenerated } from './generate.mjs';

export const LOG_KINDS = Object.freeze(['init', 'interview', 'work', 'pr', 'adversary', 'review',
  'wiki-ingest', 'wiki-maintenance', 'chore']);

const GENERATED = new Set(['AGENTS.md', 'CLAUDE.md']);
const WIKI = 'docs/wiki';

const readJsonLoose = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
};

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(name => {
    const path = resolve(dir, name);
    if (name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : [];
  });
}

// Links inside fenced code and inline code are examples, not links.
const prose = text => text.replace(/\r\n/g, '\n')
  .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '')
  .replace(/`[^`\n]*`/g, '');

function checkWikilinks(root) {
  const base = resolve(root, WIKI);
  const files = markdownFiles(base);
  const byPath = new Set(files.map(file => relative(base, file).replaceAll('\\', '/').replace(/\.md$/, '').toLowerCase()));
  const byName = new Set(files.map(file => basename(file, '.md').toLowerCase()));
  const broken = [];
  for (const file of files) {
    for (const match of prose(readFileSync(file, 'utf8')).matchAll(/!?\[\[([^\]\n]+)\]\]/g)) {
      const target = match[1].split('|')[0].split('#')[0].trim().replace(/\.md$/, '');
      // `[[#heading]]` is same-page; `<slug>` is a template placeholder — no
      // filename can contain angle brackets.
      if (!target || /[<>]/.test(target)) continue;
      const key = target.toLowerCase();
      if (byPath.has(key) || (!key.includes('/') && byName.has(key))) continue;
      if (existsSync(resolve(base, target))) continue;   // a linked non-markdown file
      broken.push(`${relative(root, file).replaceAll('\\', '/')} → [[${match[1]}]]`);
    }
  }
  return { id: 'wikilinks', ok: !broken.length, details: broken };
}

// A worker whose stdout encoding did not round-trip UTF-8 writes a literal `?`
// (0x3F) for every character it could not represent, and can leave a stray
// UTF-8 BOM at the top of the file — both measured from a Codex conductor's
// report on Windows, and neither caught before this: verify.mjs read the text
// fine either way, since a `?` and a BOM are both perfectly valid on their own.
// A `?` sitting directly between two digits is the cheap, low-noise signal —
// real prose and code essentially never put a literal question mark there, but
// a mangled dash, multiplication sign or degree symbol in a date, a version or
// a measurement does.
function checkEncoding(root) {
  const files = [...markdownFiles(resolve(root, WIKI)), ...markdownFiles(resolve(root, '.agents')),
    ...['AGENTS.md', 'CLAUDE.md'].map(name => resolve(root, name)).filter(existsSync)];
  const broken = [];
  for (const path of files) {
    const rel = relative(root, path).replaceAll('\\', '/');
    const buffer = readFileSync(path);
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      broken.push(`${rel}: starts with a UTF-8 BOM`);
      continue;
    }
    const text = prose(buffer.toString('utf8'));
    if (text.includes('�')) {
      broken.push(`${rel}: contains the Unicode replacement character (U+FFFD) — a decode failure landed in tracked text`);
      continue;
    }
    const mangled = /\d\?\d/.exec(text);
    if (mangled) {
      broken.push(`${rel}: "${mangled[0]}" — a literal "?" between two digits usually means a non-ASCII `
        + 'character (dash, ×, °, …) was written as "?" instead');
    }
  }
  return { id: 'encoding', ok: !broken.length, details: broken };
}

function checkLog(root) {
  const path = resolve(root, WIKI, 'log.md');
  if (!existsSync(path)) return { id: 'log', ok: true, details: ['no docs/wiki/log.md'] };
  const problems = [];
  let previous = null;
  for (const line of readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('## [')) continue;
    const entry = /^## \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([a-z-]+)(?:\s+—\s+.+)?\s*$/.exec(line);
    if (!entry) { problems.push(`malformed heading: ${line}`); continue; }
    const [, stamp, kind] = entry;
    if (!LOG_KINDS.includes(kind)) problems.push(`unknown kind "${kind}": ${line} (expected ${LOG_KINDS.join(', ')})`);
    if (previous && stamp < previous) problems.push(`out of order — ${stamp} comes after ${previous}; entries are appended oldest first`);
    previous = stamp;
  }
  return { id: 'log', ok: !problems.length, details: problems };
}

// Stable sort of the log's entries by timestamp, preamble untouched. The repair
// after a union merge interleaved two branches' appends in branch order.
export function sortLog(root) {
  const path = resolve(root, WIKI, 'log.md');
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const first = text.search(/^## \[/m);
  if (first === -1) return 0;
  const entries = text.slice(first).split(/\n(?=## \[)/).map(entry => entry.replace(/\n+$/, ''));
  const stamp = entry => /^## \[([^\]]*)\]/.exec(entry)?.[1] ?? '';
  const sorted = entries.map((entry, index) => ({ entry, index }))
    .sort((a, b) => stamp(a.entry).localeCompare(stamp(b.entry)) || a.index - b.index)
    .map(item => item.entry);
  writeFileSync(path, text.slice(0, first) + sorted.join('\n\n') + '\n');
  return sorted.length;
}

function git(root, args) {
  // A per-invocation override, not a write to any config file: it widens
  // nothing beyond this one spawned process. Needed because `verify.mjs` runs
  // in the conductor's own shell, not inside a worktree `prepare_worktree`
  // already registered — a sandboxed conductor account (its SID distinct from
  // the checkout owner's, the same mismatch documented in engine-setup.md's
  // "Codex on Windows" section for workers) hits `dubious ownership` on its
  // very first git call here, before any worker exists to blame it on.
  const result = spawnSync('git', ['-C', root, '-c', 'core.quotepath=false', '-c', 'safe.directory=*', ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

const under = (path, bases) => bases.some(base => path === base || path.startsWith(`${base}/`));

function checkRange(root, base, config) {
  const changed = git(root, ['diff', '--name-only', '--no-renames', `${base}...HEAD`]).split('\n').map(line => line.trim()).filter(Boolean);
  const messages = git(root, ['log', '--format=%B%x00', `${base}..HEAD`]);
  const checks = [];

  checks.push({ id: 'range.log', ok: !changed.length || changed.includes(`${WIKI}/log.md`),
    details: changed.length && !changed.includes(`${WIKI}/log.md`)
      ? [`${changed.length} changed path(s) and no ${WIKI}/log.md entry — the log entry belongs to the change`] : [] });

  // Code is anything outside the wiki, the workflow's own text, the generated
  // root files, and root-level dotfiles.
  const code = changed.filter(path => !path.startsWith('docs/') && !path.startsWith('.agents/')
    && !GENERATED.has(path) && !/^\.[^/]+$/.test(path));
  const wiki = changed.filter(path => path.startsWith(`${WIKI}/`) && path !== `${WIKI}/log.md`);
  const waiver = /^Wiki-Update:\s*none\s*\((.+)\)\s*$/m.exec(messages);
  checks.push({ id: 'range.wiki', ok: !code.length || wiki.length > 0 || !!waiver,
    details: code.length && !wiki.length && !waiver
      ? [`code changed (${code.slice(0, 5).join(', ')}${code.length > 5 ? ', …' : ''}) with no ${WIKI}/ page changed. `
        + 'Update the entity page, or add the trailer `Wiki-Update: none (<reason>)` to a commit when behavior did not change.']
      : waiver && code.length && !wiki.length ? [`waived: ${waiver[1]}`] : [] });

  const rules = Array.isArray(config.architecture?.rules) ? config.architecture.rules : [];
  const touched = changed.filter(path => under(path, rules));
  // A review report is not an ADR, even where an older project saved one under
  // decisions/ — it must not satisfy the gate for an architecture change.
  const adr = changed.some(path => path.startsWith(`${WIKI}/decisions/`) && !path.endsWith('README.md')
    && !basename(path).startsWith('review-'));
  checks.push({ id: 'range.architecture', ok: !touched.length || adr,
    details: touched.length && !adr
      ? [`architecture rules changed (${touched.join(', ')}) with no ADR in ${WIKI}/decisions/ — loosening a layer is a human decision on the record`]
      : [] });
  return checks;
}

function warnings(root, config) {
  const notes = [];
  const architecture = resolve(root, WIKI, 'architecture.md');
  if (existsSync(architecture)) {
    const section = /^## Layers\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(readFileSync(architecture, 'utf8').replace(/\r\n/g, '\n'));
    const declared = section && /\|\s*[a-z]/i.test(section[1]) && !/<TBD>/.test(section[1]);
    if (declared && !config.architecture?.command) {
      notes.push('docs/wiki/architecture.md declares ## Layers, but there is no architecture check configured '
        + '(.agents/config.json architecture.command) — the layers are enforced by review alone.');
    }
  }
  return notes;
}

export function verify(root, { base = null } = {}) {
  const config = readJsonLoose(resolve(root, '.agents/config.json'));
  const checks = [];
  if (existsSync(resolve(root, '.agents'))) {
    const generated = checkGenerated(root);
    checks.push({ id: 'generated', ok: generated.ok,
      details: generated.ok ? [] : [`regenerate: ${generated.drifted.join(', ')} differ from .agents/`] });
  }
  checks.push(checkWikilinks(root), checkLog(root), checkEncoding(root));
  if (base) checks.push(...checkRange(root, base, config));
  return { ok: checks.every(check => check.ok), checks, warnings: warnings(root, config) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'verify.mjs')) {
  const args = process.argv.slice(2);
  const at = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
  try {
    if (args.includes('--sort-log')) {
      console.log(`Sorted ${sortLog(resolve(at('--root') ?? process.cwd()))} log entries by timestamp.`);
      process.exit(0);
    }
    const result = verify(resolve(at('--root') ?? process.cwd()), { base: at('--base') });
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const check of result.checks) {
        console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.id}`);
        for (const detail of check.details) console.log(`     ${detail}`);
      }
      for (const warning of result.warnings) console.log(`warn ${warning}`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
