// What happened to a dispatch, read back from what it left on disk — the
// conductor's resume record, its mechanical acceptance check, and the numbers a
// default-engine change is supposed to rest on.
//
// Three failures this answers, all measured (resume-report 2026-09-10):
//   - "exit 0 + SUCCESS + a denied read" was accepted as success, because nothing
//     computed otherwise (§1). The verdict here is mechanical on purpose: it can
//     reject, but a `pass` only means nothing computable is wrong. Whether a test
//     failed for the right reason stays the conductor's judgement, recorded with
//     record_decision.
//   - Resuming an interrupted cycle meant reconstructing task, base, owned paths
//     and outcome from conversation tails and event logs (§5). One bounded call
//     returns them — paths, never the prompt or the transcript.
//   - "Benchmark engines on accepted cases, retries and total elapsed time before
//     changing role defaults" (§6, §8) had no data to benchmark with.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dispatchDir, git, listWorktrees } from './worktree.mjs';
import { auditCodexTranscript } from './engines/codex-audit.mjs';

const readJson = path => {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

// The report, summarised. agy's report is the JSON result event (plus the
// extraction's audit); the other engines' is the final message as text.
function readReport(record, dir) {
  const path = resolve(dir, 'report.txt');
  if (!existsSync(path)) return { path, exists: false, bytes: 0, empty: true };
  const text = readFileSync(path, 'utf8');
  const summary = { path, exists: true, bytes: Buffer.byteLength(text, 'utf8'), empty: !text.trim() };
  if (record?.engine === 'antigravity') {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* a "no result event" note is plain text */ }
    if (parsed && typeof parsed === 'object') {
      Object.assign(summary, {
        empty: !String(parsed.response ?? '').trim(),
        engine_status: parsed.status ?? null,
        denied_actions: Array.isArray(parsed.denied_actions) ? parsed.denied_actions : [],
        usage: parsed.usage ?? null,
        engine_seconds: parsed.duration_seconds ?? null,
        audit: parsed.workflow_mcp_audit ?? null,
        transient: parsed.workflow_mcp_extraction?.transient === true
      });
    } else {
      summary.empty = true;
    }
  }
  if (record?.engine === 'codex') {
    summary.usage = codexUsage(resolve(dir, 'raw.txt'));
    // Codex's sandbox does not bound reads (measured), so its transcript is
    // audited the way agy's is.
    if (record.workspace && existsSync(resolve(dir, 'raw.txt'))) {
      summary.audit = auditCodexTranscript(readFileSync(resolve(dir, 'raw.txt'), 'utf8'), { workspace: record.workspace });
    }
  }
  return summary;
}

// codex ends its transcript with `tokens used` and the count on the next line,
// grouped by locale (measured: `14.771` for 14,771). Tokens are whole numbers,
// so every separator is dropped. The last occurrence is the run's total.
function codexUsage(rawFile) {
  if (!existsSync(rawFile)) return null;
  const matches = [...readFileSync(rawFile, 'utf8').matchAll(/^tokens used\s*\r?\n\s*([\d., \u00a0\u202f]+)\s*$/gm)];
  if (!matches.length) return null;
  const total = Number.parseInt(matches.at(-1)[1].replace(/[^\d]/g, ''), 10);
  return Number.isFinite(total) ? { total_tokens: total } : null;
}

// Where the case check stands for a dispatch that declared test paths
// (red-check.mjs: green, architecture, red). null for every other dispatch:
// nothing is claimed about Red there. The output tails stay in red.json — the
// check already printed the one that decided — so this stays a bounded record.
function readRed(record, dir) {
  if (!record?.test_paths?.length) return null;
  const command = record.red_check_command ?? null;
  if (existsSync(resolve(dir, 'red', 'manifest.json'))) {
    return { state: 'interrupted', command, restore_command: command ? `${command} --restore` : null };
  }
  const result = readJson(resolve(dir, 'red.json'));
  if (!result) return { state: 'not_run', command };
  // A red.json from before the green phase existed carries no state.
  const state = result.state ?? (result.timed_out ? 'timed_out' : result.proven ? 'proven' : 'refuted');
  const exits = Object.fromEntries(Object.entries(result.phases ?? {})
    .map(([name, phase]) => [name, phase?.timed_out ? 'timed out' : phase?.exit_code ?? null]));
  return { state, command, checked_at: result.checked_at, exit_codes: exits,
    reverted_paths: result.reverted_paths, result_file: resolve(dir, 'red.json') };
}

