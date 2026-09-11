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
import { existsSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, resolve } from 'node:path';

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
