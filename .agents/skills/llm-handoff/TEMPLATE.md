<!--
TEMPLATE — not the handoff file itself.

Copy this file to `.claude/handoff/<slug>-handoff.md`, replace every `{{PLACEHOLDER}}`
with real content, and delete this comment block. The `llm-handoff` skill is the
procedure; this is the artefact it produces.

Every `{{...}}` must be gone before the file ships. A surviving placeholder is a
hole the external agent will fill by guessing.
-->

# Implementation Handoff — {{TITLE}}

**Prepared:** {{DATE}} · **Slug:** `{{SLUG}}` · **This file:** `{{HANDOFF_PATH}}`

## 0. How to use this file

You are an autonomous software agent. **This file is your complete brief.** There is no other prompt, no chat history, and no one to ask for the parts that seem missing — everything you need to do the job correctly is written below, including the project's rules, spec, conventions, and commands. Read all of it before you touch anything.

- You are working in a checkout of this project's git repository. **You will not work in that checkout directly** — Step 2 creates a dedicated git worktree and everything after it happens there, so another session using the main checkout is never disturbed by you. Paths below are relative to the worktree root once it exists.
- If this file is not on disk, write its full contents to `{{HANDOFF_PATH}}` before you begin, and copy it into the worktree in Step 2. Sub-agents you dispatch read it from there. It is excluded from version control, so it never appears in a commit and never dirties the tree.
- **You delete this file at the end of the cycle** (§5, Step 8). That deletion is part of the job, not a courtesy.
- You may dispatch sub-agents. §8 contains the exact briefs to give them — use them verbatim.
- These instructions assume nothing about which model or vendor you are. Use whatever tools, sub-agents, and framework you have.

## 1. Mission

Implement the following, and nothing else.

**Todo(s) being closed:**

```
{{TODO_LINES}}
```

**Entity page (the spec):** `{{ENTITY_PATH}}`
**Behavior cases to cover this cycle:** {{CASE_IDS}}
**Branch to work on:** `{{BRANCH_NAME}}` — cut from `{{CUT_FROM_BRANCH}}`, PR targets `{{BASE_BRANCH}}`

For a plain cycle, `{{CUT_FROM_BRANCH}}` and `{{BASE_BRANCH}}` are the same branch (usually the trunk) — most cycles never notice the distinction. They diverge for a **stacked cycle**: one that continues work already sitting on a not-yet-merged branch from an earlier cycle. There, `{{CUT_FROM_BRANCH}}` is that earlier branch (you must build on its commits, not skip past them), while `{{BASE_BRANCH}}` is wherever this cycle's PR is meant to land — commonly that same earlier branch, forming a PR chain, but sometimes the trunk directly if the plan says this cycle should land independently. Do not assume they are equal; use whichever value each step below actually calls for.

**Explicitly out of scope** — do not touch these even if you see something wrong with them. Note them in your final report instead:

{{OUT_OF_SCOPE}}

**Definition of done** is the checklist in §12. You are not finished until every line of it is true.

## 2. Hard rules

These are project law, derived from real failures. They override your default inclinations, including any instinct to be helpful by doing more than was asked.