function verdictFor({ record, outcome, report, worktree, decision, red }) {
  const reasons = [];
  const warnings = [];
  if (!record) return { mechanical: 'incomplete', reasons: ['No prompt has been composed for this task yet.'], warnings };
  if (!outcome) {
    return { mechanical: 'incomplete', warnings, reasons: ['This dispatch has not been run through its returned command — '
      + 'no outcome is recorded. Run the command build_worker_prompt returned.'] };
  }
  if (!outcome.finished_at) {
    return { mechanical: 'incomplete', warnings,
      reasons: [`Started at ${outcome.started_at} and has not finished (or was killed before it could record an exit).`] };
  }
  if (outcome.timed_out) {
    reasons.push('The worker ran past its time limit (workerTimeoutSeconds) and was stopped with every process it '
      + 'started; its work is unfinished. Narrow the brief, or raise the limit if the task genuinely needs longer.');
  } else if (outcome.exit_code !== 0) {
    reasons.push(`The command exited ${outcome.exit_code} (process ${outcome.process_exit_code}`
      + `${outcome.extraction_exit_code == null ? '' : `, report extraction ${outcome.extraction_exit_code}`}).`);
  }
  if (!report.exists) reasons.push(`No report was written to ${report.path}.`);
  else if (report.empty && report.transient) {
    reasons.push('The report is empty because the engine ended the run right after rejecting its own malformed tool call '
      + '— a transient engine fault, not a problem with the brief. Retry once unchanged.');
  } else if (report.empty) reasons.push('The report is empty — there is nothing to accept.');
  if (report.denied_actions?.length) {
    reasons.push(`The engine denied ${report.denied_actions.map(a => a.display_name ?? a.action).join(', ')}; `
      + 'the run ended there and its work is unfinished.');
  }
  if (worktree.exists && worktree.violations?.length) {
    reasons.push(`A ${record.access} worker changed paths outside its scope: ${worktree.violations.join(', ')}.`);
  }
  // A decided attempt's worktree is expected to be gone — cleanup follows the
  // decision. Before one, a missing worktree means nothing above could look at
  // what the worker changed, which is not the same as it having changed nothing.
  if (!worktree.exists && !worktree.archived && !decision) {
    reasons.push('This task\'s worktree is gone, so what the worker changed cannot be checked against its scope. '
      + 'Accepting it needs override_mechanical and a reason that accounts for that.');
  }
  // Only an acceptance accounts for commits: the conductor commits after
  // accepting. A rejection leaves them exactly as unexplained as before
  // (adversary F1, round 1).
  if (worktree.exists && worktree.commits_since_base > 0 && decision?.decision !== 'accepted') {
    reasons.push(`The worker branch holds ${worktree.commits_since_base} commit(s) and no acceptance accounts for them — `
      + 'workers never commit, so these were not made by the conductor after accepting.');
  }
  const audit = report.audit;
  if (audit?.writes_outside_workspace?.length) {
    reasons.push(`The worker wrote outside its workspace: ${audit.writes_outside_workspace.join('; ')}.`);
  }
  if (audit?.subagent_calls?.length) reasons.push(`The worker called subagent tools: ${audit.subagent_calls.join(', ')}.`);
  if (audit?.reads_outside_workspace?.length) {
    warnings.push(`The worker read outside its workspace (${audit.reads_outside_workspace.length}): `
      + `${audit.reads_outside_workspace.slice(0, 5).join('; ')}. For a reviewer, that can void its independence.`);
  }
  // Records from before skills were recorded carry no list, and say nothing.
  const unsent = Array.isArray(record?.skills)
    ? (audit?.skill_reads ?? []).filter(name => !record.skills.includes(name)) : [];
  if (unsent.length) {
    warnings.push(`The worker read skills it was not sent: ${unsent.join(', ')}. Every worktree holds every `
      + 'committed skill; for a reviewer, reading another role\'s procedures can void its independence.');
  }
  if (audit?.commands_not_allowlisted?.length) {
    warnings.push(`Commands not on the allowlist verbatim: ${audit.commands_not_allowlisted.join('; ')}.`);
  }
  if (red?.state === 'refuted') {
    reasons.push(`The declared tests pass with the implementation reverted to ${record.base_sha} (\`${record.test_command}\` `
      + `exited 0) — they do not test the change, whatever the report says about Red.`);
  }
  if (red?.state === 'green_failed') {
    reasons.push(`The declared tests fail with the worker's implementation in place (\`${record.test_command}\` exited `
      + `${red.exit_codes?.green}) — the case is not Green, whatever the report says. The output is in ${red.result_file}.`);
  }
  if (red?.state === 'architecture_failed') {
    reasons.push(`The architecture check fails with the worker's implementation in place (\`${record.architecture_command}\` `
      + `exited ${red.exit_codes?.architecture}). The output is in ${red.result_file}.`);
  }
  if (red?.state === 'interrupted') {
    reasons.push(`A red check was interrupted with the implementation still reverted. Put the worker's files back first: ${red.restore_command}`);
  }
  // Transient only when that fault is the whole story: the report extraction's
  // own nonzero exit is the same fault seen twice, but a crashed process, a
  // denial or a change outside scope alongside it is something a retry cannot fix.
  const sameFault = outcome.process_exit_code === 0 ? 2 : 1;
  // Nothing else wrong, but a developer's Red is still only a claim until the
  // check has run: not a rejection, and not yet something to accept.
  if (!reasons.length && red && red.state !== 'proven') {
    return { mechanical: 'incomplete', warnings, transient: false,
      reasons: [red.state === 'timed_out'
        ? `The red check timed out, so Red is not proven. Investigate, then re-run: ${red.command}`
        : red.state === 'error'
          ? `The red check could not run a phase (a command that failed to start or was killed), so nothing is `
            + `proven. The output is in ${red.result_file}; fix the cause and re-run: ${red.command}`
          : `Red has not been proven. Run the red check before accepting: ${red.command}`] };
  }
  return { mechanical: reasons.length ? 'reject' : 'pass', reasons, warnings,
    transient: !!report.transient && reasons.length <= sameFault
      && !report.denied_actions?.length && !(worktree.exists && worktree.violations?.length) };
}

