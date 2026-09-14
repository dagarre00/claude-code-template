// What a codex worker read, recovered from its transcript.
//
// Measured 2026-09-14 (codex 0.154.0): `--sandbox read-only` bounds writes and
// network, not reads — a read-only worker read a file in the parent checkout and
// one outside the repository and reported both. Codex has no file tools apart
// from its shell, so every read is a command, and `codex exec` records each as
//
//   exec
//   "<shell>" -Command '<command>' in <cwd>      (Windows, PowerShell)
//   /bin/bash -lc '<command>' in <cwd>           (POSIX)
//
// A read is reported, never failed — the same stance as agy's audit: a granted
// shared path is legitimate, and the conductor judges whether a reviewer that
// read outside is still independent. This is a heuristic over command text, so
// it can miss a path assembled at run time; it does not invent one.
import { posix } from 'node:path';

const SKILL_PATH = /\.agents[\\/]+skills[\\/]+([A-Za-z0-9._-]+)[\\/]/g;

const norm = path => {
  const slashed = path.replace(/\\+/g, '/');
  const drive = /^[a-zA-Z]:\//.test(slashed);
  const normalized = posix.normalize(drive ? slashed.slice(2) : slashed).replace(/\/+$/, '');
  return (drive ? slashed.slice(0, 2) + normalized : normalized).toLowerCase();
};

// The shell executable leads the line and is always an absolute path; the rest
// is the command the model wrote.
function splitLine(line) {
  const at = line.lastIndexOf(' in ');
  if (at === -1) return null;
  const invocation = line.slice(0, at);
  const cwd = line.slice(at + 4).trim();
  const command = invocation.startsWith('"')
    ? invocation.slice(invocation.indexOf('"', 1) + 1)
    : invocation.slice(invocation.search(/\s|$/));
  return { cwd, command: command.trim() };
}

const TOKEN_END = String.raw`[^\s'"\x60;|&<>,()]*`;
const WINDOWS_ABSOLUTE = new RegExp(String.raw`[a-zA-Z]:[\\/]+${TOKEN_END}`, 'g');
const POSIX_ABSOLUTE = new RegExp(String.raw`(?:^|[\s'"=])(\/[A-Za-z0-9._~-]${TOKEN_END})`, 'g');
const PARENT_RELATIVE = new RegExp(String.raw`(?:^|[\s'"=])((?:\.\.[\\/]+)+${TOKEN_END})`, 'g');

export function auditCodexTranscript(text, { workspace }) {
  const root = norm(workspace);
  const inside = path => path === root || path.startsWith(`${root}/`);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const reads = [];
  const skills = [];
  let commands = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() !== 'exec') continue;
    const parsed = splitLine(lines[i + 1]);
    if (!parsed) continue;
    commands += 1;
    const { cwd, command } = parsed;
    const base = norm(cwd);
    const outside = [];
    if (!inside(base)) outside.push(`cwd ${cwd}`);
    for (const match of command.matchAll(WINDOWS_ABSOLUTE)) if (!inside(norm(match[0]))) outside.push(match[0]);
    for (const match of command.matchAll(POSIX_ABSOLUTE)) if (!inside(norm(match[1]))) outside.push(match[1]);
    for (const match of command.matchAll(PARENT_RELATIVE)) {
      if (!inside(norm(`${cwd.replace(/\\+/g, '/')}/${match[1]}`))) outside.push(match[1]);
    }
    if (outside.length) reads.push(`${command.slice(0, 200)} (${[...new Set(outside)].join(', ')})`);
    for (const match of command.matchAll(SKILL_PATH)) skills.push(match[1]);
  }
  return {
    workspace,
    commands,
    reads_outside_workspace: [...new Set(reads)],
    skill_reads: [...new Set(skills)].sort()
  };
}
