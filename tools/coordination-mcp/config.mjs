import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { engines as adapters, engineNames } from './engines/index.mjs';

export { engineNames };

// No worker on any engine commits its own work. The supervising runner — an
// ordinary host process, outside every CLI sandbox — stages the worker's owned
// paths and commits them after a successful exit. That is a single convention
// rather than a per-CLI capability, because two of the three engines cannot
// commit at all (docs/harnesses.md §12) and a delivery shape that differs by
// engine would make every downstream step engine-aware.

// One definition of a repository-relative path, used for both owned paths and
// shared build state. No absolute paths, no traversal, no Windows separators or
// glob characters, and never anything under .git.
// Whether this engine's workers actually load the project's AGENTS.md. Where they
// do not — because we suppressed it, or because the CLI never reads it — the
// manager supplies the worker-scoped subset itself. Engines that do read it must
// not also receive it, or the saving becomes a duplication. Each value is
// measured, not assumed; see docs/harnesses.md §2.
export const readsProjectDocs = engine => adapters[engine]?.readsProjectDocs !== false;

export const isSafeRepoPath = path => typeof path === 'string' && !!path
  && !/[\\:\0\r\n*?\[\]]/.test(path) && !path.startsWith('/')
  && !path.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))
  && path.toLowerCase() !== '.git' && !path.toLowerCase().startsWith('.git/');

export function loadSettings(root) {
  const settings = JSON.parse(readFileSync(resolve(root,'.harness/settings.json'),'utf8'));
  // Build state a worker needs but Git does not carry: node_modules, .venv, a
  // build cache. A fresh worktree has none of it, so without this a dispatched
  // developer cannot run the project's tests at all — see docs/harnesses.md §7.
  if (!Array.isArray(settings.sharedPaths) || !settings.sharedPaths.every(isSafeRepoPath)) {
    throw new Error('sharedPaths must be an array of repository-relative paths');
  }
  // Task metadata outlives its worktree on purpose — read_worker_log still serves
  // a merged task's report — but "forever" is not a retention policy.
  if (!Number.isInteger(settings.taskRetention) || settings.taskRetention < 1 || settings.taskRetention > 1000) {
    throw new Error('taskRetention must be an integer between 1 and 1000');
  }
  if (settings.version !== 1 || !['inherit',...engineNames].includes(settings.defaultEngine)
    || !Number.isInteger(settings.maxWorkers) || settings.maxWorkers < 1 || settings.maxWorkers > 16
    || !Number.isInteger(settings.workerTimeoutSeconds) || settings.workerTimeoutSeconds < 1
    || settings.workerTimeoutSeconds > 86400 || !Array.isArray(settings.validation)
    || !settings.roles || Array.isArray(settings.roles)) throw new Error('Invalid coordination settings');
  // Every registered adapter needs a settings block, and every settings block
  // needs an adapter: a name in one and not the other is a silent misconfiguration.
  for (const name of engineNames) {
    const engine = settings.engines?.[name];
    if (!engine || typeof engine.executable !== 'string' || !engine.executable.trim()
      || /[\r\n\0]/.test(engine.executable) || /\.(cmd|bat)$/i.test(engine.executable)) {
      throw new Error(`Invalid engine executable: ${name}; use a native executable, not a shell shim`);
    }
    for (const profile of ['reasoning','balanced','fast']) {
      if (!(profile in engine.models) || !(profile in engine.effort)) throw new Error(`Missing profile: ${name}/${profile}`);
    }
  }
  for (const name of Object.keys(settings.engines ?? {})) {
    if (!engineNames.includes(name)) throw new Error(`Settings configure unregistered engine "${name}"; add tools/coordination-mcp/engines/${name}.mjs`);
  }
  // Role overrides are the knob humans actually turn, so a typo here must fail
  // loudly. Silently ignoring "model" for "models" would leave a worker running
  // the default model while its configuration claims otherwise.
  for (const [name, role] of Object.entries(settings.roles)) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) throw new Error(`Invalid role config: ${name}`);
    for (const key of Object.keys(role)) {
      if (!['engine','models','effort'].includes(key)) {
        throw new Error(`Unknown key "${key}" in role ${name}; expected engine, models, or effort`);
      }
    }
    if (role.engine != null && !['inherit',...engineNames].includes(role.engine)) {
      throw new Error(`Invalid engine for role ${name}: ${role.engine}`);
    }
    for (const field of ['models','effort']) {
      if (role[field] == null) continue;
      if (typeof role[field] !== 'object' || Array.isArray(role[field])) throw new Error(`Role ${name}.${field} must be an object keyed by engine`);
      for (const key of Object.keys(role[field])) {
        if (!engineNames.includes(key)) throw new Error(`Unknown engine "${key}" in role ${name}.${field}`);
      }
    }
  }
  for (const command of settings.validation) {
    if (!Array.isArray(command) || !command.length || command.some(x=>typeof x !== 'string' || /[\0\r\n]/.test(x))) {
      throw new Error('Validation commands must be nonempty argv arrays');
    }
  }
  return settings;
}

export function workerCommand(settings, task) {
  const { engine,role,profile,access,workspace,model_override,thinking_budget } = task;
  const config = settings.engines[engine];
  const adapter = adapters[engine];
  if (!adapter || !config) throw new Error(`Unknown engine: ${engine}`);
  const roleConfig = settings.roles[role] ?? {};
  const model = model_override ?? roleConfig.models?.[engine] ?? config.models[profile];
  const effort = thinking_budget ?? roleConfig.effort?.[engine] ?? config.effort[profile];
  if (effort != null && !adapter.efforts.includes(effort)) throw new Error(`Unsupported ${engine} effort: ${effort}`);
  if (model != null && (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(model))) throw new Error('Invalid model');
  const readOnly = access === 'read-only';
  const args = adapter.buildArgs({config,settings,role,profile,access,readOnly,workspace,model,effort});
  // The adapter is the only engine-specific code, so the contract it must honour
  // is checked here rather than trusted: no permission bypass reaches a worker.
  if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string' || /[\0\r\n]/.test(arg))) {
    throw new Error(`Engine ${engine} produced an invalid argv`);
  }
  if (args.some(arg => /dangerously|bypassPermissions|--yolo/i.test(arg))) {
    throw new Error(`Engine ${engine} attempted a permission bypass`);
  }
  // How the runner must deliver prompt.txt on stdin. Engines that read a plain
  // prompt use 'text'; agy needs one NDJSON envelope per message.
  const promptFormat = adapter.promptFormat ?? 'text';
  if (!['text','stream-json'].includes(promptFormat)) throw new Error(`Engine ${engine} declared an unknown promptFormat`);
  return {executable:config.executable,args,model:model??'inherit',effort:effort??'inherit',promptFormat};
}
