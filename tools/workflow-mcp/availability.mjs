// Is this engine's CLI actually on this machine?
//
// Four of seven roles resolved to one engine in a measured session, so when that
// engine became unusable all four went with it — and nothing said so until a
// 45 KB prompt had been composed and a dispatch had already run
// (dispatch-findings 2026-09-10, F-C). This answers the cheap half of that
// question before any of it happens.
//
// What it can and cannot see is worth being precise about: a missing executable
// is detectable, a usage limit is not. Nothing short of running the CLI reveals
// "try again at 9:05 PM", so this deliberately does not try — it reports what is
// installed, the chain reports what to fall back to, and a usage limit stays a
// failed dispatch the conductor answers with `cli_engine`.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, resolve } from 'node:path';

const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

// PATHEXT is how Windows decides that `codex` means `codex.exe`. Absent (every
// other OS), the name is tried as given.
const extensions = env => (env.PATHEXT ?? '').split(';').map(ext => ext.trim()).filter(Boolean);

export function findExecutable(name, env = process.env) {
  if (typeof name !== 'string' || !name.trim()) return null;
  // A path, not a name: nothing to look up, it either exists or it does not.
  if (name.includes('/') || name.includes('\\') || isAbsolute(name)) {
    const path = resolve(name);
    return isFile(path) ? path : null;
  }
  const candidates = [name, ...extensions(env).map(ext => name + ext)];
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)) {
    for (const candidate of candidates) {
      const path = resolve(dir.replace(/^"|"$/g, ''), candidate);
      if (existsSync(path) && isFile(path)) return path;
    }
  }
  return null;
}

export function engineAvailability(config, name) {
  const executable = config.engines?.[name]?.executable ?? null;
  const path = executable ? findExecutable(executable) : null;
  return { name, executable, available: path !== null, path };
}

const antigravitySettingsFile = () => resolve(homedir(), '.gemini', 'antigravity-cli', 'settings.json');

// Absent is the one read failure that means "nothing granted yet". Everything
// else — a BOM a Windows editor left, a trailing comma, a comment, EACCES, a
// top-level value that is not an object — is a file that exists and could not
// be understood, and the only safe answer about it is to say so: the additive
// merge in grantAntigravitySetup used to spread an empty object in its place
// and write that back over every grant the file held (adversary round 1 on
// fix/workflow-mcp-hardening, F2). Returns either the parsed object or a
// `problem` naming what is wrong, never both.
function readAntigravitySettings(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return { parsed: {}, problem: null };
    return { parsed: null, problem: `${path} exists but could not be read (${error.code ?? error.message}). Nothing was written.` };
  }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (error) {
    return { parsed: null, problem: `${path} could not be parsed as JSON (${error.message}) — a BOM or a trailing comma is the `
      + 'usual cause. Fix the file by hand before granting anything; nothing was written.' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { parsed: null, problem: `${path} does not hold a JSON object. Fix it by hand; nothing was written.` };
  }
  const { permissions } = parsed;
  if (permissions !== undefined && (permissions === null || typeof permissions !== 'object' || Array.isArray(permissions))) {
    return { parsed: null, problem: `${path}: permissions is not an object, so grants cannot be added without replacing it. Fix it by hand; nothing was written.` };
  }
  if (permissions?.allow !== undefined && !Array.isArray(permissions.allow)) {
    return { parsed: null, problem: `${path}: permissions.allow is not an array, so grants cannot be added without replacing it. Fix it by hand; nothing was written.` };
  }
  return { parsed, problem: null };
}

function missingAntigravityGrants(config, parsed) {
  const allow = parsed.permissions?.allow ?? [];
  const granted = new Set(allow.filter(rule => typeof rule === 'string'));
  return { allow, missing: (config.workerCommands ?? []).filter(command => !granted.has(`command(${command})`)) };
}

// The other computable half: an installed engine that will deny its worker's
// first command. agy reads permissions only from its user-global settings,
// matches `command(<line>)` exactly, and cannot prompt headless — the run ends
// at the first ungranted command, and two of three engines make that look like
// success (engine-setup.md). Only agy has such a requirement; the other engines
// return undefined, so `check` carries no block for them. A settings file that
// exists but cannot be read is its own problem, named as such and still not ok;
// `missing_command_grants` is then empty because nothing is known about it.
export function engineSetup(config, name) {
  if (name !== 'antigravity') return undefined;
  const settings_file = antigravitySettingsFile();
  const { parsed, problem } = readAntigravitySettings(settings_file);
  if (problem) return { settings_file, ok: false, missing_command_grants: [], problem };
  const { missing } = missingAntigravityGrants(config, parsed);
  return { settings_file, ok: missing.length === 0, missing_command_grants: missing, problem: null };
}

// What engine-setup.md otherwise walks a human through pasting by hand: the
// classifier that blocks a conductor's own edit tools from touching a file
// outside the repository (this is user-global, under $HOME, on every OS) does
// not gate this server process, so it can just do it. Strictly additive —
// existing entries, including whatever interactive grants the file already
// carries, are read back verbatim and never dropped or reordered; this only
// appends the `command(<line>)` rules `engineSetup` reports missing. A file it
// cannot read is refused outright rather than treated as empty, and the write
// lands beside the file and is renamed into place, so a crash mid-write cannot
// leave a truncated file that the next call could only refuse.
export function grantAntigravitySetup(config) {
  const settings_file = antigravitySettingsFile();
  const { parsed, problem } = readAntigravitySettings(settings_file);
  if (problem) throw new Error(problem);
  const { allow, missing } = missingAntigravityGrants(config, parsed);
  if (!missing.length) return { settings_file, added: [], already_granted: true };
  const added = missing.map(command => `command(${command})`);
  const next = { ...parsed, permissions: { ...parsed.permissions, allow: [...allow, ...added] } };
  mkdirSync(dirname(settings_file), { recursive: true });
  const staging = `${settings_file}.tmp-${process.pid}`;
  writeFileSync(staging, JSON.stringify(next, null, 2) + '\n');
  renameSync(staging, settings_file);
  return { settings_file, added, already_granted: false };
}
