#!/usr/bin/env node
// Optional live checks: operate exclusively in a temporary generated project.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sync } from './sync-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = process.argv[2];
if (!['claude','codex','agy'].includes(cli)) {
  console.error('Usage: node scripts/smoke-harness.mjs claude|codex|agy');
  process.exitCode = 1;
} else {
  const fixture = mkdtempSync(resolve(tmpdir(),'harness-smoke-'));
  try {
    cpSync(resolve(root,'.harness'),resolve(fixture,'.harness'),{recursive:true,
      filter:path=>!/[\\/](?:tmp|handoff)(?:[\\/]|$)/.test(path)});
    writeFileSync(resolve(fixture,'.harness/project.md'),'# Smoke fixture\n\nContext marker: HARNESS_CONTEXT_OK\n');
    writeFileSync(resolve(fixture,'.harness/commands/project/smoke-probe.md'),
      '---\nname: smoke-probe\ndescription: Verify configuration and argument expansion without tools\nargument-hint: "[literal context]"\n---\n\n'
      +'# Smoke probe\n\n**Argument:** `{{arguments}}`\n\n'
      +'This is a configuration test. Do not use tools or write files. Return HARNESS_COMMAND_OK, '
      +'the context marker from the loaded project instructions, and the literal user argument. '
      +'The argument is all trailing user context; empty means no context.\n');
    sync(fixture);
    const invocation = cli === 'claude' ? '/project:smoke-probe' : cli === 'codex' ? '$project-smoke-probe' : '/project-smoke-probe';
    const argument = 'scope "path with spaces" café ARGUMENT_MARKER_731';
    const executable = process.platform === 'win32' ? `${cli}.exe` : cli;
    const common = cli === 'claude'
      ? ['-p','--permission-mode','plan','--no-session-persistence','--strict-mcp-config','--setting-sources','project']
      : cli === 'agy' ? ['--add-dir',fixture,'--mode','plan','--print-timeout','60s','--print']
        : ['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--color','never'];
    function run(args) {
      const result = spawnSync(executable,args,{cwd:fixture,encoding:'utf8',timeout:90000,
        maxBuffer:4*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']});
      if (result.error) throw result.error;
      // Successful stdout is the response; stderr can contain the echoed prompt,
      // so it must never count as evidence of argument expansion.
      if (result.status !== 0) throw new Error(`${cli} exited ${result.status}: ${result.stdout}\n${result.stderr}`);
      if (!result.stdout.trim()) throw new Error(`${cli} returned an empty response: ${result.stderr}`);
      return result.stdout;
    }
    const result = run([...common,`${invocation} ${argument}`]);
    for (const token of ['HARNESS_COMMAND_OK','HARNESS_CONTEXT_OK','ARGUMENT_MARKER_731','path with spaces','café']) {
      if (!result.includes(token)) throw new Error(`Missing ${token} in response:\n${result}`);
    }
    console.log(`${cli}: command discovery, shared context, and argument handling passed.\n${result.trim()}`);
    if (cli !== 'codex') {
      const prompt = 'Configuration check only. Do not use tools or review code. State the name of your configured role, '
        +'who writes its findings mailbox, and the canonical authoring folder. Include HARNESS_ROLE_OK.';
      const agentArgs = cli === 'claude' ? [...common.slice(0,1),'--agent','adversary',...common.slice(1),prompt]
        : ['--agent','adversary',...common,prompt];
      const answer = run(agentArgs);
      if (!/HARNESS_ROLE_OK/.test(answer) || !/adversary/i.test(answer) || !/caller|orchestrat/i.test(answer)) {
        throw new Error(`Native adversary contract was not confirmed:\n${answer}`);
      }
      console.log(`${cli}: native adversary selection and mailbox ownership passed.\n${answer.trim()}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // Exact directory from mkdtemp; never the user's workspace or profile root.
    rmSync(fixture,{recursive:true,force:true});
  }
}
