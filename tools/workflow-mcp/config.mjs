// Loader and validator for `.agents/config.json` — engine executables, the
// model/effort each profile maps to, and per-role overrides.
//
// Validation is deliberately strict and noisy. These are the knobs a human
// actually turns, and a typo that is silently ignored ("model" for "models")
// leaves a worker running the default model while the file claims otherwise —
// a discrepancy nothing downstream can detect.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { engineNames } from './engines/index.mjs';
import { PROFILES } from './canonical.mjs';

const ROLE_KEYS = ['engine', 'models', 'effort'];

export function loadConfig(root) {
  const path = resolve(root, '.agents/config.json');
  if (!existsSync(path)) throw new Error('Missing .agents/config.json');
  let config;
  try { config = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`.agents/config.json is not valid JSON: ${error.message}`); }

  if (config.version !== 1) throw new Error('Unsupported config version; expected 1');
  if (!['inherit', ...engineNames].includes(config.defaultEngine)) {
    throw new Error(`Invalid defaultEngine "${config.defaultEngine}"; expected inherit or one of ${engineNames.join(', ')}`);
  }
  if (!Number.isInteger(config.workerTimeoutSeconds)
    || config.workerTimeoutSeconds < 1 || config.workerTimeoutSeconds > 86400) {
    throw new Error('workerTimeoutSeconds must be an integer between 1 and 86400');
  }
  // The exact shell commands a worker may run. Both gating engines match a
  // command line *exactly* — Claude Code against `Bash(<cmd>:*)`, agy against a
  // `command(<cmd>)` rule in its user-global settings — so this is a list of
  // literal command lines, not patterns, and a worker that chains or redirects
  // one is denied. Empty is legal and means "no worker may run anything", which
  // is a working configuration only for roles that never verify.
  if (!Array.isArray(config.workerCommands)) {
    throw new Error('workerCommands must be an array of exact shell command lines');
  }
  if (config.workerCommands.length > 32) {
    throw new Error('workerCommands is capped at 32 entries; a longer allowlist is not an allowlist');
  }
  for (const command of config.workerCommands) {
    if (typeof command !== 'string' || !command.trim() || command.length > 200
      || /[\r\n\0]/.test(command)) {
      throw new Error(`Invalid workerCommands entry: ${JSON.stringify(command)}`);
    }
    // A command line carrying its own separators cannot be matched exactly by
    // either engine, so it would be granted and then denied at run time.
    if (/[;&|<>`]|\$\(/.test(command)) {
      throw new Error(
        `workerCommands entry "${command}" contains shell composition; both engines grant `
        + 'permission by exact match, so a composed line can never be allowed. '
        + 'List the plain command instead.');
    }
  }
  if (!config.roles || typeof config.roles !== 'object' || Array.isArray(config.roles)) {
    throw new Error('roles must be an object keyed by role name');
  }

  // Every registered adapter needs a settings block, and every settings block
  // needs an adapter: a name in one and not the other is a silent misconfiguration.
  for (const name of engineNames) {
    const engine = config.engines?.[name];
    if (!engine || typeof engine.executable !== 'string' || !engine.executable.trim()
      || /[\r\n\0]/.test(engine.executable)) {
      throw new Error(`Invalid engine executable for ${name}`);
    }
    // A .cmd/.bat shim is executed through the Windows command interpreter,
    // which reintroduces shell quoting rules to an argv we deliberately keep
    // shell-free. Point at the real executable instead.
    if (/\.(cmd|bat)$/i.test(engine.executable)) {
      throw new Error(`Engine ${name} points at a shell shim (${engine.executable}); use a native executable`);
    }
    for (const profile of PROFILES) {
      if (!(profile in (engine.models ?? {})) || !(profile in (engine.effort ?? {}))) {
        throw new Error(`Engine ${name} is missing models/effort for profile "${profile}"`);
      }
    }
  }
  for (const name of Object.keys(config.engines ?? {})) {
    if (!engineNames.includes(name)) {
      throw new Error(`Config declares unregistered engine "${name}"; add tools/workflow-mcp/engines/${name}.mjs`);
    }
  }

  for (const [name, role] of Object.entries(config.roles)) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) throw new Error(`Invalid role config: ${name}`);
    for (const key of Object.keys(role)) {
      if (!ROLE_KEYS.includes(key)) {
        throw new Error(`Unknown key "${key}" in role ${name}; expected ${ROLE_KEYS.join(', ')}`);
      }
    }
    if (role.engine != null && !['inherit', ...engineNames].includes(role.engine)) {
      throw new Error(`Invalid engine for role ${name}: ${role.engine}`);
    }
    for (const field of ['models', 'effort']) {
      if (role[field] == null) continue;
      if (typeof role[field] !== 'object' || Array.isArray(role[field])) {
        throw new Error(`Role ${name}.${field} must be an object keyed by engine name`);
      }
      for (const key of Object.keys(role[field])) {
        if (!engineNames.includes(key)) throw new Error(`Unknown engine "${key}" in role ${name}.${field}`);
      }
    }
  }
  return config;
}

// Which engine a role actually runs on, given who is conducting. `inherit` means
// "whatever CLI the conductor is", so a Claude Code session dispatches Claude
// workers by default and a Codex session dispatches Codex workers.
export function resolveEngine(config, role, conductorEngine) {
  const configured = config.roles?.[role]?.engine ?? config.defaultEngine;
  const resolved = configured === 'inherit' ? conductorEngine : configured;
  if (!engineNames.includes(resolved)) {
    throw new Error(`Cannot resolve an engine for role "${role}": got ${JSON.stringify(resolved)}`);
  }
  return resolved;
}
