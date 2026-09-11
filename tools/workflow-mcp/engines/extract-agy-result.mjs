#!/usr/bin/env node
// Pulls the report out of an antigravity (agy) stream-json transcript, and
// doubles as the only mechanical failure signal agy's own exit code cannot
// give: a denied action headless mode could not prompt for, or no result at
// all, both leave the underlying process at exit 0 with status: SUCCESS and
// an empty response (see antigravity.mjs and engine-setup.md) — so this
// script exits non-zero in both cases and dispatch.mjs's buildRunnableCommand
// folds that into the wrapped command's own exit code. Without it, "the
// conductor reads a worker's report rather than its exit code" was a promise
// resting entirely on someone remembering to read the report.
//
// agy's --output-format stream-json prints one NDJSON event per line, and only
// the terminal "result" event carries what a conductor actually needs —
// response, status, denied_actions — everything before it is per-turn progress
// (init, step_update, tool calls) the routine "what did the worker report" path
// has no use for. A real file rather than an inline shell one-liner because a
// JSON string can contain characters (quotes, newlines) no shell-quoting
// scheme handles safely, and because "find the LAST valid result line, some
// earlier ones may be partial" needs real control flow.
//
// Usage: node extract-agy-result.mjs <rawFile> <reportFile>
import { readFileSync, writeFileSync } from 'node:fs';

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

const denied = Array.isArray(result.denied_actions) ? result.denied_actions : [];
if (!denied.length) {
  writeFileSync(reportFile, JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

// A denial names the action and not the target — measured, agy reported
// `{"action": "read_file", "display_name": "ViewFile"}` and nothing more, which
// says a read was refused but not WHICH path, so the grant cannot be fixed from
// the report. The remedies left to a conductor are to guess or to re-dispatch on
// another engine, and every agy denial then costs a full re-run. The target is
// usually right there in the transcript this script already parses: the tool
// call that was refused. So look for it.
//
// Deliberately shape-agnostic. The only specification for these events is
// whatever agy emits this week, so matching one spelling would be a silent
// regression the next time it changes. Instead: walk every event, find nodes
// that name the denied action under any of the keys a tool call plausibly uses,
// and collect the path-ish strings on that node.
const NAME_KEYS = ['action', 'tool', 'tool_name', 'toolName', 'name', 'display_name', 'displayName'];
const TARGET_KEYS = ['path', 'file_path', 'filePath', 'absolute_path', 'absolutePath', 'target',
  'target_path', 'uri', 'file', 'directory', 'dir', 'command', 'cmd', 'command_line'];
const NESTED_KEYS = ['args', 'arguments', 'params', 'parameters', 'input'];
const MAX_TARGETS = 10;
const MAX_TARGET_LENGTH = 300;

const names = action => NAME_KEYS
  .map(key => action?.[key]).filter(value => typeof value === 'string')
  .map(value => value.toLowerCase());

function targetsOn(node) {
  const found = [];
  for (const key of TARGET_KEYS) {
    if (typeof node[key] === 'string' && node[key].trim()) found.push(node[key].trim());
  }
  for (const key of NESTED_KEYS) {
    const nested = node[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) found.push(...targetsOn(nested));
  }
  return found;
}

function findTargets(wanted) {
  const found = [];
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    if (names(node).some(name => wanted.includes(name))) found.push(...targetsOn(node));
    for (const value of Object.values(node)) visit(value);
  };
  // The result event itself only restates the denial, so scanning it would
  // rediscover the action name and no target.
  events.filter(event => event.event !== 'result').forEach(visit);
  return [...new Set(found)].slice(0, MAX_TARGETS).map(value => value.slice(0, MAX_TARGET_LENGTH));
}

const targets = denied.map(action => ({
  action: action?.action ?? null,
  display_name: action?.display_name ?? null,
  observed_targets: findTargets(names(action))
}));

// Namespaced under one key, and never merged into `denied_actions` itself: a
// conductor reading this file must be able to tell what agy reported from what
// this script inferred. `observed_targets` is a best guess from the transcript,
// not a field the engine emitted.
writeFileSync(reportFile, JSON.stringify({
  ...result,
  workflow_mcp_extraction: {
    raw_file: rawFile,
    denied_action_targets: targets,
    note: targets.some(entry => entry.observed_targets.length)
      ? 'observed_targets are inferred from tool-call events in the raw transcript, not reported by the '
        + 'engine. Grant the exact target (or switch engines) and re-dispatch.'
      : `No target could be recovered from the transcript for this denial. Read ${rawFile} directly — `
        + 'the tool call may use an event shape this extraction does not recognise.'
  }
}, null, 2) + '\n');

process.exit(1);
