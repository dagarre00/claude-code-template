#!/usr/bin/env node
// Pulls the report out of an antigravity (agy) stream-json transcript, and
// doubles as the only mechanical failure signal agy's own exit code cannot
// give. The underlying process exits 0 with status: SUCCESS in every one of
// these cases, so this script exits non-zero for each and run-worker.mjs folds
// that into the run's own exit code:
//
//   - no "result" event at all (killed, timed out);
//   - a denied action headless mode could not prompt for;
//   - an empty response with no denial — measured 2026-09-13: a tool call came
//     back "missing properties 'toolSummary', 'toolAction'" and the run simply
//     ended, SUCCESS, nothing written, nothing said;
//   - a write outside the workspace, or a subagent tool call (see the audit).
//
// agy's --output-format stream-json prints one NDJSON event per line. The
// terminal "result" event carries response, status and denied_actions; the
// step_update events before it carry every tool call, which is what the target
// recovery and the audit read. A real file rather than an inline shell one-liner
// because a JSON string can contain characters no shell-quoting scheme handles
// safely, and because the parsing needs real control flow.
//
// Usage: node extract-agy-result.mjs <rawFile> <reportFile>
// Reads dispatch.json from rawFile's directory when present (prepareDispatch
// writes it there) for the workspace and allowlist the audit measures against.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [, , rawFile, reportFile] = process.argv;
if (!rawFile || !reportFile) {
  throw new Error('Usage: extract-agy-result.mjs <rawFile> <reportFile>');
}

let lines = [];
try { lines = readFileSync(rawFile, 'utf8').split('\n'); }
catch { /* nothing captured — write the "no result" report below */ }

const events = [];
let result = null;
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const event = JSON.parse(line);
    events.push(event);
    // Keep the LAST one: earlier lines can be partial, and a re-tried run can
    // emit more than one.
    if (event.event === 'result') result = event.result;
  } catch { /* not JSON — a log line, or a line truncated mid-write; skip it */ }
}

if (!result) {
  writeFileSync(reportFile, `No "result" event found in ${rawFile} — the process may have been killed, denied `
    + 'before producing one, or exceeded --print-timeout. Read the raw file.\n');
  process.exit(1);
}

// Tool names are compared with case and separators stripped: a denial says
// `GrepSearch` for the call the transcript records as `grep_search`.
const canon = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

// Every tool call, in order, at its final state. Measured shape (agy 1.2.2):
// step_update.{step_index, state, step_type: "tool", tool_name, tool_info.parameters}.
// An ACTIVE update is superseded by the DONE/ERROR one for the same step.
const steps = new Map();
for (const event of events) {
  const step = event.step_update;
  if (!step || step.step_type !== 'tool' || !step.tool_name) continue;
  if (!steps.has(step.step_index) || step.state !== 'ACTIVE') steps.set(step.step_index, step);
}
const calls = [...steps.values()].sort((a, b) => a.step_index - b.step_index)
  .map(step => ({ tool: step.tool_name, state: step.state, parameters: step.tool_info?.parameters ?? {} }));

// Parameters that name what a call acted on. Keys are compared canonically, so
// `AbsolutePath`, `absolute_path` and `absolutePath` are one key.
const TARGET_KEYS = new Set(['path', 'filepath', 'absolutepath', 'searchpath', 'searchdirectory', 'directorypath',
  'targetfile', 'file', 'directory', 'dir', 'uri', 'url', 'target', 'targetpath', 'command', 'cmd', 'commandline']);
const MAX_TARGETS = 10;
const MAX_TARGET_LENGTH = 300;
const targetsOf = call => Object.entries(call.parameters)
  .filter(([key, value]) => TARGET_KEYS.has(canon(key)) && typeof value === 'string' && value.trim())
  .map(([, value]) => value.trim().slice(0, MAX_TARGET_LENGTH));

const denied = Array.isArray(result.denied_actions) ? result.denied_actions : [];

