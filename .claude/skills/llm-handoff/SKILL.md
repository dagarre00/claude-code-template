---
name: llm-handoff
description: How to build a self-contained handoff file that delegates a todo to an external, non-Claude LLM agent — what to inline from the wiki, how to fill the template, and how to verify the file survives having zero context. Use when delegating work to an outside agent, another vendor's CLI, or any model that cannot see this repo's commands, skills, or rules. Trigger on "handoff", "hand off this todo", "delegate to another LLM", "external agent", "outsource this todo", "prompt for another model", "give this to Codex/Gemini/another agent".
type: skill
---

# LLM Handoff — Packaging a Todo for an Outside Agent

Produces `.claude/handoff/<slug>-handoff.md`: one file that contains everything an external agent needs to implement a todo under this project's rules — spec, conventions, commands, procedure, review protocol — and nothing it needs to go looking for. The external agent branches, works test-first, commits per case, pushes, opens a PR, deletes the file, and reports back.

**The orchestration stays here.** You pick the work, you write the brief, you review the PR. What you delegate is the execution, not the judgement about what should be executed.

## Read first

- `docs/wiki/todos.md` — the queue you are picking from.
- The entity page for the todo: `docs/wiki/entities/<slug>.md` (or `docs/wiki/concepts/<slug>.md` for `[infra]` work). **No entity page → no handoff.** Stop and recommend `/project:interview`.
- `docs/wiki/commands.md` — the test command must be real and runnable, not `<TBD>`.
- `docs/wiki/gotchas.md`, `docs/wiki/architecture.md`, `docs/wiki/requirements.md` — the excerpts you will inline.
- `TEMPLATE.md`, next to this file — the artefact you are filling in.

## The one rule that governs every choice

**The reader has no context and no way to get any.** It cannot read this skill, `.claude/rules/behavioral.md`, `/project:work`, or any other skill. It does not know what an entity page is, why the wiki is the spec, or that this project has a two-strike rule. Anything you leave out is either guessed at or skipped.

So: when you are unsure whether something belongs in the file, it belongs in the file. The failure mode here is not a file that is too long — it is a file that assumes.

## Steps

1. **Pick the work and check it is delegable.** A todo is a good handoff candidate when its Behavior cases are sharp, it is scoped to one entity, and its verification is automated. It is a **bad** candidate when it needs a spec decision (interview it first), when its cases are vague (`spec-writing` first), or when it spans entities in a way that needs a plan you have not written. Delegating an ambiguous todo just relocates the ambiguity.

