---
name: adversary
description: Point a read-only second model at the current change — dispatch the adversary over the diff with none of the author's context, dispose of every numbered finding in writing, and re-review only what was fixed. Per-change; /project:review is the periodic whole-repo audit.
argument-hint: [base ref or lens — e.g. "develop" | "against main" | "concurrency only"]
type: command
skills:
  adversary: [adversarial-review]
---

# /project:adversary

**Argument:** `$ARGUMENTS`

The argument **sets what gets reviewed** (step 1):

- **A base ref** (`develop`, `against main`, `HEAD~3`) → review `<ref>...HEAD`. With a ref, a clean tree is reviewable.
- **A lens** (`concurrency only`, `error handling`) → an emphasis on top of the full category sweep, never a narrowing of it: a sweep the author can shrink is one the author can steer. Pass it only as a category to weight — never as intent, rationale or a summary of what the change is for — and say in the report that a lens was applied.

Empty → the standard sweep over the unshipped change.

You run one adversarial review: the adversary raises findings and never edits; you dispose of them. The diff round of the `finding-disposition` skill is the procedure — what to send, triage, dispositions, the human gate, the round commit, re-review. The adversary's own sweep, severities and report format are `adversarial-review`, which only it receives.

**Use it** for a simple todo `/project:work` did not gate, for any change you are about to call done without having watched it written, and before promoting `develop` to `main`, over the release diff. It replaces neither `/project:review` nor writing the failing test first.

## Preconditions

- A diff exists: a dirty tree, unreviewed commits on this branch, or a base ref. None of the three → say there is nothing to review and stop.
- On a `feat`/`fix`/`chore` branch — an approved fix has to land somewhere, and never on `main`. **`develop` only for the release review** (`against main`), which is read-only by construction: an approved `critical`/`major` from it gets a `fix/*` branch, while the round's todo and log lines may land on `develop` directly (rule 19).

## Steps

1. **Scope it small.** In order:
   - **A base ref** → `<ref>...HEAD`.
   - **A dirty tree** → there is no range for uncommitted work: pass `git diff HEAD` as `context`, naming untracked files. If it builds on unpushed commits of the same task, commit it or widen to `<sha-before-them>...HEAD`.
   - **A clean tree with unreviewed commits** → the commits of one Behavior case, or a few closely related: `<sha-before-them>...HEAD`.

   Note the entity slug(s). A whole-branch range is the usual reason a review runs past three rounds; several small reviews beat one large one — review per entity, one dispatch each.

2. **Dispatch the `adversary`** per `worker-dispatch`, with `diff_range` (the MCP embeds the diff as data — the adversary's allowlist has no ranged `git diff`, and without it the review silently degrades to reading whole files), the entity slug(s), case IDs, the test command from `docs/wiki/commands.md`, and the lens if any. **Nothing else** — no plan, rationale or summary of intent. The compose response reports an empty or truncated diff before anything runs. `inspect_dispatch` must `pass` before the findings count, and an audit showing reads outside the worktree means the review may not be independent — say so if you use it.

3. **Dispose of every finding** per the skill: **Filed** by default, **Fixed** only for a human-approved `critical`/`major` (one `human-checkpoint` covering all of them) through the normal loop — failing test first, spec first if the finding contradicts the entity page — or **Rejected** with a reason. `triage` gives a second opinion; you decide. Record the counts with `record_decision` (`findings`, and `reviewed_task_ids` when the diff came from known dispatches).

4. **Re-review only if a fix landed**, with `diff_range` over the fix commits alone — re-reading the original range is what keeps rounds from converging. Three rounds maximum; the skill says what happens at the cap.

5. **Log, commit and push.** The skill's round commit (`docs(<slug>): adversary round N`, every disposition in its body; `--allow-empty` when all were rejected) carries the log entry, per [`log-and-commit.md`](../skills/feature-branching/log-and-commit.md): kind `adversary`, fields `Commit reviewed` (the sha, "+ dirty tree" if it was in scope), `Findings: <N> (<C> critical, <M> major, <m> minor)`, `Disposition: <Fi> filed, <Fx> fixed, <R> rejected`. Each approved fix is its own earlier commit, `fix(<slug>): <what> — adversary F<n>`. Most rounds have no fix commit, and that is the expected shape.

6. **Report** findings by severity — leading with any `critical`/`major` filed rather than fixed — what you filed and where it sits in the queue, what you fixed under approval, and each rejection with its reason, naming any the human might dispute.

## Failure modes

- **No findings and no `Checked:` line** → re-dispatch once demanding it; an unexplained pass is a failed review.
- **The adversary edits, commits or pushes** → the read-only invariant is broken and the round is void; report it.
- **A finding contradicts the entity spec** → the spec wins until the human changes it: Rejected, citing the Behavior case — or `/project:interview` if the spec is genuinely wrong.
- **Findings keep coming round after round** → the scope is too big. Stop at round three and split the range next time; never raise the cap.

## What you do NOT do

- **No adversary edits** — findings only.
- **No author context in the dispatch.** The case IDs are the brief.
- **No whole-repo audit.** Out-of-diff problems go in the report's `## Out of scope` list and, if they matter, a todo for `/project:review`.
- **No merging, no PR** — `/project:work` owns the PR.