// A denial names the action and not the target, so the grant cannot be fixed
// from the report alone. The refused call is in the transcript: the denial ends
// the run, so the most recent call to that tool is the one that was refused, and
// it is listed first. The action names the permission (`read_file`), the
// display name the tool (`GrepSearch`); either may be what matches.
//
// The measured shape is read first. If it yields nothing, a shape-agnostic walk
// runs over every event: the only specification for these events is whatever agy
// emits this week, and a renamed field should degrade to a slower match rather
// than to "no target".
const NAME_KEYS = ['action', 'tool', 'toolname', 'name', 'displayname'];
const NESTED_KEYS = new Set(['args', 'arguments', 'params', 'parameters', 'input', 'toolinfo']);
function walkTargets(wanted) {
  const found = [];
  const collect = node => {
    for (const [key, value] of Object.entries(node)) {
      if (TARGET_KEYS.has(canon(key)) && typeof value === 'string' && value.trim()) {
        found.push(value.trim().slice(0, MAX_TARGET_LENGTH));
      } else if (NESTED_KEYS.has(canon(key)) && value && typeof value === 'object' && !Array.isArray(value)) {
        collect(value);
      }
    }
  };
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    const names = Object.entries(node).filter(([key, value]) => NAME_KEYS.includes(canon(key)) && typeof value === 'string');
    if (names.some(([, value]) => wanted.includes(canon(value)))) collect(node);
    Object.values(node).forEach(visit);
  };
  // The result event only restates the denial.
  events.filter(event => event.event !== 'result').forEach(visit);
  return found;
}

const deniedTargets = denied.map(action => {
  const wanted = [action?.action, action?.display_name].filter(Boolean).map(canon);
  let found = calls.filter(call => wanted.includes(canon(call.tool))).reverse().flatMap(targetsOf);
  if (!found.length) found = walkTargets(wanted);
  return { action: action?.action ?? null, display_name: action?.display_name ?? null,
    observed_targets: [...new Set(found)].slice(0, MAX_TARGETS) };
});

// The audit. Reads outside the worktree cannot be prevented on agy — measured
// with and without allowNonWorkspaceAccess: false — and 5 of 22 real dispatches
// did it, including reading the conductor's own files. So every run says what it
// touched outside its workspace. A read is reported, never failed: a shared
// virtualenv granted with read_file(...) is a legitimate one. A write outside the
// workspace or a subagent call is a contract breach and fails the run.
const WRITE_TOOLS = new Set(['writetofile', 'replacefilecontent', 'multireplacefilecontent', 'sedfile', 'notebookedit']);
const SUBAGENT_TOOLS = new Set(['definesubagent', 'invokesubagent', 'managesubagents', 'browsersubagent']);
const PATH_KEYS = new Set(['path', 'filepath', 'absolutepath', 'searchpath', 'searchdirectory', 'directorypath',
  'targetfile', 'file', 'directory', 'dir', 'cwd']);