function worktreeState(root, record, listing) {
  if (!listing) return { exists: false };
  const base = record?.base_sha;
  const count = base && listing.head
    ? Number.parseInt(git(root, ['rev-list', '--count', `${base}..${listing.head}`], { allowFailure: true }) ?? '0', 10)
    : 0;
  return { exists: true, workspace: listing.workspace, branch: listing.branch, head: listing.head,
    clean: listing.clean, changed_paths: listing.changed_paths, violations: listing.violations ?? [],
    merged: listing.merged, commits_since_base: count };
}

function summarise(root, task_id, dir, listing, { archived = false } = {}) {
  const worktreeRecord = readJson(resolve(dir, 'worktree.json'));
  const record = readJson(resolve(dir, 'dispatch.json'));
  const outcome = readJson(resolve(dir, 'outcome.json'));
  const decision = readJson(resolve(dir, 'decision.json'));
  const state = !record ? 'prepared' : !outcome ? 'composed' : !outcome.finished_at ? 'running' : 'finished';
  const report = record ? readReport(record, dir) : { path: resolve(dir, 'report.txt'), exists: false, bytes: 0, empty: true };
  const worktree = archived ? { exists: false, archived: true } : worktreeState(root, record ?? worktreeRecord, listing);
  const red = readRed(record, dir);
  // An archived attempt keeps the verdict it had when it was archived: its
  // worktree has moved on, so recomputing would forget any change outside scope
  // (adversary F5, round 1).
  const verdict = (archived && readJson(resolve(dir, 'verdict.json')))
    || verdictFor({ record, outcome, report, worktree, decision, red });
  const { audit, usage, ...reportSummary } = report;
  return {
    task_id, state,
    role: record?.role ?? null, access: record?.access ?? null, engine: record?.engine ?? null,
    model: record?.model ?? null, effort: record?.effort ?? null,
    attempt: record?.attempt ?? 1, retry_of: record?.retry_of ?? null,
    base_sha: record?.base_sha ?? worktreeRecord?.base_sha ?? null,
    integration_branch: record?.integration_branch ?? worktreeRecord?.integration_branch ?? null,
    owned_paths: record?.owned_paths ?? null, test_paths: record?.test_paths ?? null,
    prompt_bytes: record?.prompt_bytes ?? null,
    skills: record?.skills ?? null,
    created_at: record?.created_at ?? worktreeRecord?.created_at ?? null,
    run: outcome ? { started_at: outcome.started_at ?? null, finished_at: outcome.finished_at ?? null,
      duration_ms: outcome.duration_ms ?? null, exit_code: outcome.exit_code ?? null,
      process_exit_code: outcome.process_exit_code ?? null, extraction_exit_code: outcome.extraction_exit_code ?? null } : null,
    report: reportSummary,
    // agy reports usage in its result event and codex in its transcript; claude's
    // report is the final message alone, so it has none.
    usage: usage ?? null,
    audit: audit ?? null,
    worktree,
    red,
    verdict,
    decision
  };
}