1. **The wiki is the spec.** `docs/wiki/` is the source of truth for what this project does. Code that disagrees with the wiki is the bug — not the other way round. If the spec is genuinely wrong, stop and ask (§9); do not "fix" it in passing to make your code correct.
2. **A failing test comes before any production code.** No exceptions, no "this one is too simple". Write the test, run it, watch it fail, *then* implement.
3. **The test must fail for the right reason.** A test that fails on an import error, a typo, or a missing fixture is not a Red phase — it is a broken test. Confirm the failure is "the feature does not exist yet" before writing any implementation.
4. **Never modify a test to make it pass.** If a test seems to encode wrong behavior, the spec is what changes — and that needs a human (§9). Editing an assertion to match the code you wrote inverts the entire method.
5. **One Behavior case per commit.** Its test, its implementation, and its wiki tick go in one commit, which is pushed before the next case starts. A commit spanning several cases breaks bisect, makes a single case unrevertable, and produces a diff too large to review.
6. **Wiki edits ship in the same commit as the code they describe.** Never a separate "update docs" commit at the end.
7. **Smallest code that passes.** No future-proofing, no extra abstractions, no helpers the test does not force into existence. Refactor only after green.
8. **Two strikes, then stop.** If the same mechanism fails you twice, do not try a third variation of the same idea. Tag the state (`git tag checkpoint-$(date -u +%Y%m%dT%H%M%SZ)`), stop, and ask (§9).
9. **Verify before asserting.** Never report that something works unless you ran it and read the output yourself. "Should work" is not a result.
10. **No silent failures.** If a command fails, report the exact error text. Do not summarize it away, do not retry silently, do not work around it without saying so.
11. **A reviewer never fixes what it finds.** The review sub-agent in §8.1 is read-only: it produces findings, it does not edit, commit, push, or reset. You triage; it reports. If it edits anything, the round is void — restore the tree and re-run it.
12. **Every finding gets a written disposition.** Fixed, Filed, or Rejected-with-a-reason. Silence is not a disposition and "unlikely" is not a reason. The dispositions go in commit messages (§5, Step 5).
13. **Never edit anything under `docs/raw/`.** Those files are immutable source material. Append-only, and not by you.
14. **Never commit to `{{CUT_FROM_BRANCH}}`, `{{BASE_BRANCH}}`, or `main`, and never force-push anything** — not `--force`, not `--force-with-lease`, not even your own branch. All work lands on `{{BRANCH_NAME}}`, and Step 7 syncs by merging `{{CUT_FROM_BRANCH}}` in, which never rewrites published history. If you think you need a force-push, you have gone off the procedure: stop and ask (§9).
15. **A dirty tree you did not dirty belongs to someone else.** Before any destructive git operation, run `git status --porcelain` and account for every line. If a path is not one you touched, it is evidence, not dirt — stop and ask (§9). Never `stash`, `reset --hard`, `checkout --`, or `clean` over changes whose author you cannot name.
16. **Push every commit.** An unpushed commit is lost work — execution containers get recycled. `git push -u origin {{BRANCH_NAME}}` after each one.
17. **Delete this file when you are done** (§5, Step 8) and tell the user you have finished (§10).

## 3. Project context

Everything in this section is copied from the project's wiki. It is here so you do not have to go looking. If you do read the repo's own copies and they disagree with what is written here, **the repo wins** — say so in your final report.

### 3.1 What this project is

{{PROJECT_SUMMARY}}

### 3.2 Requirements that bear on this work

{{REQUIREMENTS_EXCERPT}}

### 3.3 Architecture and testing strategy

{{ARCHITECTURE_EXCERPT}}

### 3.4 Known gotchas — read these before you debug anything

{{GOTCHAS_EXCERPT}}

### 3.5 Commands

Copy-pasteable, verified to work in this repo.

| Purpose | Command |
| ------- | ------- |
| Install | `{{INSTALL_CMD}}` |
| Test (the canonical one — use this for Red and Green) | `{{TEST_CMD}}` |
| Lint | `{{LINT_CMD}}` |
| Format | `{{FORMAT_CMD}}` |
| Build | `{{BUILD_CMD}}` |

Run the test command once, before anything else, to confirm it works and the suite is currently green. If it errors out or there are pre-existing failures, **stop and ask** (§9) — do not build on top of a broken suite.

### 3.6 Related wiki material

{{RELATED_WIKI_EXCERPTS}}

{{PLAN_SECTION}}

## 4. The spec

This is the entity page at `{{ENTITY_PATH}}`, reproduced verbatim. Its `## Behavior` section is the contract: each case is one observable behavior, and each becomes exactly one test.

{{ENTITY_PAGE_VERBATIM}}

### Behavior case states

Each case carries one of three states. You flip them as you work, and the transitions are one-way — a case never moves backwards.

| State | Meaning | Set when |
| ----- | ------- | -------- |
| `[ ]` | Defined, no test yet | — |
| `[~]` | Test exists and is confirmed failing | You confirm Red |
| `[x]` | Test passes | You confirm Green, in the commit that lands the case |

If behavior genuinely changed and a shipped (`[x]`) case is now wrong, do not edit it in place. That is a spec change and needs a human (§9).

## 5. The procedure

### Step 1 — Preflight

```bash
git fetch origin {{CUT_FROM_BRANCH}}
git log --oneline -1 origin/{{CUT_FROM_BRANCH}}
```

Read §3.4 (gotchas) now, not after you get stuck.

You do **not** need the main checkout to be clean, and you must not tidy it: your work happens in a worktree cut straight from `origin/{{CUT_FROM_BRANCH}}`, so whatever state that checkout is in is somebody else's business (rule 15). If the fetch fails, stop and ask (§9).

### Step 2 — Create your worktree

A worktree is a second working directory backed by the same repository — same branches, same remotes, same object store, but its own checked-out files. Working in one means you never touch the main checkout.

