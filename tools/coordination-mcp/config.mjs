import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadSettings(root) {
  const settings = JSON.parse(readFileSync(resolve(root,'.harness/settings.json'),'utf8'));
  if (settings.version !== 1 || !['inherit','claude','codex','antigravity'].includes(settings.defaultEngine)
    || !Number.isInteger(settings.maxWorkers) || settings.maxWorkers < 1 || settings.maxWorkers > 16
    || !Number.isInteger(settings.workerTimeoutSeconds) || settings.workerTimeoutSeconds < 1
    || settings.workerTimeoutSeconds > 86400 || !Array.isArray(settings.validation)
    || !settings.roles || Array.isArray(settings.roles)) throw new Error('Invalid coordination settings');
  for (const name of ['claude','codex','antigravity']) {
    const engine = settings.engines?.[name];
    if (!engine || typeof engine.executable !== 'string' || !engine.executable.trim()
      || /[\r\n\0]/.test(engine.executable) || /\.(cmd|bat)$/i.test(engine.executable)) {
      throw new Error(`Invalid engine executable: ${name}; use a native executable, not a shell shim`);
    }
    for (const profile of ['reasoning','balanced','fast']) {
      if (!(profile in engine.models) || !(profile in engine.effort)) throw new Error(`Missing profile: ${name}/${profile}`);
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
  if (!['claude','codex','antigravity'].includes(engine) || !config) throw new Error(`Unknown engine: ${engine}`);
  const roleConfig = settings.roles[role] ?? {};
  const model = model_override ?? roleConfig.models?.[engine] ?? config.models[profile];
  const effort = thinking_budget ?? roleConfig.effort?.[engine] ?? config.effort[profile];
  const efforts = {claude:['low','medium','high','xhigh','max'],codex:['minimal','low','medium','high','xhigh'],antigravity:['low','medium','high']};
  if (effort != null && !efforts[engine].includes(effort)) throw new Error(`Unsupported ${engine} effort: ${effort}`);
  if (model != null && (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(model))) throw new Error('Invalid model');
  const readOnly = access === 'read-only';
  let args;
  if (engine === 'claude') {
    const mode = config.writePermissionMode;
    if (!['acceptEdits','default','dontAsk'].includes(mode)) throw new Error('Unsafe/unsupported Claude permission mode');
    args = ['--print','--agent',role,'--no-session-persistence','--strict-mcp-config',
      '--permission-mode',readOnly?'plan':mode,'--permission-prompts','none',
      '--disallowedTools','Agent,Task'];
  } else if (engine === 'codex') {
    args = ['exec','--ephemeral','--color','never','--cd',workspace,
      '--sandbox',readOnly?'read-only':'workspace-write','-c','approval_policy="never"',
      '-c','agents.enabled=false','-c','mcp_servers.coordination.enabled=false'];
  } else {
    args = ['--add-dir',workspace,'--agent',role,'--sandbox','--mode',readOnly?'plan':'accept-edits',
      '--print-timeout',`${settings.workerTimeoutSeconds}s`,'--print'];
  }
  if (model && model !== 'inherit') args.push('--model',model);
  if (effort) args.push(...(engine === 'codex'?['-c',`model_reasoning_effort=${JSON.stringify(effort)}`]:['--effort',effort]));
  if (engine === 'codex') args.push('-');
  return {executable:config.executable,args,model:model??'inherit',effort:effort??'inherit'};
}