2. **Stay on your current branch.** Do not create a branch for this. The brief you are about to build is gitignored scratch; the only tracked file this skill writes is the `log.md` entry, and behavioral rule 19 puts that living-documentation commit directly on `develop` (or your active `feat/*` branch, if `/project:handoff` was run mid-cycle) — the same guarded sync `handoff.md` step 1 already ran. Never run this from `main` (`handoff.md` step 1's guard moves you off it first).

3. **Gather the content.** For each placeholder, take the **verbatim** text from the wiki — do not paraphrase, do not summarize, do not "clean it up". Paraphrase is where a spec quietly changes meaning.

   | Placeholder | Source |
   | ----------- | ------ |
   | `{{SLUG}}` `{{TITLE}}` `{{DATE}}` | The entity slug, a one-line title, today's date |
   | `{{TODO_LINES}}` `{{TODO_SUMMARY}}` | The exact lines from `docs/wiki/todos.md` |
   | `{{ENTITY_PATH}}` `{{ENTITY_PAGE_VERBATIM}}` | The entity page, pasted whole — frontmatter included |
   | `{{CASE_IDS}}` | The Behavior case IDs this cycle covers (`B1, B2`) |
   | `{{OUT_OF_SCOPE}}` | Bullets. Be specific: name files, entities, and adjacent problems it will notice and must not fix |
   | `{{PROJECT_SUMMARY}}` | The Essence block of `docs/wiki/requirements.md` |
   | `{{REQUIREMENTS_EXCERPT}}` | Only the requirement sections this work touches — not the whole file |
   | `{{ARCHITECTURE_EXCERPT}}` | Stack, conventions, and testing strategy from `docs/wiki/architecture.md` |
   | `{{GOTCHAS_EXCERPT}}` | Every gotcha that could plausibly bite this work. When in doubt, include it |
   | `{{INSTALL_CMD}}` `{{TEST_CMD}}` `{{LINT_CMD}}` `{{FORMAT_CMD}}` `{{BUILD_CMD}}` | `docs/wiki/commands.md`, verbatim. `{{TEST_CMD}}` appears three times in the template — replace all of them |
   | `{{RELATED_WIKI_EXCERPTS}}` | Concept pages, ADRs, and design-system rows the work depends on. Paste the relevant sections |
   | `{{PLAN_SECTION}}` | For `[complex]`/batched work only — see step 5. Otherwise delete the line |
   | `{{CUT_FROM_BRANCH}}` `{{BASE_BRANCH}}` `{{BRANCH_NAME}}` `{{HANDOFF_PATH}}` | Normally `develop`, `develop`, `feat/<slug>`, `.claude/handoff/<slug>-handoff.md` — `{{CUT_FROM_BRANCH}}` is what you branch from and merge back in to stay synced; `{{BASE_BRANCH}}` is what the PR targets. For a **stacked cycle** (this todo continues an earlier, not-yet-merged cycle's branch) they diverge: set `{{CUT_FROM_BRANCH}}` to that earlier feature branch, and `{{BASE_BRANCH}}` to wherever this cycle's PR should land — usually that same earlier branch, unless the plan says this cycle lands independently on `develop` |
   | `{{WORKTREE_PATH}}` | Where the agent's worktree goes — `../<slug>` unless the human wants it elsewhere. Must be outside the repo directory, not a path inside it |

4. **Resolve the wikilinks you inline.** `[[entities/auth]]` means nothing to a reader who cannot browse the vault. Either paste the target's relevant section too, or rewrite the link as plain prose naming the file path. A dangling wikilink in a handoff file is a dead end, not a link.

5. **For `[complex]` or batched work, write the plan into the file.** Dispatch the `planner` first, then paste its output into `{{PLAN_SECTION}}` under a `## 3.7 Implementation plan` heading, prefaced with: *"This ordering was worked out in advance. Follow it unless reality forces a deviation, and say so in your report if it does."* An external agent given a complex todo and no plan will invent its own decomposition, which is the thing the planner exists to prevent.

6. **Fill the template and verify no placeholder survived:**

   ```bash
   mkdir -p .claude/handoff
   cp .claude/skills/llm-handoff/TEMPLATE.md .claude/handoff/<slug>-handoff.md
   # ... fill it in, and delete the HTML comment block at the top ...
   grep -n '{{' .claude/handoff/<slug>-handoff.md    # must print nothing
   ```

   The template's header comment contains a literal `{{PLACEHOLDER}}`, so this grep fails until you delete that comment. That is deliberate — the comment addresses you, not the reader, and shipping it would open the brief with instructions meant for someone else.

7. **Strip vendor-specific language.** The file must not name a model, a vendor, or a tool that only exists here. Check and rewrite:

   ```bash
   grep -niE 'claude|opus|sonnet|haiku|anthropic|/project:|\.claude/skills|\.claude/rules|slash command|subagent_type' .claude/handoff/<slug>-handoff.md
   ```

   Legitimate hits: paths under `.claude/handoff/` (the scratch directory the reader genuinely uses). Everything else is a leak — rewrite it as a capability, not a product. "Dispatch a sub-agent", not "use the Task tool". "Stop and ask the user", not "run `human-checkpoint`". If a rule of ours is worth following, restate the rule; never cite where it lives.

8. **Read the file once as the reader.** Start at §0 with nothing in your head and ask at each step: *could I do this without knowing anything else?* The checks that actually catch problems:
   - Is the test command concrete, and would it run in a fresh checkout?
   - Do the Behavior cases say what to assert, or would I have to guess at the assertion?
   - Is "out of scope" specific enough that I would not wander?
   - Does the file say what to do when something goes wrong, not only when it goes right?
   - Would I know, at the end, exactly what "done" means? (§12 is that answer — check it matches the actual scope.)

9. **Hand it over.** Give the human the path and tell them how it is meant to be used: paste the file's contents as the external agent's entire opening prompt, in a checkout of this repo. Say what it will do, so none of it is a surprise: it creates its own git worktree at `{{WORKTREE_PATH}}` cut from `{{CUT_FROM_BRANCH}}` rather than working in the main checkout, syncs by merging `{{CUT_FROM_BRANCH}}` back in (it never force-pushes), opens a PR against `{{BASE_BRANCH}}`, and does not merge it. On a stacked cycle, flag explicitly that `{{CUT_FROM_BRANCH}}` and `{{BASE_BRANCH}}` are not the same branch, since that is easy to miss on a skim.

   The worktree is why this is safe to run against a checkout someone else is using — the external agent never changes the branch that checkout has open. Two consequences worth passing on: the agent must copy the brief and install dependencies into the worktree itself, because git does not carry ignored files across; and if it cannot remove the worktree cleanly at the end, it is instructed to leave the directory rather than force it, so the human may find one to delete.

10. **Log it, commit, push.** The handoff file is gitignored, so the tracked change is the log entry:

    ```markdown
    ## [YYYY-MM-DD HH:MM] handoff — <slug>

    - TODO(s): <list>
    - Cases: B1, B2
    - Delegated to: external agent
    - Branch the agent will use: feat/<slug>
    ```

    ```bash
    git add docs/wiki/log.md
    git commit -m "docs(<slug>): log handoff"
    git push -u origin "$(git branch --show-current)"
    ```

## When the work comes back

The external agent's cycle ends with a PR and a report. Yours ends with checking it, because a delegated cycle nobody audits is a cycle that did not run:

- **The commits are per-case.** `git log --oneline develop..feat/<slug>`. One lump means the loop was not run as specified — say so on the PR.
- **Red actually happened.** Each case's test should be in the same commit as its implementation, and the test should be one that could only pass with that implementation. A test committed after the code it tests is the signature of a skipped Red phase.
- **The wiki shipped with the code.** Behavior cases `[x]`, `## Implementation` and `## Tests` accurate, closed todo line(s) removed — and, if the todo was multi-part, only the parts this cycle actually shipped, not the whole item — `log.md` entries present.
- **The findings have dispositions.** `git log --grep="review round"` on the branch. Every finding, filed ones included, tagged `[adversary]` (not `[review]` or anything else) so the backlog counter sees it.
- **The handoff file is gone**, and no scratch is left under `.claude/handoff/`.
- **No history was rewritten.** `git log --oneline` on the branch should show a merge of `develop` rather than a rebase, and no commit should have been replaced. A force-push is a procedure violation here, not a style choice.
- **The worktree is gone**, or the report says why it could not be removed. `git worktree list` in the main checkout tells you; `git worktree prune` clears a stale entry if the directory was deleted by hand.

Anything missing is PR feedback, not something you fix yourself — the same rule that keeps a reviewer from fixing what it finds. If the same gap shows up across two handoffs, the template is what is wrong: fix `TEMPLATE.md`, not the individual file.

## Anti-patterns

- **Summarizing the entity page instead of pasting it.** Your summary is an interpretation. The Behavior cases are the contract, and the contract goes in verbatim.
- **"Read `docs/wiki/architecture.md` for details."** The reader may have the repo, but the file is the brief. A pointer is an assumption that it will follow the pointer.
- **Leaving our vocabulary in.** "Run `human-checkpoint`", "follow the `tdd-loop` skill", "the adversary agent" — every one of these is a dead reference. Restate the procedure.
- **Naming a model or a tier.** "Use a strong model for review" is fine. "Use Opus" is not — you do not know what the reader has.
- **Handing off a vague todo.** If you could not write the failing test yourself from the Behavior cases, neither can they. Sharpen the spec first.
- **Inlining the entire wiki.** Self-contained means *sufficient*, not exhaustive. A file padded with irrelevant pages buries the parts that matter; pick what this work touches.
- **Omitting the failure paths.** Most of the file's value is in §9 (when to stop) and §11 (anti-patterns). An agent that only knows the happy path improvises the rest.
- **Skipping the placeholder grep.** A surviving `{{GOTCHAS_EXCERPT}}` reads, to a fresh agent, as a section it should invent.
- **Delegating and not reading the result.** The handoff moves the typing, not the responsibility.