```bash
git worktree add {{WORKTREE_PATH}} -b {{BRANCH_NAME}} origin/{{CUT_FROM_BRANCH}}
cd {{WORKTREE_PATH}}
```

If `{{BRANCH_NAME}}` already exists (an earlier attempt at this same handoff), do not recreate it: `git worktree add {{WORKTREE_PATH}} {{BRANCH_NAME}}` instead, and resume from the first Behavior case still unticked on the entity page. A branch you did not create and cannot account for → stop and ask (§9).

Everything from here on runs **inside `{{WORKTREE_PATH}}`**. Two things do not come across, because git does not copy ignored files into a new worktree:

```bash
mkdir -p .claude/handoff
cp <path to this brief in the main checkout> {{HANDOFF_PATH}}   # so sub-agents can read it
{{INSTALL_CMD}}                                                 # dependencies are ignored too
```

Then confirm the brief is actually ignored here, rather than assuming it:

```bash
git check-ignore -v {{HANDOFF_PATH}} && git status --porcelain
```

`.gitignore` is tracked, so it normally applies in the worktree exactly as in the main checkout — but only if the branch you cut from carries the rule. If `check-ignore` finds no match, or `git status` shows the brief as untracked, **do not commit it and do not add an ignore rule for it**: move the brief back out of the worktree, keep it wherever you can read it from, and pass its absolute path to sub-agents instead. An untracked brief left in place will fail the clean-tree check in Step 8 and get committed by accident.

Now run the test command from §3.5 and confirm the suite is green **before you change anything**. If it does not run, or there are pre-existing failures, stop and ask (§9) — do not build on a broken suite.

### Step 3 — The loop, once per Behavior case

Run this in full for **one** case, commit and push it, then start the next case. Do not batch: five tests, then five implementations, then one commit is the single most common way this cycle goes wrong.

**Red.**

1. Write **one** focused test for the case in hand, named so it maps back to the case ID (e.g. case B2 → `test_login_fails_with_unknown_email`).
2. Run the test command from §3.5. Confirm the new test fails.
3. Confirm *why* it fails. "The feature does not exist" is the only acceptable reason. An import error, a typo, or a fixture problem means the test is broken — fix it and re-run until the failure is genuine (rule 3).
4. Flip the case from `[ ]` to `[~]` on the entity page.

**Green.**

1. Write the smallest code that makes that test pass (rule 7).
2. Re-run the full test command. The new test passes and **no previously-passing test now fails**.
3. If you broke something else, you over-reached. Revert, narrow the change, retry.

**Refactor** — only once green.

1. One structural change at a time (extract, rename, collapse duplication).
2. Re-run the tests after each. Stay green.
3. Stop at "good enough for this case". Do not refactor neighboring code you were not sent here to touch.

**Wiki, in the same change.**

1. Flip the case `[~]` → `[x]` on the entity page.
2. Update the entity page's `## Implementation` section with the files you actually touched, and `## Tests` with the case-to-test-name mapping.
3. Bump the page's `updated:` frontmatter to today's date.
4. If you got burned by something non-obvious that will burn the next agent too, add a line to `docs/wiki/gotchas.md` (§7.4) in this same commit.

**Commit and push.**

```bash
git add <the test> <the implementation> {{ENTITY_PATH}}   # explicit paths, never -A or -a
git add docs/wiki/gotchas.md                              # only if this case produced one (§7.4)
git commit -m "feat({{SLUG}}): <the behavior, present tense, <=72 chars>"
git push -u origin {{BRANCH_NAME}}
```

Then go back to Red for the next case.

### Step 4 — Self-review

Once all the cases in §1 are `[x]`, get a second reader on the diff before you call it done. Dispatch a **fresh sub-agent** using the brief in §8.1 verbatim.

The independence is the entire value, so:

- Give it **only** what §8.1 says to give it: the commit range, the case IDs, the mailbox path, and the test command.
- Give it **nothing** about your reasoning, your approach, what the change is "supposed" to do, or what you found hard. Every sentence of your framing you leak turns the reviewer into a rubber stamp.
- Keep the range small — the cases from this cycle, not the whole branch. A large diff yields many findings, the fixes enlarge it, and the next round finds more.

It writes numbered findings to `.claude/handoff/{{SLUG}}-findings.md`. If it comes back with nothing and does not say what it checked, re-dispatch it once with that instruction: an unexplained pass is a failed review.

### Step 5 — Triage every finding

Each finding ends in exactly one disposition. The default is **Filed**, not Fixed — a review files work, it does not do work.

