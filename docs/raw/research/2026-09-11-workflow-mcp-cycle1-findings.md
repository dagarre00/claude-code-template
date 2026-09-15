# Workflow MCP findings — PDF Cycle 1 (2026-09-11)

Measured across the seven dispatches that implemented PDF Cycle 1 (section-registry
B18, drawing-sheets B24 groundwork, the addon self-import), on `feat/rpc-transport`.
Successor to [2026-09-10 dispatch findings](2026-09-10-workflow-mcp-dispatch-findings.md);
findings that recur there are marked **(repeat)** and should be read as
independent confirmation rather than a new report.

Every claim is an observed command, tool result or file, not an impression.

## Headline

**Three of seven dispatches were stopped by the worker's own tooling, not by the
work** — two by antigravity file-tool limits, one by an account session limit
reached partly because of how the workaround for the first two was applied. The
cycle still landed (321 → 325 passing, three commits), but roughly half the
conductor's effort went to transport rather than to the task.

The single most valuable thing that happened is not a workflow feature: the
conductor ran a `freecadcmd` probe that **no worker is allowed to run**, and it
caught a defect that had already passed its Layer 1 test and was one commit from
shipping. See F-G.

## Findings

### F-A — A worker cannot delete, move or rename a file. Any "move a data file" task is unfinishable.

**Observed:** the `cycle1-b24-drawings` developer (antigravity) ended its run on

```
"denied_actions":[{"action":"command","display_name":"RunCommand"}]
```

from `..\..\.venv\Scripts\python.exe -c "import os; os.remove('drawing-templates/iso-a3-landscape.yaml'); os.rmdir('drawing-templates')"`.

`workerCommands` is an exact-match allowlist with no deletion primitive, and the
file-write tools create and edit but do not unlink. This cycle moved **two** data
files, so the gap was hit immediately.

**Workaround used, and it is a good one:** the conductor performs the removal with
`git rm` at staging time. This is defensible on principle — the worker delivers
files, the conductor runs git — and `git` records the result as a clean rename
(`R  drawing-templates/… -> addon/…`, 96–100% similarity), which is *better*
evidence of byte preservation than a worker-side move would have been.

**Recommend:** make it doctrine rather than discovery. State in the `developer`
role that it must never attempt to delete or move a file and that the conductor
does removals, and have `/project:work` note that a move task splits into
"worker writes the new path, conductor `git rm`s the old". A worker that learns
this by dying costs a whole dispatch.

### F-B — `denied_actions` still reports the action but not the target. **(repeat)**

The payload above names `RunCommand` and nothing else. Finding the actual command
required grepping `raw.txt` for `permission check failed`, then hunting the last
`run_command` in an NDJSON transcript. Reported on 2026-09-10 and unchanged.

**Recommend:** include the denied command string / file path in `denied_actions`.
Without it the report cannot be acted on, which is the whole purpose of a report.

### F-C — antigravity's `write_to_file` refused to create a new file in the worktree on one run and allowed it on another.

**Observed, same task, same worktree, same flags, ~20 minutes apart:**

- Run 1 successfully created `tests/unit/test_installed_addon.py` and
  `addon/PorchRailMCP/builder/drawing-templates/`.
- Run 2, creating `addon/PorchRailMCP/builder/resources.py`, returned:

  ```
  invalid_args: C:\...\.worktrees\cycle1-b24-drawings\addon\PorchRailMCP\builder\resources.py
  is not a valid artifact path; artifacts must be in
  C:\Users\dagar\.gemini\antigravity-cli\brain\<conversation_id>/
  ```

  and `replace_file_content` then failed because the file did not exist — so the
  worker could edit existing files but could not bring a new one into being. It
  correctly stopped and reported rather than faking progress.

**Consequence:** the `developer` role is not dependable on antigravity for any
task that adds a file, which is most of them. This is what forced the engine
switch that produced F-D.

**Recommend:** treat antigravity as unsuitable for the `developer` role until this
is understood. It remains fine for read-only roles, which do not write.

### F-D — An ad-hoc engine fallback collapses worker load onto the conductor's own quota, and nothing warns.

After F-C, the conductor overrode `cli_engine` to `claude` for the remaining
developer dispatches. That unblocked the work, and the resulting workers were
notably higher quality. But **a `claude` worker bills the same account limit as
the `claude` conductor**, so the cycle ran four nested Claude sessions inside one.
The `cycle1-adversary` dispatch — `claude-opus-5`, effort `high`, a 45 KB prompt,
a 37 KB diff to read and a full suite to run — failed outright with:

```
You've hit your session limit · resets 12pm (America/Bogota)
```

The per-role engine pins in `.agents/config.json` exist in part to spread load
across providers. An override silently undoes that, and `build_worker_prompt`
returns no warning about it — it warns about leaf-worker and read-only
enforcement, which are real, but not about this.

**Recommend, in order of value:**
1. Have `build_worker_prompt` emit a warning when the resolved engine equals the
   conductor's own engine, naming the shared-quota consequence.
2. Let `.agents/config.json` declare a per-role **fallback chain**
   (`"engine": "antigravity", "fallback": ["codex", "claude"]`) so a failed engine
   degrades to a different *provider* before landing on the conductor's.
3. Order expensive dispatches first when quota is in doubt. The adversary ran last
   and was the most expensive; it is also the one whose absence is most costly.

### F-E — No shared scratch: three redos re-sent ~170 KB of prompt for deltas worth a few paragraphs. **(repeat, now measured)**

