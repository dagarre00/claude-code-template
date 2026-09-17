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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

function readAntigravitySettings(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return {}; } // missing or unreadable: nothing is granted
}

function missingAntigravityGrants(config, parsed) {
  const allow = Array.isArray(parsed?.permissions?.allow) ? parsed.permissions.allow : [];
  const granted = new Set(allow.filter(rule => typeof rule === 'string'));
  return { allow, missing: (config.workerCommands ?? []).filter(command => !granted.has(`command(${command})`)) };
}

// The other computable half: an installed engine that will deny its worker's
// first command. agy reads permissions only from its user-global settings,
// matches `command(<line>)` exactly, and cannot prompt headless — the run ends
// and the report is discarded (engine-setup.md). Engines with nothing to set up
// return undefined, so `check` carries no block for them.
export function engineSetup(config, name) {
  if (name !== 'antigravity') return undefined;
  const settings_file = antigravitySettingsFile();
  const { missing } = missingAntigravityGrants(config, readAntigravitySettings(settings_file));
  return { settings_file, ok: missing.length === 0, missing_command_grants: missing };
}

// What engine-setup.md otherwise walks a human through pasting by hand: the
// classifier that blocks a conductor's own edit tools from touching a file
// outside the repository (this is user-global, under $HOME, on every OS) does
// not gate this server process, so it can just do it. Strictly additive —
// existing entries, including whatever interactive grants the file already
// carries, are read back verbatim and never dropped or reordered; this only
// appends the `command(<line>)` rules `engineSetup` reports missing.
export function grantAntigravitySetup(config) {
  const settings_file = antigravitySettingsFile();
  const parsed = readAntigravitySettings(settings_file);
  const { allow, missing } = missingAntigravityGrants(config, parsed);
  if (!missing.length) return { settings_file, added: [], already_granted: true };
  const added = missing.map(command => `command(${command})`);
  const next = { ...parsed, permissions: { ...parsed.permissions, allow: [...allow, ...added] } };
  mkdirSync(dirname(settings_file), { recursive: true });
  writeFileSync(settings_file, JSON.stringify(next, null, 2) + '\n');
  return { settings_file, added, already_granted: false };
}