| Severity | Meaning | What you do with it |
| -------- | ------- | ------------------- |
| `critical` | Data corruption, secret exposure, or a wrong result on a normal path | **Stop and ask the user** (§9) before touching it |
| `major` | Wrong result on an edge path, or a test that does not test its behavior | **Stop and ask the user** (§9) before touching it |
| `minor` | Real but contained — poor error message, narrow missing validation | File as a todo. Do not fix it in this cycle |
| `nit` | Style, naming, comments | Not filed at all. Count them and move on |

- **Filed** — append a line to `docs/wiki/todos.md` in the format at §7.3, in the section its severity maps to (`critical` → P0, `major` → P1, `minor` → P2). File it even if the fix looks like two lines: a two-line fix is still a change nobody reviewed, made outside the test-first loop.
- **Fixed** — only for a `critical` or `major` the user explicitly approved fixing now. Its own commit, failing test first.
- **Rejected** — one sentence of reason. Legitimate: the scenario cannot occur given a documented invariant (cite it), the finding misread the code (say what it missed), it is outside this entity's Behavior cases. Not legitimate: "unlikely", "we can fix that later" (that is Filed), or saying nothing. **If you reject a finding by citing an invariant that is not written down anywhere, write it down** — into the entity page or `docs/wiki/gotchas.md` — as part of the rejection.

Close the round with one commit whose body is the record:

```bash
git add docs/wiki/todos.md
git add docs/wiki/gotchas.md {{ENTITY_PATH}}   # only if a rejection made you write down an invariant
git commit -m "$(cat <<'MSG'
docs({{SLUG}}): adversary round 1 — 3 findings, 1 fixed, 1 filed, 1 rejected, 2 nits

F1 critical correctness — Fixed in <sha> (user approved): empty token now
   rejected before lookup.
F2 minor durability — Filed P2: retry loop is unbounded on a 5xx.
F3 minor test-integrity — Rejected: the boundary is covered by the integration
   test in tests/integration/test_auth.py; narrowing the mock would duplicate it.
Nits: 2 (naming x1, stale comment x1) — not filed.
MSG
)"
git push
```

Every finding gets a line, filed ones included — the todo says what to do, the commit says why it was not done now.

**Use the literal words `adversary round` in that subject.** This project audits review records with `git log --grep="adversary round"`. Any other phrasing — `review round` included — leaves the dispositions in history but invisible to the one query that reads them back, which is the same failure mode as filing a finding under the wrong tag (§7.3).

If the round produced neither a fix nor a todo, commit with `--allow-empty`: a round that changed nothing is precisely the one whose reasons must survive.

**Re-dispatch only if a fix actually landed**, and then over the fix commits alone — never the original range, which is how a review manufactures fresh findings every round. **Two rounds maximum.** If findings survive round two, the unit was too big: stop and ask (§9) rather than opening round three.

Finally, delete the findings mailbox: `rm -f .claude/handoff/{{SLUG}}-findings.md`. It is scratch; the dispositions live in the commits now.

### Step 6 — Finish the wiki

1. Run the **full** test suite one more time and read the output. Green, no skips you introduced.
2. Run the lint and format commands from §3.5 if the project has them.
3. Confirm every case in §1 is `[x]` on the entity page, and that `## Implementation` and `## Tests` match reality.
4. Remove **only** the specific line(s) from `docs/wiki/todos.md` that this cycle actually closed — the ones matching `{{TODO_LINES}}` and `{{CASE_IDS}}`, nothing else. If a todo is a multi-part item and this cycle closed only some of its parts, remove just those closed sub-lines and leave the still-open parts in place; never remove the parent line, or the item as a whole, while sibling parts remain open. Shipped work lives in git history, not in the queue — but only the part that actually shipped.
5. Append a log entry to `docs/wiki/log.md` in the format at §7.5.
6. Commit and push:

```bash
git add docs/wiki/todos.md docs/wiki/log.md
git commit -m "docs({{SLUG}}): log cycle"
git push
```

### Step 7 — Sync and open the pull request

```bash
git fetch origin {{CUT_FROM_BRANCH}}
git merge origin/{{CUT_FROM_BRANCH}}     # resolve conflicts if any; ask if they are ambiguous
{{TEST_CMD}}                             # the merge can bring in breakage — re-verify
git push origin {{BRANCH_NAME}}
```

Merge in `{{CUT_FROM_BRANCH}}` — the branch you actually cut from and must stay in sync with, which for a stacked cycle is not necessarily where the PR lands. Do **not** rebase. A merge commit leaves every published commit untouched, so this push is an ordinary fast-forward and no force-push is ever needed. Rebasing would rewrite commits you have already pushed and invalidate anyone else's checkout of this branch.