const listingFor = root => new Map(listWorktrees(root).map(entry => [entry.task_id, entry]));

const archivedAttempts = dir => {
  const base = resolve(dir, 'attempts');
  if (!existsSync(base)) return [];
  return readdirSync(base).filter(name => /^\d+$/.test(name) && statSync(resolve(base, name)).isDirectory())
    .sort((a, b) => Number(a) - Number(b)).map(name => resolve(base, name));
};

export function inspectDispatch(root, task_id) {
  const dir = dispatchDir(root, task_id);
  if (!existsSync(resolve(dir, 'worktree.json')) && !existsSync(resolve(dir, 'dispatch.json'))) {
    throw new Error(`No dispatch record for task "${task_id}" — nothing was prepared or composed under that id`);
  }
  const listing = listingFor(root);
  return {
    ...summarise(root, task_id, dir, listing.get(task_id)),
    previous_attempts: archivedAttempts(dir).map(path => {
      const summary = summarise(root, task_id, path, null, { archived: true });
      return { attempt: summary.attempt, engine: summary.engine, exit_code: summary.run?.exit_code ?? null,
        duration_ms: summary.run?.duration_ms ?? null, mechanical: summary.verdict.mechanical,
        decision: summary.decision?.decision ?? null };
    })
  };
}

// The verdict the current attempt of a task has right now, worktree included —
// what dispatch.mjs saves beside an attempt when it archives it.
export function currentVerdict(root, task_id) {
  return summarise(root, task_id, dispatchDir(root, task_id), listingFor(root).get(task_id)).verdict;
}

const SEVERITIES = ['critical', 'major', 'minor', 'nit', 'blocker', 'risk', 'note'];
const DISPOSITIONS = ['filed', 'fixed', 'rejected', 'applied', 'escalated'];
// Dispositions that changed something: a fix, a brief edit, or a spec question
// put to the human. Filed and rejected change nothing in this cycle.
const ACTED = ['fixed', 'applied', 'escalated'];

