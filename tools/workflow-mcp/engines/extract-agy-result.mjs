#!/usr/bin/env node
// Pulls the report out of an antigravity (agy) stream-json transcript.
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

let result = null;
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const event = JSON.parse(line);
    if (event.event === 'result') { result = event.result; break; }
  } catch { /* not JSON — a log line, or a line truncated mid-write; keep scanning backward */ }
}

writeFileSync(reportFile, result
  ? JSON.stringify(result, null, 2) + '\n'
  : `No "result" event found in ${rawFile} — the process may have been killed, denied `
    + 'before producing one, or exceeded --print-timeout. Read the raw file.\n');
