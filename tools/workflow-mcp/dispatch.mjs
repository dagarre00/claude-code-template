// Ties the pieces together into one dispatch: compose the prompt, resolve the
// engine, write the two files, and hand back a command the conductor can run.
//
// This tool does not spawn anything. That is the whole scope decision: the MCP
// is a prompt factory, and the conductor — which already has a shell — runs the
// process itself. It keeps the control plane small enough to reason about, and
// means a failed worker is debugged by re-running a command line a human can
// read, not by reading a supervisor's logs.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCanonical } from './canonical.mjs';
import { engineAvailability } from './availability.mjs';
import { loadConfig, resolveEngineChain } from './config.mjs';
import { composePrompt } from './compose.mjs';
import { computeDiff } from './diff.mjs';
import { ENGINES, buildCommand, stdinPayload } from './engines/index.mjs';
import { explainMisfit, modelFits } from './model-fit.mjs';
import { dispatchDir, trustWorktree } from './worktree.mjs';
import { currentVerdict } from './inspect.mjs';

// Quote one argument for the shell the conductor will paste this into. Only ever
// used to build the human-readable/runnable `command` string; the `args` array
// is the authoritative form and never passes through a shell.
const quote = value => /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

// Resolved against this file's own location, not `root`: an extraction script
// is part of the workflow-mcp tool, always a sibling of dispatch.mjs, whether
// this is the template checkout or a project that adopted a copy of it — never
// something looked up inside the target project's own tree.
const ENGINES_DIR = fileURLToPath(new URL('./engines', import.meta.url));
const RECORD_OUTCOME = fileURLToPath(new URL('./record-outcome.mjs', import.meta.url));
const RED_CHECK = fileURLToPath(new URL('./red-check.mjs', import.meta.url));

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