Then open a pull request from `{{BRANCH_NAME}}` targeting **`{{BASE_BRANCH}}`** — the PR-target value from §1, which may differ from `{{CUT_FROM_BRANCH}}` on a stacked cycle — using the body format in §7.6. Title in the same conventional-commit form as your lead commit.

**Do not merge it.** Merging is the user's call, always.

If you have no way to open a pull request from your environment, push the branch, put the drafted body in your final report, and say plainly that opening it is left to the user.

### Step 8 — Clean up and hand back

1. Confirm the tree is clean and everything is pushed:

   ```bash
   git status --porcelain      # must print nothing
   git log --oneline origin/{{BASE_BRANCH}}..HEAD
   ```

   That log must read as one commit per Behavior case, not one lump. If it does not, say so in your report — do not rewrite history to hide it.

2. **Delete this handoff file:**

   ```bash
   rm -f {{HANDOFF_PATH}}
   ```

   It is excluded from version control, so nothing further is needed. If `git status` shows the deletion of a *tracked* file, commit it: `git commit -m "chore({{SLUG}}): remove handoff file"` and push.

3. Delete any other scratch you created under `.claude/handoff/`.

4. **Remove your worktree.** Everything is pushed, so the directory is disposable:

   ```bash
   cd <the main checkout>
   git worktree remove {{WORKTREE_PATH}}
   ```

   If git refuses with *"contains modified or untracked files"*, **do not pass `--force`.** That message means something is in there that is not in a commit — build artifacts and installed dependencies usually, but possibly work you did not push. Say so in your report and leave the directory for the user to inspect and delete. A forced removal that quietly discards real work is not cleanup.

5. **Tell the user you have finished**, using the report format in §10. This is the last thing you do.

## 6. Git conventions

**Branch naming** — `<type>/<short-slug>`, kebab-case, ≤ 4 words, slug matching the entity slug. Types: `feat` (new capability), `fix` (bug), `chore` (tooling, deps, CI), `docs`, `refactor` (no behavior change), `test`, `perf`.

**Commit format** — conventional commits, present tense:

```
<type>(<scope>): <one-line summary>

<optional body — what and why, not how>

<optional footer>
```

- `type` from the same vocabulary as branches; `scope` is the entity slug (`{{SLUG}}` here).
- Subject ≤ 72 characters, no trailing period.
- Body wraps at 72.

**Cadence**

- One commit per Behavior case: test + implementation + entity-page tick together.
- Refactor commits are separate from feature commits.
- Never commit half-green code.
- Always push after committing.

**Staging** — always by explicit path. Never `git add -A`, never `git commit -a`, never `git add -p` (interactive mode hangs when there is no human at the prompt).

**Force-push** — never, in any form, on any branch. The sync in Step 7 is a merge, so published history is never rewritten and an ordinary push always suffices. If you reach a state where a force-push looks necessary, stop and ask (§9) rather than reaching for it.

**Worktrees** — you work in one (Step 2). It shares the repository's branches, remotes, and objects with the main checkout, so a commit or push from inside it is visible everywhere immediately. Two consequences: a branch checked out in one worktree cannot be checked out in another, and ignored files (dependencies, this brief) exist per-directory and are not carried across.

**History** — do not squash locally, and do not rebase. The red-green-refactor sequence is the evidence the loop was actually run.

**Merge conflicts** — resolve the markers, then grep the tree for leftover `<<<<<<<`, `=======`, `>>>>>>>` before continuing. Run the full suite after resolving. If both sides changed the same logic and picking either loses behavior, stop and ask (§9).

## 7. The wiki edits you must make

Wiki pages use Obsidian conventions. Three rules matter for what you will touch:

- Internal links are `[[wiki-style]]` — `[[entities/{{SLUG}}]]`, `[[gotchas]]`, `[[concepts/retry-pattern|alias]]`. A broken wikilink is a bug. Links to files outside `docs/wiki/` (source files, config) use ordinary markdown links.
- Frontmatter is flat — no nested objects. Wikilinks inside frontmatter are quoted and solitary: one `"[[page]]"` per list element.
- Never invent content to fill a gap. If something is genuinely unknown, add it to the page's `open_questions` list or ask (§9).

### 7.1 The entity page — `{{ENTITY_PATH}}`

Tick the Behavior cases as you go (§4), keep `## Implementation` and `## Tests` accurate, bump `updated:`. This page ships in the same commit as the code it describes.