Prompt sizes this cycle: 51,649 / 57,385 / 55,501 / 45,065 bytes. Three of those
were **redos** whose actual new content was a few paragraphs of corrections; the
rest was the brief, the skills and the rules re-transmitted verbatim because
worktrees share no scratch and the MCP takes instructions only as a string.

The 2026-09-10 report already recommended an `instructions_file` parameter on the
strength of one 45,288-byte prompt. This cycle is an independent second instance
with three redos, so the estimate there was conservative.

**Recommend:** `instructions_file` (and/or a `prior_task_id` that lets a redo
reference the previous prompt and send only a delta). This is now the largest
recurring token cost in the loop.

### F-F — The conductor can pre-place files in a worker's worktree. This solves the diff-paste problem and is documented nowhere.

`gotchas.md` records that handing the adversary a commit range leaves it reviewing
whole files, and `adversarial-review` therefore puts pasting the diff on the
conductor — which routes the entire diff through the conductor's context twice
(once to read, once to write).

**There is a third option, used successfully this cycle:** the conductor wrote the
37 KB diff to `CYCLE1_REVIEW.diff` inside the adversary's worktree *after*
`prepare_worktree` and *before* dispatch, and the instructions simply said to read
that file. Zero diff bytes through the conductor's context, and the adversary gets
the real diff rather than whole files.

Caveat: the file is untracked in the worker's worktree, so the read-only
cleanliness check must be told to expect it, and `remove_worktree` will refuse
until it is deleted. Both are minor and both were handled.

**Recommend:** document this in `adversarial-review` as the preferred route, and
consider an explicit `attachments` parameter on `prepare_worktree` that drops
named files into the worktree and excludes them from cleanliness checks
automatically.

### F-G — `freecadcmd` is on no allowlist, and this cycle proved the cost is not theoretical. **(repeat, escalated)**

Reported on 2026-09-10 as "no worker can ever close a FreeCAD-dependent case".
This cycle it did concrete damage:

The `Init.py` bootstrap specified by the plan used `Path(__file__).resolve().parent.parent`.
Its Layer 1 test **passed**, because `runpy.run_path()` supplies a `__file__`.
FreeCAD does not: measured on 1.1.3, an addon's `Init.py` is exec'd with no
`__file__` in globals at all, so the code raised `NameError` at startup. The
developer could not have caught this — it had no way to run FreeCAD. The
conductor's `freecadcmd` run caught it, and only after that did the real
measurement happen ([research](2026-09-11-freecad-init-py-exec-context.md)).

So a defect that "passed TDD" reached commit-ready state and was stopped by a
capability the workflow denies its workers.

**Recommend:** add the documented Layer 2 invocations in
`docs/wiki/commands.md § Test — Layer 2` to `workerCommands` verbatim. They are
fixed strings, which the exact-match allowlist handles, and they are the only way
a worker can validate anything touching FreeCAD. Failing that, `/project:work`
should state that any case with a Layer 2 component requires a conductor run
before its commit claims anything.

### F-H — A worker silently disabled its own Layer 2 script, and only a conductor run could tell.

The rewritten Layer 2 script guarded with `if __name__ == "__main__":`. Under
`freecadcmd` that is **never true** — the main script gets `__name__` set to its
own basename — so the script printed nothing and exited 0, which reads exactly
like a clean pass. One conductor-side line change made the same script report
`3/3 passed`.

Distinct from F-G in kind: F-G is "the worker could not verify"; this is "the
failure is indistinguishable from success", which defeats even a careful reader
of the report. The worker was honest throughout — it said plainly that it had not
run the script — and it was still wrong about what the script would do.

**Recommend:** it is now filed as a gotcha. Beyond that, F-G's fix is the real
remedy: unrunnable code is unreviewable code.

### F-I — `report_file` is `null` for the `claude` engine, so a Claude worker's report has no durable artifact.

`build_worker_prompt` returns `report_file` for antigravity (written via
`extract-agy-result.mjs`) and for codex (via `-o`), but `report_file: null` for
claude — its report exists only as stdout in the conductor's terminal.

**This session paid for it directly.** Reconstructing the previous session's plan
and plan review required digging `prompt.txt` out of
`.worktrees/.dispatch/cycle1-resources-planreview/`, because the plan had been
pasted into that prompt; the plan-adversary's own findings survived only as the
conductor's prose summary in `log.md`. Had a `report.txt` existed, resuming would
have been a file read.

**Recommend:** wrap the claude invocation the way antigravity's is wrapped, so
`report.txt` is written for every engine. This is the cheapest fix in this
document and it directly protects against context loss between sessions.

## What worked and should not change

- **`prepare_worktree` / `remove_worktree` refusing dirty or unmerged state.** Three
  worktrees created, used and removed cleanly; the refusal semantics were never a
  nuisance and twice prompted a useful look before a retry.
- **`owned_paths` as a real boundary.** Every worker stayed inside its paths, across
  seven dispatches. The one genuine collision risk — `rpc_server.py` wanted by both
  Part B and Part C — was avoided by splitting ownership by path up front, and the
  Part C worker explicitly flagged that a file in its `owned_paths` carried a diff it
  had not authored rather than quietly re-touching it.
- **Per-case dispatch and commit.** Three parts, three dispatches, three commits, each
  independently verified by the conductor re-running the suite in the worker's own
  checkout. Bisect stays useful and each commit body answers one question.
- **Workers reporting honestly on what they could not verify.** Every worker that was
  asked not to claim an unrun result did not claim it. That is what made the
  conductor's `freecadcmd` run a targeted check rather than a fishing expedition.
- **The `extract-agy-result.mjs` non-zero exit from the 2026-09-10 sync.** It again
  turned a stalled antigravity run into a visible failure instead of a silently
  accepted empty report.
