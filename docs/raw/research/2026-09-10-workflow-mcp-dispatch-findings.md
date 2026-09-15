# Workflow MCP findings — dispatch session after the template sync

Measured 2026-09-10 (evening), covering the eight dispatches made after
`524d2bb` synced `tools/workflow-mcp` from the template. Companion to
[the resume report](2026-09-10-workflow-resume-report.md) and
[the review follow-up](2026-09-10-workflow-review-followup.md); this one does
not repeat their findings. Raw source — append only.

## Dispatches, as measured

| # | Task | Role | Engine / model | Prompt bytes | Outcome |
| --- | --- | --- | --- | ---: | --- |
| 1 | `b24-double-fault` | developer | agy / gemini-3.8-flash, medium | 46,840 | **Accepted** after independent verification. 125.8 s, 349,873 tokens. |
| 2 | `b24-double-fault-review` | adversary | claude / opus-5, high | 41,946 | **Accepted** — 4 minor findings. But it never saw the diff (F-A below). |
| 3 | `b23-runtime-deps-plan` | planner | codex / gpt-6-astra, medium | 27,931 | **Accepted**, and returned *blocked* rather than a plan — the correct outcome. |
| 4 | `cycle1-resources-plan` | planner | codex / gpt-6-astra | 27,990 | **Failed** — `You've hit your usage limit … try again at 9:05 PM`. |
| 5 | `cycle1-resources-plan` (retry) | planner | claude / opus-5, high | 27,990 | **Failed** — `You've hit your session limit · resets 7:40pm`. |
| 6 | `cycle1-resources-plan` (retry 2) | planner | claude / opus-5, high | 27,990 | **Accepted** — full plan, explicitly not blocked. |
| 7 | `cycle1-resources-planreview` | plan-adversary | agy / gemini-3.8-flash, high | 45,288 | **Rejected** — empty `SUCCESS` with `denied_actions: read_file`. 150.9 s, 262,605 tokens spent for nothing. |
| 8 | `cycle1-resources-planreview` (retry) | plan-adversary | claude / opus-5, high | 45,288 | Dispatched. |

**Four of eight dispatches needed conductor intervention**, three of them for
engine-availability reasons that had nothing to do with the prompt.

## What the sync demonstrably fixed

`extract-agy-result.mjs` turned dispatch 7 into a **non-zero exit**. Before the
sync, an empty `SUCCESS` with a denied action was returned as success and the
conductor had to notice the empty `response` field by eye — the failure mode the
resume report documented twice. It now fails loudly at the command level. That
is the clearest payoff from the sync, measured rather than assumed.

## F-A — a reviewer handed a commit range cannot see the diff

Dispatch 2 reviewed `524d2bb..d6c8195`. Its report opened by disclaiming that it
**never saw the diff**: the allowlist grants `Bash(git diff:*)`,
`Bash(git diff --stat:*)` and similar fixed forms, but nothing that matches
`git diff <sha>..<sha>`, and a conscientious reviewer refuses to run an
un-allowlisted variation rather than improvising. It reviewed post-change files
whole and inferred in-diff vs. pre-existing from commit subjects.

It still produced four valid findings, so this degrades quality quietly rather
than failing — the worst shape for a defect of this kind.

The `adversarial-review` skill already assigns computing and pasting the diff to
the conductor, so this was conductor error, now recorded in `gotchas.md`. But the
tooling makes the error easy and silent.

**Recommendation:** either allowlist a ranged `git diff` for read-only roles, or
give `build_worker_prompt` a `diff_range` parameter that embeds the computed diff
in the prompt as data. The second is better — it makes the diff present by
construction instead of relying on the conductor remembering.

## F-B — `denied_actions` names the action but not the target

Dispatch 7 reported `{"action": "read_file", "display_name": "ViewFile"}`. That
says a read was denied; it does not say **which path**, so the grant cannot be
fixed from the report. The remedy available to the conductor is to guess, or to
switch engines — I switched engines.

**Recommendation:** include the attempted path in `denied_actions`. Without it,
every agy denial costs a full re-dispatch on another engine.

## F-C — no engine fallback, and four of seven roles share one engine