function validFindings(root, current, findings, reviewed_task_ids) {
  if (findings == null && reviewed_task_ids == null) return {};
  if (current.access !== 'read-only') {
    throw new Error(`Finding counts belong to a review dispatch; "${current.task_id}" is a ${current.access} ${current.role}, not read-only`);
  }
  const counts = (value, allowed, field) => {
    if (value == null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`findings.${field} must be an object of counts`);
    for (const [key, count] of Object.entries(value)) {
      if (!allowed.includes(key)) throw new Error(`Unknown findings.${field} key "${key}"; expected ${allowed.join(', ')}`);
      if (!Number.isInteger(count) || count < 0) throw new Error(`findings.${field}.${key} must be a whole number ≥ 0`);
    }
    return value;
  };
  const result = {};
  if (findings != null) {
    result.findings = { raised: counts(findings.raised, SEVERITIES, 'raised'),
      dispositions: counts(findings.dispositions, DISPOSITIONS, 'dispositions') };
  }
  if (reviewed_task_ids != null) {
    if (!Array.isArray(reviewed_task_ids)) throw new Error('reviewed_task_ids must be an array of task ids');
    for (const id of reviewed_task_ids) {
      if (!existsSync(resolve(dispatchDir(root, id), 'dispatch.json'))) {
        throw new Error(`reviewed_task_ids names "${id}", which is no composed dispatch in this checkout`);
      }
    }
    result.reviewed_task_ids = [...new Set(reviewed_task_ids)];
  }
  return result;
}

export function recordDecision(root, { task_id, decision, reason, override_mechanical = false, findings, reviewed_task_ids } = {}) {
  if (!['accepted', 'rejected'].includes(decision)) throw new Error('decision must be "accepted" or "rejected"');
  if (typeof reason !== 'string' || reason.trim().length < 3) {
    throw new Error('A decision needs a reason — the one sentence a later reader needs to trust it.');
  }
  const current = inspectDispatch(root, task_id);
  if (current.state !== 'finished') {
    throw new Error(`Task "${task_id}" is ${current.state}; decide on a dispatch once it has run.`);
  }
  if (decision === 'accepted' && current.verdict.mechanical !== 'pass' && !override_mechanical) {
    throw new Error(`The mechanical verdict is "${current.verdict.mechanical}": ${current.verdict.reasons.join(' ')} `
      + 'Accepting anyway needs override_mechanical: true, with a reason that says why each of those does not apply.');
  }
  const yieldRecord = validFindings(root, current, findings, reviewed_task_ids);
  const path = resolve(dispatchDir(root, task_id), 'decision.json');
  const previous = readJson(path);
  const entry = { decision, reason: reason.trim(), override_mechanical: !!override_mechanical,
    mechanical_verdict: current.verdict.mechanical, ...yieldRecord, decided_at: new Date().toISOString() };
  const history = [...(previous?.history ?? []), ...(previous ? [{ ...previous, history: undefined }] : [])];
  writeFileSync(path, JSON.stringify({ ...entry, ...(history.length ? { history } : {}) }, null, 2) + '\n');
  return { task_id, ...entry };
}

const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