const dispatchFile = resolve(dirname(rawFile), 'dispatch.json');
let audit = null;
if (existsSync(dispatchFile)) {
  let record = null;
  try { record = JSON.parse(readFileSync(dispatchFile, 'utf8')); } catch { /* unreadable — no audit */ }
  if (record?.workspace) {
    const norm = path => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
    const workspace = norm(record.workspace);
    const inside = path => norm(path) === workspace || norm(path).startsWith(`${workspace}/`);
    // read_url_content saves the page under agy's own brain directory for this
    // conversation and hands the worker that path (measured 2026-09-24, agy
    // 1.2.9). Reading it is reading the tool's output, not the author's material
    // or another checkout, so it is listed apart and never warned about.
    const conversation = String(result.conversation_id
      ?? events.find(event => event.conversation_id)?.conversation_id ?? '').toLowerCase();
    const toolOutput = path => !!conversation && norm(path).includes(`/antigravity-cli/brain/${conversation}/`);
    const absolute = path => /^([a-zA-Z]:[\\/]|[\\/])/.test(path);
    const allowed = Array.isArray(record.worker_commands) ? new Set(record.worker_commands) : null;

    // Every worktree holds every committed skill, sent or not. Which ones a worker
    // opened — by a file tool or a command, anywhere — is what shows whether a
    // reviewer read the author's procedures instead of reading independently.
    const SKILL_PATH = /\.agents[\\/]+skills[\\/]+([A-Za-z0-9._-]+)[\\/]/g;
    const reads = [], writes = [], subagents = [], commands = [], skills = [], outputs = [];
    for (const call of calls) {
      const tool = canon(call.tool);
      if (!WRITE_TOOLS.has(tool)) {
        for (const value of Object.values(call.parameters)) {
          if (typeof value === 'string') for (const match of value.matchAll(SKILL_PATH)) skills.push(match[1]);
        }
      }
      if (SUBAGENT_TOOLS.has(tool)) subagents.push(call.tool);
      if (tool === 'runcommand' && allowed && typeof call.parameters.CommandLine === 'string'
        && !allowed.has(call.parameters.CommandLine)) commands.push(call.parameters.CommandLine);
      for (const [key, value] of Object.entries(call.parameters)) {
        if (!PATH_KEYS.has(canon(key)) || typeof value !== 'string' || !absolute(value) || inside(value)) continue;
        if (!WRITE_TOOLS.has(tool) && toolOutput(value)) { outputs.push(`${call.tool} ${value}`); continue; }
        (WRITE_TOOLS.has(tool) ? writes : reads).push(`${call.tool} ${value}`);
      }
    }
    const unique = list => [...new Set(list)];
    audit = {
      workspace: record.workspace,
      clean: !reads.length && !writes.length && !subagents.length && !commands.length,
      reads_outside_workspace: unique(reads),
      writes_outside_workspace: unique(writes),
      subagent_calls: unique(subagents),
      commands_not_allowlisted: unique(commands),
      skill_reads: unique(skills).sort(),
      tool_output_reads: unique(outputs)
    };
  }
}

const empty = !denied.length && !String(result.response ?? '').trim();
const breach = !!(audit && (audit.writes_outside_workspace.length || audit.subagent_calls.length));

const report = { ...result };
// Namespaced, and never merged into the engine's own fields: a conductor must be
// able to tell what agy reported from what this script inferred.
if (denied.length) {
  report.workflow_mcp_extraction = {
    raw_file: rawFile,
    denied_action_targets: deniedTargets,
    note: deniedTargets.some(entry => entry.observed_targets.length)
      ? 'observed_targets are inferred from tool calls in the raw transcript, most recent first — not reported by '
        + 'the engine. The first one is the call that was refused. Grant that exact target (or switch engines) and re-dispatch.'
      : `No target could be recovered from the transcript for this denial. Read ${rawFile} directly — `
        + 'the tool call may use an event shape this extraction does not recognise.'
  };
} else if (empty) {
  // Measured twice: the last tool call came back "invalid arguments: ..." — agy
  // rejected the model's own malformed call — and the run simply ended. The brief
  // was not the problem, so this is marked transient: one unchanged retry is the
  // right answer, where rewriting the brief would be chasing nothing.
  const lastCall = [...steps.values()].sort((a, b) => a.step_index - b.step_index).at(-1);
  const lastOutput = String(lastCall?.tool_info?.output ?? lastCall?.tool_info?.error?.message ?? '');
  const transient = /^\s*invalid (arguments|tool call)/i.test(lastOutput) || lastCall?.state === 'ERROR';
  report.workflow_mcp_extraction = {
    raw_file: rawFile,
    transient,
    ...(lastCall ? { last_tool_call: { tool: lastCall.tool_name, state: lastCall.state, output: lastOutput.slice(0, MAX_TARGET_LENGTH) } } : {}),
    note: transient
      ? 'The run ended SUCCESS with an empty response right after the engine rejected its own malformed tool call '
        + '(last_tool_call). That is an engine fault, not a problem with the brief: retry once unchanged.'
      : 'The run ended SUCCESS with an empty response and no denied action — there is no report to accept. '
        + `Read the last tool calls in ${rawFile} for why.`
  };
}
if (audit) report.workflow_mcp_audit = audit;

writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
process.exit(denied.length || empty || breach ? 1 : 0);