const readJson = path => {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

// Everything one attempt leaves in its dispatch directory. `worktree.json`
// belongs to the worktree, not the attempt, and `attempts/` is the archive itself.
const ATTEMPT_FILES = ['dispatch.json', 'prompt.txt', 'stdin.txt', 'report.txt', 'raw.txt',
  'outcome.json', 'decision.json', 'agent', 'red.json', 'red'];

const archivedNumbers = dir => existsSync(resolve(dir, 'attempts'))
  ? readdirSync(resolve(dir, 'attempts')).filter(name => /^\d+$/.test(name)).map(Number)
  : [];

// Which attempt this composition is, decided without touching anything. Resuming
// re-dispatches into the worktree that holds the partial work, and composing
// again used to overwrite the previous attempt's prompt, report and record, so a
// directory holding a run is archived under attempts/<n>/ — but only once the new
// composition has fully validated (adversary F2, round 1), and never over an
// archive that already exists. Composing twice without running in between is one
// attempt, overwritten. A run that has started and not finished is refused unless
// the conductor abandons it, because it would otherwise finish into its
// replacement's record (adversary F3, round 1). `retry_of` names an attempt in
// another worktree that this one replaces.
function planAttempt(root, dir, task_id, { retry_of, abandon_running = false }) {
  const previous = readJson(resolve(dir, 'dispatch.json'));
  const outcome = readJson(resolve(dir, 'outcome.json'));
  const highestArchived = Math.max(0, ...archivedNumbers(dir));
  let attempt = highestArchived + 1;
  let replaces = highestArchived ? task_id : null;
  let archive = null;
  if (previous) {
    if (outcome) {
      if (!outcome.finished_at && !abandon_running) {
        throw new Error(`Task "${task_id}" has an attempt that started at ${outcome.started_at} and has not finished. `
          + 'Wait for it and inspect it — or, if the process is gone, pass abandon_running: true to archive it as abandoned.');
      }
      const number = Math.max(previous.attempt ?? 1, highestArchived + 1);
      archive = { number, abandoned: !outcome.finished_at };
      attempt = number + 1;
      replaces = task_id;
    } else {
      attempt = Math.max(previous.attempt ?? 1, highestArchived + 1);
      replaces = previous.retry_of ?? replaces;
    }
  }
  if (retry_of != null && retry_of !== task_id) {
    const replaced = readJson(resolve(dispatchDir(root, retry_of), 'dispatch.json'));
    if (!replaced) {
      throw new Error(`retry_of "${retry_of}" names no composed dispatch — pass the task_id of the attempt this one replaces`);
    }
    attempt = Math.max(attempt, (replaced.attempt ?? 1) + 1);
    replaces = retry_of;
  }
  return { attempt, retry_of: replaces, archive };
}

// Moves the current attempt aside, with the verdict it has right now: once
// archived, its worktree moves on and the verdict could no longer be recomputed
// (adversary F5, round 1).
function archiveAttempt(root, dir, task_id, { number, abandoned }) {
  const target = resolve(dir, 'attempts', String(number));
  const verdict = currentVerdict(root, task_id);
  mkdirSync(target, { recursive: true });
  for (const name of ATTEMPT_FILES) {
    if (existsSync(resolve(dir, name))) renameSync(resolve(dir, name), resolve(target, name));
  }
  writeFileSync(resolve(target, 'verdict.json'), JSON.stringify(verdict, null, 2) + '\n');
  if (abandoned) {
    const outcomePath = resolve(target, 'outcome.json');
    writeFileSync(outcomePath, JSON.stringify({ ...readJson(outcomePath), abandoned_at: new Date().toISOString() }, null, 2) + '\n');
  }
}

export function prepareDispatch(root, input = {}) {
  const { conductorEngine, cli_engine, workspace, task_id = randomUUID() } = input;
  // Every engine's command begins by entering the worktree — claude has no --cd
  // flag and works in the process's working directory — so a dispatch without
  // one produces `cd undefined`. Caught here because the alternative is what it
  // used to do: fail inside the adapter contract check with "Engine codex
  // produced an invalid argv", which names neither the parameter nor the caller.
  if (typeof workspace !== 'string' || !workspace.trim()) {
    throw new Error('workspace is required — pass the path from prepare_worktree. A worker runs in its '
      + 'own checkout, and the command that starts it has to enter one.');
  }
  const canonical = loadCanonical(root);
  const config = loadConfig(root);

  const instructions = readText(root,
    { value: input.instructions, file: input.instructions_file, field: 'instructions' });
  const context = readText(root, { value: input.context, file: input.context_file, field: 'context' });
  const diff = input.diff_range ? computeDiff(root, input.diff_range) : null;

  // An explicit cli_engine is the conductor deciding, and the chain does not
  // argue with it. Otherwise walk the role's chain and take the first engine
  // that is actually installed. A missing CLI is the half of "unavailable" that
  // is computable; a usage limit is not, and is still answered by re-dispatching
  // with cli_engine. Resolved before composing, because how a command must be
  // spelled for the worker depends on the engine that runs it.
  const chain = cli_engine ? [cli_engine] : resolveEngineChain(config, input.role, conductorEngine);
  const availability = chain.map(name => engineAvailability(config, name));
  const chosen = availability.find(entry => entry.available) ?? availability[0];
  const engine = chosen.name;
  const platform = input.platform ?? process.platform;
  const spell = ENGINES[engine]?.spellCommand;
  const workerCommands = spell ? config.workerCommands.map(command => spell(command, platform)) : config.workerCommands;
  const respelled = config.workerCommands.filter((command, at) => command !== workerCommands[at]);
  const commandNotes = respelled.length
    ? [`On this engine and platform some commands need a different spelling to run at all: wherever your `
      + `instructions or the wiki say ${respelled.map(command => `\`${command}\``).join(', ')}, run `
      + `${respelled.map(command => `\`${spell(command, platform)}\``).join(', ')} instead. It is the same command; `
      + 'the plain spelling is refused by this shell before it starts.']
    : [];
  if (ENGINES[engine]?.filesThroughShell) {
    commandNotes.push('On this engine you have no separate file tools: reading, listing and searching files happen '
      + 'through your shell. Read-only shell commands that only read inside your workspace — printing a file, listing a '
      + 'directory, searching with rg or Select-String, `git show`, `git log` — are those file tools, and you run them '
      + 'freely; the list above governs commands that execute the project or change anything. Never use the shell to '
      + 'write, move or delete a file, and never to read outside your workspace.');
  }

  const composed = composePrompt(canonical, {
    ...input, instructions, context: context ?? '', diff,
    task_id, workspace, workerCommands, commandNotes, protectedPaths: config.protectedPaths });

  // All four files live beside each other so a human can read exactly what was
  // sent and re-run it byte for byte. The prompt is the readable form; the stdin
  // file is the wire form, which differs only for antigravity's NDJSON envelope.
  // report_file ends up holding just the worker's final message for any engine
  // that solves the "report vs. transcript" problem (codex natively via -o;
  // antigravity via the command wrapping below, since it has no such flag);
  // raw_file is where that engine's full stdout+stderr goes when wrapped, kept
  // for the rare case of debugging a failed run. Computed before buildCommand
  // so codex's adapter can wire report_file into its own argv.
  const dir = dispatchDir(root, task_id);
  const plan = planAttempt(root, dir, task_id, input);
  const { attempt, retry_of } = plan;
  const prompt_file = resolve(dir, 'prompt.txt');
  const stdin_file = resolve(dir, 'stdin.txt');
  const report_file = resolve(dir, 'report.txt');
  const raw_file = resolve(dir, 'raw.txt');

  // An engine that launches as a custom agent gets its definition written into
  // its own directory, so the engine is handed that folder and nothing else of
  // the dispatch's files. Outside the worktree on purpose: inside, it would be an
  // untracked file the worker appears to have written.
  const adapter = ENGINES[engine];
  const definition = adapter.agentDefinition?.({ role: composed.role, access: composed.access, workspace }) ?? null;
  const agent = definition ? { name: definition.name, dir: resolve(dir, 'agent') } : undefined;

  const roleConfig = config.roles?.[composed.role] ?? {};
  // A model_override names a model, not an engine — and when the chain falls through,
  // the engine that runs is not the one the conductor had in mind. Handing it on
  // would launch that engine with a model it cannot run, so say so instead, and say
  // how to pin the engine the override is for.
  if (input.model_override != null && !modelFits(adapter, input.model_override)) {
    throw new Error(`model_override ${JSON.stringify(input.model_override)} cannot run on ${engine}, the engine this `
      + `dispatch resolved to${engine !== chain[0] ? ` (${chain[0]} is not installed, so the role's chain fell through)` : ''}. `
      + `${explainMisfit(ENGINES, engine, input.model_override)} Pass cli_engine to name the engine the override is for, `
      + 'or drop model_override.');
  }
  const command = buildCommand(config, {
    engine,
    profile: composed.profile,
    access: composed.access,
    workspace,
    reportFile: report_file,
    agent,
    model: input.model_override ?? roleConfig.models?.[engine] ?? undefined,
    effort: input.thinking_budget ?? roleConfig.effort?.[engine] ?? undefined
  });

  // Everything that can refuse this composition has run by now. Only from here
  // does anything on disk change.
  if (plan.archive) archiveAttempt(root, dir, task_id, plan.archive);
  if (engine === 'codex') trustWorktree(root, workspace);
  mkdirSync(dir, { recursive: true });
  writeFileSync(prompt_file, composed.prompt);
  writeFileSync(stdin_file, stdinPayload(engine, composed.prompt));
  if (definition) {
    mkdirSync(resolve(agent.dir, '.agents', 'agents'), { recursive: true });
    writeFileSync(resolve(agent.dir, '.agents', 'agents', `${definition.name}.md`), definition.content);
  }

  // What this dispatch was allowed to do and what it ran on, written where
  // list_worktrees and inspect_dispatch read it back. Without it a worktree is
  // just a dirty or clean checkout; with it, "a read-only role wrote something",
  // "a developer wrote outside its owned paths" and "which engine was this, on
  // which attempt" are all computable afterwards (dispatch-findings F-F,
  // resume-report §5). worker_commands is what extract-agy-result.mjs audits
  // run_command calls against; it reads this file from beside the transcript.
  const worktreeRecord = readJson(resolve(dir, 'worktree.json'));
  writeFileSync(resolve(dir, 'dispatch.json'), JSON.stringify({
    task_id, role: composed.role, access: composed.access, profile: composed.profile,
    owned_paths: composed.owned_paths, protected_paths: config.protectedPaths,
    test_paths: composed.test_paths, test_command: composed.test_command,
    red_check_command: composed.test_paths ? redCheckCommand(dir) : null,
    engine, model: command.model, effort: command.effort,
    // What the worker was given. Every worktree holds every committed skill, so
    // this is what inspect_dispatch reads a skill the worker opened against.
    skills: composed.skills,
    workspace: workspace ?? null,
    base_sha: input.base_sha ?? worktreeRecord?.base_sha ?? null,
    integration_branch: worktreeRecord?.integration_branch ?? null,
    attempt, retry_of,
    prompt_bytes: Buffer.byteLength(composed.prompt, 'utf8'), prompt_chars: composed.prompt.length,
    worker_commands: config.workerCommands ?? [],
    report_file, created_at: new Date().toISOString()
  }, null, 2) + '\n');

  // Stated per dispatch, not buried in a doc: the conductor is the one choosing
  // an engine for a task, and it can only weigh that choice if it is told what
  // the engine cannot enforce below the prompt.
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
  // The engine pins exist partly to spread load across providers, and a worker
  // on the conductor's own engine spends the conductor's own account limit. That
  // is invisible at dispatch time and shows up later as a refusal, on whichever
  // dispatch happens to cross the line — measured as four nested Claude sessions
  // inside one Claude conductor, where the casualty was the adversary: last in
  // the cycle, the largest prompt of the seven, and the one whose absence costs
  // most (cycle1-findings F-D). Stated on every such dispatch, not just on an
  // override, because the consequence does not depend on how the engine was
  // chosen — a role pinned to the conductor's engine shares the quota exactly as
  // much as an ad-hoc `cli_engine` does.
  if (engine === conductorEngine) {
    warnings.push(`This worker runs on ${engine}, the same engine as the conductor, so it spends the same `
      + 'account quota rather than spreading load across providers. Consecutive dispatches compound it, '
      + 'and the limit lands on whichever one crosses it — usually the largest, which is the one you '
      + `least want to lose. Dispatch expensive roles first, or pass cli_engine to move this one off ${engine}.`);
  }
  // A role that needs the web, on an engine whose workers were measured to have
  // none, would spend its whole dispatch discovering that.
  const roleDefinition = canonical.roles.find(entry => entry.name === composed.role);
  if (roleDefinition?.capabilities?.includes('web') && adapter.providesWeb === false) {
    warnings.push(`The ${composed.role} role needs web access, and ${engine} workers have no web tools — `
      + 'measured: search failed and every URL fetch was denied headless. Dispatch it elsewhere with cli_engine.');
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
    attempt,
    retry_of,
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
    command: buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter }),
    // Run after the worker finishes and before accepting it: inspect_dispatch
    // stays `incomplete` until Red is proven for a dispatch that declared tests.
    ...(composed.test_paths ? { red_check_command: redCheckCommand(dir) } : {})
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
//
// Every variant also records its outcome — start time before the process,
// finish time and exit codes after it — through record-outcome.mjs into the
// dispatch directory, which is what inspect_dispatch reads back. A process
// launched from the structured executable/args fields bypasses that, and
// inspect_dispatch says so rather than guessing.
export const redCheckCommand = dir => `node ${quote(RED_CHECK)} ${quote(dir)}`;

export function buildRunnableCommand({ workspace, command, stdin_file, report_file, raw_file, adapter }) {
  const base = `cd ${quote(workspace)} && ${quote(command.executable)} `
    + `${command.args.map(quote).join(' ')} < ${quote(stdin_file)}`;
  const record = `node ${quote(RECORD_OUTCOME)}`;
  const dir = quote(dirname(report_file));
  const start = `${record} start ${dir}`;
  const finish = codes => `${record} finish ${dir} ${codes}`;
  if (!adapter.writesReportFile) {
    if (!adapter.reportIsStdout) return `( ${start}; ${base}; ec=$?; ${finish('$ec')}; exit $ec )`;
    return `( ${start}; ${base} > ${quote(report_file)}; ec=$?; ${finish('$ec')}; cat ${quote(report_file)}; exit $ec )`;
  }

  if (!adapter.extractReportFrom) {
    // codex already wrote report_file itself, via -o in args — nothing to extract or validate.
    return `( ${start}; ${base} > ${quote(raw_file)} 2>&1; ec=$?; ${finish('$ec')}; cat ${quote(report_file)}; exit $ec )`;
  }
  const extractCmd = `node ${quote(resolve(ENGINES_DIR, adapter.extractReportFrom))} `
    + `${quote(raw_file)} ${quote(report_file)}`;
  return `( ${start}; ${base} > ${quote(raw_file)} 2>&1; ec=$?; ${extractCmd}; xc=$?; ${finish('$ec $xc')}; `
    + `cat ${quote(report_file)}; exit $([ "$ec" -ne 0 ] && echo "$ec" || echo "$xc") )`;
}