### 7.2 New wiki pages

You probably need none. If the work forces a genuinely new concept, check first whether it already exists under another name (`grep -r "aliases:" -A3 docs/wiki/`) — one page, one concept. If you find yourself needing more than a single new page, that is cross-page work: append a one-line note to `docs/wiki/wiki-todos.md` for the project's maintenance pass instead of doing it here.

### 7.3 `docs/wiki/todos.md`

Remove only the line(s) you actually closed this cycle — if the todo is multi-part and parts remain open, leave the parent line and the open parts untouched (§6, Step 6.4). Add one line per filed finding, in the section its severity maps to:

```markdown
- [ ] [adversary] <one-line claim> — <severity>/<category>, F<N> of <sha>, entity {{SLUG}}
```

The `[adversary]` tag is not decorative: this repo's findings-backlog saturation counter (`FINDINGS_MAX`) greps for the literal string `[adversary]`. Any other tag — `[review]` included — makes the finding invisible to that counter and lets the backlog silently over-fill.

### 7.4 `docs/wiki/gotchas.md`

Only for a project-specific trap that will bite the next agent — something non-obvious you actually hit. Not general programming advice. One entry: what happened, what the symptom looked like, what to do instead. Same commit as the work that discovered it.

### 7.5 `docs/wiki/log.md`

Append at the end (the file is chronological and append-only):

```markdown
## [YYYY-MM-DD HH:MM] work — {{SLUG}}

- TODO(s): {{TODO_SUMMARY}}
- Cases: {{CASE_IDS}}
- Branch: {{BRANCH_NAME}}
- Adversary: <N> findings — <F> filed, <X> fixed, <R> rejected
```

Add a second entry after the pull request exists:

```markdown
## [YYYY-MM-DD HH:MM] pr — {{SLUG}}

- Branch: {{BRANCH_NAME}}
- PR: <url>
```

### 7.6 Pull request body

```markdown
## Summary

<1–3 bullets: what shipped, in observable terms>

## Behavior cases closed

[[entities/{{SLUG}}]] — {{CASE_IDS}}

## Related TODOs

- Closed: <the todo line(s) from §1>
- Follow-ups queued: <the findings you filed, if any>

## Test plan

- [ ] `{{TEST_CMD}}`
- [ ] Manual: <if any non-automated check applies>

## Notes

<non-obvious decisions, anything you deviated on and why>
```

Link the entity **page** and list the case IDs as plain text. Behavior cases are list items, not headings, so `[[entities/{{SLUG}}#B1]]` resolves to nothing and counts as a broken link.

## 8. Sub-agent briefs

### 8.1 The reviewer — use this text verbatim

Dispatch a fresh sub-agent with no prior context. Point it at your worktree (`{{WORKTREE_PATH}}`) as its working directory, give it read access there and the ability to run the test command, and give it this brief and nothing else:

> You are a read-only adversarial reviewer. You review and report; you never edit files, commit, push, or reset the tree. Doing so voids the review.
>
> Start by running `git rev-parse HEAD` and `git status`, and anchor every finding to that commit.
>
> **Scope:** `git diff <RANGE>` — this is the only code you are reviewing.
> **What it claims to do:** the Behavior cases <CASE_IDS> on `<ENTITY_PATH>`. Read that page; it is the contract. Score findings against the spec, not against taste.
> **Also read:** `docs/wiki/gotchas.md` — the author was expected to know these.
> **Test command:** `<TEST_CMD>` — you may run it.
>
> Sweep all six categories, in this order. Depth is never reduced; the write-up length is:
>
> 1. **correctness** — wrong branch taken, off-by-one, silent null, swallowed exception, error path returning success, a Behavior case not actually implemented.
> 2. **concurrency** — shared mutable state, non-atomic read-modify-write, check-then-act, unawaited work, lock ordering, assumptions of single-threaded execution.
> 3. **durability** — partial write with no rollback, lost update, unbounded retry, non-idempotent handler, migration with no down path, data written before validation.
> 4. **security** — unvalidated input crossing a trust boundary, injection (SQL/shell/template), secret in code or logs, missing authorization check on a new path, unsafe deserialization.
> 5. **test-integrity** — a test asserting nothing, a tautological assertion, a mock so wide the real boundary is untested, a test that would pass without the implementation, a missing case for a behavior marked done.
> 6. **other** — dead code, a stale documentation claim inside this diff, a misleading name, a comment that contradicts the code.
>
> Grade each finding `critical` (data corruption, secret exposure, or a wrong result on a normal path), `major` (wrong result on an edge path, or a test that does not test its behavior), `minor` (real but contained), or `nit` (style, naming, comments). If you are unsure between `critical` and `major`, take the lower one. If you are unsure whether something is a nit, it is a `minor`.
>
> Write your findings to `<MAILBOX_PATH>` in exactly this format:
>
> ```markdown
> # Findings — <SLUG>
>
> **Commit:** <sha>
> **Scope:** <the range you reviewed>
> **Checked:** <one line per category swept, so that a clean pass is still reviewable>
>
> ## F1 — critical — correctness — <one-line claim>
>
> **Where:** `path/to/file:42`
> **What's wrong:** <2–3 sentences; the mechanism, not a vibe>
> **Failure scenario:** <concrete inputs, state, or interleaving → wrong output or crash>
> **Confidence:** high | medium | low
>
> ## F2 — minor — durability — <one-line claim, with the location. No scenario, no patch.>
>
> ## Out of scope
>
> - <pre-existing problems outside this diff>
>
> Nits: <count> (<naming x2, stale comment x1>)
> ```
>
> Write-up length by severity: `critical` and `major` get the full form above with a concrete failure scenario, because a human is about to be interrupted to decide whether to fix it now. `minor` gets one line — claim and location only. `nit` is not written up at all, only counted in the tally line.
>
> Findings are hypotheses with a failure scenario attached, not verdicts. Do not propose patches, do not restate the diff back, and do not pad the list — a report of three real findings beats twenty speculative ones. If you find nothing, say what you checked; an unexplained pass is a failed review.