// Every attempt of every dispatch this checkout has composed, counted per engine
// and role. Archived attempts count too: a retry is exactly what a benchmark
// has to see.
export function dispatchStats(root) {
  const base = resolve(root, '.worktrees', '.dispatch');
  const listing = listingFor(root);
  const attempts = [];
  if (existsSync(base)) {
    for (const task_id of readdirSync(base)) {
      const dir = resolve(base, task_id);
      if (!statSync(dir).isDirectory() || !existsSync(resolve(dir, 'dispatch.json')) && !archivedAttempts(dir).length) continue;
      for (const path of archivedAttempts(dir)) attempts.push(summarise(root, task_id, path, null, { archived: true }));
      if (existsSync(resolve(dir, 'dispatch.json'))) attempts.push(summarise(root, task_id, dir, listing.get(task_id)));
    }
  }
  const rows = new Map();
  for (const attempt of attempts) {
    const key = JSON.stringify([attempt.engine, attempt.role]);
    if (!rows.has(key)) {
      rows.set(key, { engine: attempt.engine, role: attempt.role, dispatches: 0, finished: 0, exit_nonzero: 0,
        mechanical_pass: 0, mechanical_reject: 0, accepted: 0, rejected: 0, undecided: 0, retries: 0,
        red_proven: 0, red_refuted: 0, green_failed: 0, reviews_with_findings_recorded: 0, findings_raised: 0, findings_acted_on: 0,
        findings_against: {}, durations: [], tokens: [] });
    }
    const row = rows.get(key);
    row.dispatches += 1;
    if (attempt.attempt > 1) row.retries += 1;
    if (attempt.red?.state === 'proven') row.red_proven += 1;
    if (attempt.red?.state === 'refuted') row.red_refuted += 1;
    if (attempt.red?.state === 'green_failed') row.green_failed += 1;
    if (attempt.state === 'finished') {
      row.finished += 1;
      if (attempt.run.exit_code !== 0) row.exit_nonzero += 1;
      if (attempt.verdict.mechanical === 'pass') row.mechanical_pass += 1;
      if (attempt.verdict.mechanical === 'reject') row.mechanical_reject += 1;
      if (Number.isFinite(attempt.run.duration_ms)) row.durations.push(attempt.run.duration_ms);
      if (Number.isFinite(attempt.usage?.total_tokens)) row.tokens.push(attempt.usage.total_tokens);
      if (attempt.decision?.decision === 'accepted') row.accepted += 1;
      else if (attempt.decision?.decision === 'rejected') row.rejected += 1;
      else row.undecided += 1;
      const found = attempt.decision?.findings;
      if (found) {
        row.reviews_with_findings_recorded += 1;
        row.findings_raised += Object.values(found.raised ?? {}).reduce((sum, count) => sum + count, 0);
        row.findings_acted_on += ACTED.reduce((sum, key) => sum + (found.dispositions?.[key] ?? 0), 0);
      }
    }
  }
  // Findings a review raised, charged to the engine and role of each dispatch it
  // reviewed — once per distinct author row, so a review of three cases by one
  // developer engine is not counted three times.
  const byTask = new Map(attempts.map(attempt => [attempt.task_id, attempt]));
  for (const attempt of attempts) {
    const found = attempt.decision?.findings;
    if (!found || !attempt.decision?.reviewed_task_ids?.length) continue;
    const authors = new Set(attempt.decision.reviewed_task_ids
      .map(id => byTask.get(id)).filter(Boolean).map(author => JSON.stringify([author.engine, author.role])));
    for (const key of authors) {
      const row = rows.get(key);
      if (!row) continue;
      for (const [severity, count] of Object.entries(found.raised ?? {})) {
        row.findings_against[severity] = (row.findings_against[severity] ?? 0) + count;
      }
    }
  }
  const by_engine_role = [...rows.values()].map(({ durations, tokens, ...row }) => ({
    ...row,
    median_duration_ms: median(durations),
    total_duration_ms: durations.reduce((sum, value) => sum + value, 0),
    // null, not 0, where the engine exposes no counters: "unknown" is not "free".
    total_tokens: tokens.length ? tokens.reduce((sum, value) => sum + value, 0) : null
  })).sort((a, b) => `${a.engine}${a.role}`.localeCompare(`${b.engine}${b.role}`));
  return {
    attempts: attempts.length,
    by_engine_role,
    note: 'Counts cover every attempt composed in this checkout, archived retries included. accepted/rejected are the '
      + 'conductor\'s recorded decisions; mechanical_* are computed. total_tokens is null where the engine reports no '
      + 'usage counters (claude, whose report is its final message alone).'
  };
}
