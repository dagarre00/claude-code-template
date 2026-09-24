#!/usr/bin/env node
// Pulls the report and the usage out of a claude worker's `--output-format json`
// output. Plain `--print` printed the final message and nothing else, so
// dispatch_stats had no token count for the engine most roles fall back to.
// The JSON result carries both, measured 2026-09-24 on Claude Code: one line,
// `{"type":"result", "subtype", "is_error", "result", "usage": {input_tokens,
// cache_creation_input_tokens, cache_read_input_tokens, output_tokens, …},
// "total_cost_usd", "num_turns", "permission_denials": [], …}`.
//
//   report_file  the `result` text — the worker's final message, as before;
//   usage.json   tokens, cost, turns and permission denials, beside raw_file,
//                where inspect_dispatch reads them.
//
// Exits non-zero for a run with no result object (killed, timed out), an error
// result, or an empty report. A permission denial does not end a claude run —
// the model is told and carries on — so it is recorded, not failed on.
//
// Usage: node extract-claude-result.mjs <rawFile> <reportFile>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [, , rawFile, reportFile] = process.argv;
if (!rawFile || !reportFile) throw new Error('Usage: extract-claude-result.mjs <rawFile> <reportFile>');

let text = '';
try { text = readFileSync(rawFile, 'utf8'); } catch { /* nothing captured — reported below */ }

// stderr shares raw_file, so the result is the last line that parses as one.
let result = null;
for (const line of text.split('\n')) {
  if (!line.trim().startsWith('{')) continue;
  try {
    const parsed = JSON.parse(line);
    if (parsed?.type === 'result') result = parsed;
  } catch { /* a log line, or one cut off mid-write */ }
}

if (!result) {
  writeFileSync(reportFile, `No result object found in ${rawFile} — the process may have been killed, stopped at its `
    + 'time limit, or failed before it started. Read the raw file.\n');
  process.exit(1);
}

const usage = result.usage ?? {};
const count = key => (Number.isFinite(usage[key]) ? usage[key] : 0);
writeFileSync(resolve(dirname(rawFile), 'usage.json'), JSON.stringify({
  total_tokens: count('input_tokens') + count('cache_creation_input_tokens') + count('cache_read_input_tokens')
    + count('output_tokens'),
  input_tokens: count('input_tokens'),
  cache_creation_input_tokens: count('cache_creation_input_tokens'),
  cache_read_input_tokens: count('cache_read_input_tokens'),
  output_tokens: count('output_tokens'),
  total_cost_usd: Number.isFinite(result.total_cost_usd) ? result.total_cost_usd : null,
  num_turns: result.num_turns ?? null,
  subtype: result.subtype ?? null,
  is_error: result.is_error === true,
  permission_denials: Array.isArray(result.permission_denials) ? result.permission_denials : []
}, null, 2) + '\n');

const report = typeof result.result === 'string' ? result.result : '';
writeFileSync(reportFile, report.endsWith('\n') || !report ? report : `${report}\n`);
process.exit(result.is_error === true || !report.trim() ? 1 : 0);