`planner`, `researcher`, `reviewer` and `wiki-maintainer` all resolve to codex.
When codex hit its usage limit, **all four became undispatchable at once**, with
no signal until a dispatch had already been composed and run. The only remedy is
a manual per-dispatch `cli_engine` override, which the conductor has to think of.

This also silently blocks process work: the `/project:wiki` health pass the
findings backlog is waiting on (70 open against a `FINDINGS_MAX` of 40) runs on
`wiki-maintainer` → codex, so the backlog's only scheduled consumer was
unavailable for the same window.

**Recommendation:** (a) let a role declare an ordered engine fallback, and/or
(b) have `check` report per-engine availability so the conductor learns before
composing a 45 KB prompt. Failing fast here is worth more than retrying.

## F-D — the conductor must re-emit large context verbatim

Worktrees share no scratch, so a plan produced by the planner must reach the
plan-adversary and the developer as **inline text in `instructions`**. Dispatch 7's
prompt was 45,288 bytes, most of it a plan I had just received and had to
reproduce word-for-word through a tool call. The plan alone was roughly 8k tokens
pushed through the conversation for no reason other than transport.

**Recommendation:** add an `instructions_file` (or `context_file`) parameter so
the conductor can write the text to a file and pass a path. The MCP already owns
`.worktrees/.dispatch/<task>/`; it is the natural place. This is the single
largest token cost in the conductor's loop.

## F-E — `report_file` is null for claude but a path for codex/agy

Dispatch 2, 5, 6 and 8 (claude) returned `report_file: null`; dispatches 1, 3, 4
and 7 returned a real path. So the conductor keeps two retrieval paths: read the
backgrounded command's captured stdout for one engine, read `report.txt` for the
others. Minor, but it is per-engine special-casing in the one place the workflow
otherwise abstracts engines away.

## F-F — read-only is a promise, not a property, and verifying it is manual

The dispatch result for `plan-adversary` on agy warns that read-only cannot be
enforced below the prompt and instructs the conductor to run
`git status --porcelain` afterwards. I did, and the worktree was clean — the
promise held. But the MCP owns the worktree path and could check this itself at
dispatch teardown, rather than leaving a behavioral-rule guarantee to the
conductor's discipline.

**Recommendation:** have the MCP run that check for read-only roles and surface
the result in the dispatch response.

## F-G — worktrees accumulate with nothing pruning them

Eleven worktrees now exist. `prepare_worktree` never prunes, and
`remove_worktree` is manual, so nothing ever retires one. I verified by hand that
six were clean **and** their branches were ancestors of the integration branch —
i.e. provably holding nothing unique — which is a computable condition.

**Recommendation:** `prepare_worktree` could report sibling worktrees meeting
that condition, or `list_worktrees` could flag them. Not urgent; it is clutter
that makes "which checkout am I in?" harder than it should be, and a conductor
reusing a stale one is a real risk.

## F-H — structural: no worker can close a FreeCAD-dependent case

`freecadcmd` appears on no role's allowlist. Two cases this session
(rpc-transport B23's measurement, drawing-sheets B24's Layer 2 confirmation)
therefore cannot be verified by any worker — the conductor is the only Layer 2
runner. The planner correctly handed both back instead of pretending.

This is arguably correct design rather than a bug: FreeCAD runs are slow, stateful
and machine-specific. But it is load-bearing and undocumented, and it means every
`installed addon` case needs conductor time budgeted for verification.

**Recommendation:** state it in the `planner` and `developer` role text so a
worker plans for the handback from the start rather than discovering it.

## What worked well, and should not be changed

- **`cli_engine` override** was the escape hatch that saved two dispatches. Used
  twice, worked twice, and left role defaults untouched.
- **`prompt_bytes`** in every response made prompt cost visible at composition
  time; it is how F-D was quantified.
- **`prepare_worktree` reporting `base_sha` and `integration_branch`** let me
  confirm a worker's checkout contained a spec commit I had pushed seconds
  earlier, without inspecting the worktree.
- **Per-dispatch `owned_paths`** held: the developer in dispatch 1 stayed inside
  its three paths, verified by `git status` in the worktree.