Replace `<RANGE>`, `<CASE_IDS>`, `<ENTITY_PATH>`, `<TEST_CMD>`, `<MAILBOX_PATH>` (`.claude/handoff/{{SLUG}}-findings.md`), and `<SLUG>` with the real values. Replace nothing else, and add nothing else.

### 8.2 Other sub-agents

You may dispatch sub-agents for read-only exploration (finding where something lives, surveying naming conventions) whenever it saves you time. Two constraints:

- **You own the test-first loop.** Do not hand "write the test" to one agent and "write the code" to another — the discipline in §5 Step 3 depends on the same actor confirming Red and then implementing against it.
- **A reviewing agent never fixes.** If you dispatch any agent to critique, it reports; you decide (rule 11).

## 9. When to stop and ask the user

Stop **before** acting, not after. Do not keep editing files while you wait, and do not start a "meanwhile" branch.

Stop for:

- A `critical` or `major` review finding (§5, Step 5) — batch them into one ask, do not interrupt per finding.
- A test that appears to encode wrong behavior. The spec changes, not the test — and that is not your call.
- The same mechanism failing twice (rule 8).
- A design fork the spec does not pre-decide, where you would genuinely argue for either option.
- Green requiring changes outside the scope in §1.
- A dirty tree with changes you did not make (rule 15), or an ambiguous branch state.
- The test command not running, or the suite already failing before you started.
- A merge conflict where both sides changed the same logic and either choice loses behavior.
- Anything irreversible or outward-facing: deleting files you did not create, force-pushing a shared branch, touching a third-party service, changing credentials.

Ask in this shape:

```
**Why I'm stopping:** <one line>

**Context:**
- <fact 1>
- <fact 2>

**Options:**
1. <Option A> — <one-line tradeoff>
2. <Option B> — <one-line tradeoff>

**My recommendation:** <which, and one line of why>

**What I need:** <pick an option, or give a different direction>
```

**Do not stop** for things this file already answers, or for confirmation of a decision you would make anyway. "Should I write the test first?" is answered by rule 2. If you have a recommendation and would argue against the alternative, that is not a fork — say what you are doing in one line and do it. Branches and commits are cheap to undo.

If you cannot reach the user at all: file the blocked item as a todo at the priority its severity maps to, say so prominently in your final report, and stop. Do not proceed past a `critical` on your own authority.

## 10. Your final report

The last thing you do, after deleting this file. Keep it factual — this is the user's only view of what happened.

```
## Handoff complete — {{SLUG}}

**Branch:** {{BRANCH_NAME}} (pushed)
**Pull request:** <url, or "not opened — <reason>">
**Behavior cases closed:** <list, matching {{CASE_IDS}}>

**Commits:**
<git log --oneline output for the branch>

**Tests:** <the exact command you ran, and its result — counts, not adjectives>

**Review:** <N> findings — <F> filed, <X> fixed, <R> rejected, <n> nits
<one line per critical/major, and what was decided about it>

**Filed for later:** <the todo lines you added, or "none">

**Deviations:** <anything you did differently from this brief, and why — or "none">

**Not done:** <anything in scope you could not finish, and what is blocking it — or "none">

**Handoff file deleted:** yes
```

