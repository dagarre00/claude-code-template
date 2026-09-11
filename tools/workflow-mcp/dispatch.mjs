// Ties the pieces together into one dispatch: compose the prompt, resolve the
// engine, write the two files, and hand back a command the conductor can run.
//
// This tool does not spawn anything. That is the whole scope decision: the MCP
// is a prompt factory, and the conductor — which already has a shell — runs the
// process itself. It keeps the control plane small enough to reason about, and
// means a failed worker is debugged by re-running a command line a human can
// read, not by reading a supervisor's logs.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCanonical } from './canonical.mjs';
import { engineAvailability } from './availability.mjs';
import { loadConfig, resolveEngineChain } from './config.mjs';
import { composePrompt } from './compose.mjs';
import { computeDiff } from './diff.mjs';
import { ENGINES, buildCommand, stdinPayload } from './engines/index.mjs';

// Quote one argument for the shell the conductor will paste this into. Only ever
// used to build the human-readable/runnable `command` string; the `args` array
// is the authoritative form and never passes through a shell.
const quote = value => /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

// Resolved against this file's own location, not `root`: an extraction script
// is part of the workflow-mcp tool, always a sibling of dispatch.mjs, whether
// this is the template checkout or a project that adopted a copy of it — never
// something looked up inside the target project's own tree.
const ENGINES_DIR = fileURLToPath(new URL('./engines', import.meta.url));

// Generous for a plan, bounded enough that a mistyped path cannot turn a binary
// into a prompt. The inline parameters cap at 100k characters; a file is allowed
// more because moving large text out of the conversation is the entire point.
const MAX_TEXT_BYTES = 262_144;

// A plan the planner produced has to reach the developer somehow, and worktrees
// share no scratch — so it travelled as inline text the conductor re-typed word
// for word through a tool call: ~8k tokens of pure transport on one measured
// dispatch, the largest single token cost in the loop (dispatch-findings
// 2026-09-10, F-D). A path costs none of that. The text still ends up in the
// prompt byte for byte; only the conversation is spared.
function readText(root, { value, file, field }) {
  if (file == null) return value;
  if (value != null) {
    throw new Error(`Pass either ${field} or ${field}_file, not both — two sources for one value `
      + 'means the prompt does not say which one the worker got.');
  }
  const path = isAbsolute(file) ? file : resolve(root, file);
  let stats;
  try { stats = statSync(path); }
  catch { throw new Error(`${field}_file not found: ${path}`); }
  if (!stats.isFile()) throw new Error(`${field}_file is not a file: ${path}`);
  if (stats.size > MAX_TEXT_BYTES) {
    throw new Error(`${field}_file is too large: ${stats.size} bytes, limit ${MAX_TEXT_BYTES}. `
      + 'A worker prompt this size is a scoping problem, not a transport one.');
  }
  const text = readFileSync(path, 'utf8');
  if (text.includes('\0')) throw new Error(`${field}_file is not text: ${path}`);
  // Files end with a newline; a pasted string does not. Trimming the tail is
  // what makes "pass the text" and "pass the file holding that text" compose
  // the same prompt, which is the only way a caller can treat the choice as the
  // transport detail it is.
  return text.trimEnd();
}

export function prepareDispatch(root, input = {}) {
  const { conductorEngine, cli_engine, workspace, task_id = randomUUID() } = input;
  const canonical = loadCanonical(root);
  const config = loadConfig(root);

  const instructions = readText(root,
    { value: input.instructions, file: input.instructions_file, field: 'instructions' });
  const context = readText(root, { value: input.context, file: input.context_file, field: 'context' });
  const diff = input.diff_range ? computeDiff(root, input.diff_range) : null;

  const composed = composePrompt(canonical, {
    ...input, instructions, context: context ?? '', diff,
    task_id, workspace, workerCommands: config.workerCommands });
  // An explicit cli_engine is the conductor deciding, and the chain does not
  // argue with it. Otherwise walk the role's chain and take the first engine
  // that is actually installed. A missing CLI is the half of "unavailable" that
  // is computable; a usage limit is not, and is still answered by re-dispatching
  // with cli_engine.
  const chain = cli_engine ? [cli_engine] : resolveEngineChain(config, composed.role, conductorEngine);
  const availability = chain.map(name => engineAvailability(config, name));
  const chosen = availability.find(entry => entry.available) ?? availability[0];
  const engine = chosen.name;

  // All four files live beside each other so a human can read exactly what was
  // sent and re-run it byte for byte. The prompt is the readable form; the stdin
  // file is the wire form, which differs only for antigravity's NDJSON envelope.
  // report_file ends up holding just the worker's final message for any engine
  // that solves the "report vs. transcript" problem (codex natively via -o;
  // antigravity via the command wrapping below, since it has no such flag);
  // raw_file is where that engine's full stdout+stderr goes when wrapped, kept
  // for the rare case of debugging a failed run. Computed before buildCommand
  // so codex's adapter can wire report_file into its own argv.
  const dir = resolve(root, '.worktrees', '.dispatch', task_id);
  mkdirSync(dir, { recursive: true });
  const prompt_file = resolve(dir, 'prompt.txt');
  const stdin_file = resolve(dir, 'stdin.txt');
  const report_file = resolve(dir, 'report.txt');
  const raw_file = resolve(dir, 'raw.txt');
  writeFileSync(prompt_file, composed.prompt);
  writeFileSync(stdin_file, stdinPayload(engine, composed.prompt));

  // What this dispatch was allowed to do, written where list_worktrees can read
  // it back. Without it a worktree is just a dirty or clean checkout; with it,
  // "a read-only role wrote something" and "a developer wrote outside its owned
  // paths" are both computable afterwards instead of being the conductor's job
  // to remember (dispatch-findings F-F).
  writeFileSync(resolve(dir, 'dispatch.json'), JSON.stringify({
    task_id, role: composed.role, access: composed.access, owned_paths: composed.owned_paths,
    engine, workspace: workspace ?? null, base_sha: input.base_sha ?? null,
    created_at: new Date().toISOString()
  }, null, 2) + '\n');

  const roleConfig = config.roles?.[composed.role] ?? {};
  const command = buildCommand(config, {
    engine,
    profile: composed.profile,
    access: composed.access,
    workspace,
    reportFile: report_file,
    model: input.model_override ?? roleConfig.models?.[engine] ?? undefined,
    effort: input.thinking_budget ?? roleConfig.effort?.[engine] ?? undefined
  });

  // Stated per dispatch, not buried in a doc: the conductor is the one choosing
  // an engine for a task, and it can only weigh that choice if it is told what
  // the engine cannot enforce below the prompt.
  const adapter = ENGINES[engine];
  const warnings = [];
  if (!adapter.enforcesLeafWorker) {
    warnings.push(`${engine} exposes subagent tools to workers and offers no flag to remove them, so the `
      + 'no-recursive-dispatch rule is prompt-level here rather than process-level. The subagent '
      + 'inherits this worker\'s sandbox and worktree, so the exposure is unbounded work, not '
      + 'privilege escalation. Prefer another engine for open-ended tasks, and read the report.');
  }
  if (composed.access === 'read-only' && !adapter.enforcesReadOnly) {
    warnings.push(`${engine} cannot enforce read-only below the prompt, so for this role the no-edits `
      + 'rule is a promise rather than a property. Call list_worktrees after the run: it reports this '
      + 'worktree\'s `violations` against the access level recorded for this dispatch, so the check is '
      + 'computed rather than remembered. Anything it touched voids the round (behavioral rule 12).');
  }
  // Only worth a warning where nothing already solves it: claude's stdout is
  // already just the final message (reportIsStdout), and codex gets a separate
  // report_file below (writesReportFile). Antigravity has neither.
  if (!adapter.writesReportFile && !adapter.reportIsStdout) {
    warnings.push(`${engine} has no way to separate the worker's report from its full tool-call `
      + 'transcript — everything lands in stdout together, and on a large task that can reach '
      + 'megabytes. Capture it to a file and read from the end rather than inline.');
  }
  // A worker running on a different model than the role was pinned to is a
  // result the conductor has to be able to weigh, so a fallback announces
  // itself. Only on an actual switch: "the chain's first choice was used" is
  // the normal case and needs no warning.
  if (engine !== chain[0]) {
    warnings.push(`${chain[0]} is not installed (${availability[0].executable} was not found on PATH), `
      + `so this dispatch falls through the role's chain to ${engine}. The role's own model and effort `
      + 'pins for that engine apply, which are not the ones the role was tuned on.');
  } else if (!chosen.available) {
    warnings.push(`No engine in this role's chain (${chain.join(', ')}) is installed — `
      + `${chosen.executable} was not found on PATH. The command below is still correct, but it will `
      + 'almost certainly fail to start. Fix the PATH or pass cli_engine.');
  }
  // An empty diff almost always means the range was wrong, and finding that out
  // from a reviewer's report costs the whole dispatch.
  if (diff?.empty) {
    warnings.push(`\`git diff ${diff.range}\` is empty — there are no changes in that range. `
      + 'Check the range before spending a dispatch on it.');
  }
  if (diff?.truncated) {
    warnings.push(`The diff for ${diff.range} was truncated at ${diff.bytes} bytes. The worker is `
      + 'told, but its findings cover only the part it received.');
  }

  return {
    task_id,
    ...composed,
    warnings,
    prompt: undefined,                       // on disk, not in the tool response
    // Buffer.byteLength, not .length: a JS string's .length counts UTF-16 code
    // units, so any multi-byte character (accents, curly quotes, an emoji)
    // silently under-reports what a real UTF-8 prompt actually costs.
    prompt_bytes: Buffer.byteLength(composed.prompt, 'utf8'),
    engine: command.engine,
    // What the role asked for, in order, and whether the one it got is there.
    // The conductor needs both to answer a failed dispatch without re-deriving
    // the config: the chain says what to try next, availability says whether
    // trying is worth it.
    engine_chain: chain,
    engine_available: chosen.available,
    executable: command.executable,
    args: command.args,
    model: command.model,
    effort: command.effort,
    workspace,
    // Run the process here. Claude Code has no --cd flag and works in the
    // process's working directory, so a command that did not enter the worktree
    // would run the worker against the conductor's own checkout — exactly what
    // the worktree exists to prevent. Codex (--cd) and agy (--add-dir) are told
    // as well, but the working directory is what makes all three agree.
    cwd: workspace,
    prompt_file,
    stdin_file,
    // Echoed back when the text came from disk, so the audit trail names the
    // file the prompt was actually built from.
    ...(input.instructions_file ? { instructions_file: resolve(root, input.instructions_file) } : {}),
    ...(input.context_file ? { context_file: resolve(root, input.context_file) } : {}),
    ...(diff ? { diff_range: diff.range, diff_bytes: diff.bytes,
      diff_truncated: diff.truncated, diff_empty: diff.empty } : {}),
    // Always a path, on every engine. It used to be null for claude — whose
    // stdout is already just the report — which left the conductor maintaining
    // two retrieval paths in the one place the workflow otherwise abstracts
    // engines away (dispatch-findings 2026-09-10, F-E). How the file gets
    // written still differs per engine; that the conductor reads one file does
    // not. raw_file keeps the full transcript for the engines that produce one.
    report_file,
    command: buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter })
  };
}