Report failures as failures. If tests fail, say so and paste the output. If you skipped a step, say which. Do not describe partial work as complete.

## 11. Anti-patterns

Each of these has actually happened on this project.

- **Writing the implementation first and the test after.** It produces a test shaped to the code you already wrote, which asserts that your bugs are correct.
- **Editing an assertion so it passes.** Forbidden outright (rule 4).
- **Calling a test "Red" without reading why it failed.** An import error is not a Red phase.
- **Batching commits.** One commit at the end instead of one per case.
- **`git add -A` / `git commit -a`.** Sweeps in scratch files, editor droppings, and other sessions' work.
- **Refactoring neighboring code because you were passing through.** Out of scope is out of scope; file it (§7.3).
- **Widening the change to fix something you noticed.** Same answer: file it.
- **Leaking your intent into the review dispatch.** Pasting your plan or "here's what I was going for" turns the reviewer into a rubber stamp. The case IDs are the whole brief.
- **Letting the reviewer fix things.** It raises, you decide (rule 11).
- **Fixing a finding because it is small.** A `minor` that takes two lines is still filed. "While I'm here" is how a review becomes an unplanned refactor outside the test-first loop.
- **Fixing a `critical` without asking.** That is a scheduling decision, and it is not yours.
- **Absorbing findings silently.** Filing three and ignoring two with no written reason makes the whole review theatre.
- **Re-reviewing the whole diff each round.** The fixes made it bigger, so round two finds new surface and you never converge.
- **Working in the main checkout instead of your worktree.** The whole point of Step 2 is that another session may have that checkout open on another branch. Changing what it has checked out under it is the rudest thing you can do here.
- **Rebasing to get a tidy history, then force-pushing.** It rewrites commits you already published and breaks every other checkout of the branch. Merge instead (Step 7).
- **Forcing the worktree removal.** `--force` on a refusal discards whatever was uncommitted in there, which is the one case where the refusal was worth reading.
- **A separate "update docs" commit at the end.** Wiki edits ride with the code (rule 6).
- **Leaving a ticked-off todo in `todos.md`.** Closed items are removed; git history is the record.
- **Removing a whole multi-part todo because one part closed.** Only the part(s) this cycle actually shipped come out; siblings that are still open stay in the queue (§6, Step 6.4).
- **Filing a finding under `[review]` or any tag other than `[adversary]`.** The backlog saturation counter greps for the literal string `[adversary]`; anything else is invisible to it (§7.3).
- **Inventing wiki content to fill a gap.** `open_questions`, or ask.
- **Reporting success you did not verify** (rule 9).
- **Finishing without deleting this file** (rule 17).

## 12. Definition of done

Every line must be true before you write your report.

- [ ] Every Behavior case in {{CASE_IDS}} has one focused test, which was confirmed failing before its implementation existed.
- [ ] Every one of those cases is `[x]` on `{{ENTITY_PATH}}`, with `## Implementation` and `## Tests` accurate and `updated:` bumped.
- [ ] The full test suite passes, and you read the output yourself.
- [ ] Lint and format pass (if this project has them).
- [ ] `git log` on the branch reads as one commit per case, each pushed.
- [ ] A review round ran (§5, Step 4) and every finding has a written disposition in a commit body whose subject contains the literal words `adversary round`.
- [ ] Every `critical`/`major` finding went to the user before anything was done about it.
- [ ] Only the todo line(s) this cycle actually closed removed from `docs/wiki/todos.md` — any still-open sibling parts of a multi-part item left in place; filed findings added with the `[adversary]` tag.
- [ ] `docs/wiki/log.md` has the `work` entry, and the `pr` entry if a pull request was opened.
- [ ] `{{CUT_FROM_BRANCH}}` merged into the branch, tests re-run after the merge, and pushed.
- [ ] Pull request open against `{{BASE_BRANCH}}` (the PR-target value, not necessarily `{{CUT_FROM_BRANCH}}`) and **not merged**.
- [ ] No force-push was used at any point.
- [ ] `git status --porcelain` prints nothing.
- [ ] `{{HANDOFF_PATH}}` is deleted, along with any other scratch under `.claude/handoff/`.
- [ ] The worktree is removed — or, if git refused without `--force`, it is left in place and your report says why.
- [ ] The user has been told, in the format at §10.