// The base invocation is always `cd <workspace> && <executable> <args> < <stdin>`.
// Every engine is then wrapped so that report_file exists afterwards, because a
// conductor that reads one file for claude and another for codex is a conductor
// keeping engine-specific state in the one place the workflow abstracts engines
// away (dispatch-findings 2026-09-10, F-E). Three mechanisms, one destination:
//
//   - reportIsStdout (claude): stdout IS the report, so it is captured straight
//     into report_file. stderr is deliberately NOT redirected — it belongs to
//     the conductor, and folding a crash trace into the file it reads as "the
//     worker's answer" is how a failed run reads as a strange report.
//   - writesReportFile without extraction (codex): it wrote report_file itself
//     via -o; stdout+stderr go to raw_file so the transcript stays out of the way.
//   - writesReportFile with extraction (antigravity): same capture, then
//     extractReportFrom turns raw_file into report_file.
//
// The wrapper prints report_file either way, so a foreground run's tool-call
// result is the small clean report rather than a multi-megabyte transcript.
// The subshell preserves the underlying process's real exit code as the whole
// command's exit code by default; without that, the trailing `cat` would win.
//
// For an engine with extractReportFrom (antigravity), the extraction step is
// also the only place a denied action or a missing result can be detected —
// the underlying process itself exits 0 either way (see extract-agy-result.mjs)
// — so its own exit code is folded in too: a real process failure (`ec`) still
// wins over it, but a clean process paired with a denied-action report now
// fails the whole command instead of silently returning 0.
export function buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter }) {
  const base = `cd ${quote(workspace)} && ${quote(command.executable)} `
    + `${command.args.map(quote).join(' ')} < ${quote(stdin_file)}`;
  if (!adapter.writesReportFile) {
    if (!adapter.reportIsStdout) return base;   // neither — the caller is warned instead
    return `( ${base} > ${quote(report_file)}; ec=$?; cat ${quote(report_file)}; exit $ec )`;
  }

  if (!adapter.extractReportFrom) {
    // codex already wrote report_file itself, via -o in args — nothing to extract or validate.
    return `( ${base} > ${quote(raw_file)} 2>&1; ec=$?; cat ${quote(report_file)}; exit $ec )`;
  }
  const extractCmd = `node ${quote(resolve(ENGINES_DIR, adapter.extractReportFrom))} `
    + `${quote(raw_file)} ${quote(report_file)}`;
  return `( ${base} > ${quote(raw_file)} 2>&1; ec=$?; ${extractCmd}; xc=$?; cat ${quote(report_file)}; `
    + `exit $([ "$ec" -ne 0 ] && echo "$ec" || echo "$xc") )`;
}
