---
name: agent-scout
description: Post-init survey that reads the wiki and recommends skills tailored to this prototype's stack and domain. Run once the stack has settled and a few slices are demonstrated. Re-run after /project:interview adds a major feature.
argument-hint: [focus — e.g. "testing skills only" | "the payments feature" | "skills, no agents"]
type: command
---

# /project:agent-scout

**Argument:** `$ARGUMENTS`

The argument **narrows the survey** — a signal category (`testing skills only`, `external services`), a feature (`the payments feature`), or an output filter (`skills, no agents`). Restrict step 3's analysis to the matching categories and say in the `### Not recommended` section that the rest were **out of scope this run**, not analysed and rejected — the two are different, and conflating them makes a partial survey look complete. Empty argument means the full survey.

You read the initialized wiki and produce a prioritized list of skills this prototype needs — ones not already present in `.claude/`. You do **not** create anything automatically; you present recommendations and let the human decide what to build.

**Skills, essentially never agents.** This template ships one working agent (`builder`) on purpose: a prototype that needs a second role usually needs to graduate, not to grow an org chart. Recommend an agent only if you can name the invariant that makes it impossible to express as a skill the `builder` loads.

## When to use

- Right after `/project:init` fills in real requirements and architecture (not `<TBD>`).
- After `/project:interview` adds a major feature that changes the stack or domain.
- When the `builder` is repeatedly improvising the same procedure that should be a skill.

## Preconditions

Check these before proceeding. If any fails, stop and run `human-checkpoint`:

1. `docs/wiki/requirements.md` — `## Vision` must have real content (not `<TBD>`).
2. `docs/wiki/architecture.md` — `## Stack` must name the language and storage actually chosen.
3. `.claude/agents/` and `.claude/skills/` must exist.

If the project hasn't been initialized yet, tell the human to run `/project:init` first.

## Steps

### 1. Read the wiki

Read all of these — do not skip any:

- `docs/wiki/requirements.md` — users, stories, functional requirements, non-functionals, out of scope
- `docs/wiki/architecture.md` — stack, prototype constraints, layout, data, external services
- `docs/wiki/todos.md` — upcoming work (signals what patterns will recur)
- All files under `docs/wiki/entities/` — slices reveal domain complexity, and `## Shortcuts` reveals where the same fake keeps recurring (a strong skill signal)
- `docs/wiki/gotchas.md` — known failure points that suggest where skills would prevent regressions

### 2. Inventory what already exists

```bash
ls .claude/agents/
ls .claude/skills/
```

Only recommend what is genuinely missing. Do not re-recommend agents or skills that already exist, even under a different name that covers the same ground.

### 3. Analyze signals

If the argument named a focus, analyse only the categories it covers. Otherwise work through all of them.

For each category below, check whether the wiki provides a positive signal. A positive signal means: "the `builder` will encounter this repeatedly and needs a project-specific procedure."

**Stack signals → builder skills**

| Signal in wiki                                  | Skill to recommend |
| ----------------------------------------------- | ------------------ |
| Backend API (REST, GraphQL, RPC)                | `backend-impl`     |
| Database / ORM (SQL, NoSQL, migrations)         | `database-impl`    |
| Frontend / UI (React, Vue, HTML templates, CSS) | `frontend-impl`    |
| Mobile (iOS, Android, React Native, Flutter)    | `mobile-impl`      |
| CLI tooling / scripting                         | `cli-impl`         |
| Data processing / ETL / ML pipelines            | `data-impl`        |
| Infrastructure / IaC (Terraform, Pulumi, k8s)   | `infra-impl`       |

**Domain signals → targeted skills**

| Signal in wiki                                | Skill to recommend   |
| --------------------------------------------- | -------------------- |
| Auth / sessions / permissions in requirements | `auth-impl`          |
| Payment processing / billing                  | `payments-impl`      |
| File uploads / storage / media                | `storage-impl`       |
| Email / SMS / push notifications              | `notifications-impl` |
| Search / indexing                             | `search-impl`        |
| Background jobs / queues / workers            | `jobs-impl`          |
| Real-time / websockets / SSE                  | `realtime-impl`      |
| Multi-tenancy / org isolation                 | `tenancy-impl`       |

**Demonstration signals → skills that make slices showable**

| Signal in wiki                                          | Skill to recommend    |
| ------------------------------------------------------- | --------------------- |
| Browser UI where the demo means "open a page and look"  | `browser-demo`        |
| Long-running or scheduled work with no obvious surface  | `observable-progress` |
| Slices that need fixture data before they can be shown  | `sample-data`         |
| Repeated "reset it and start clean" before each demo    | `clean-slate`         |

Do **not** recommend test-framework skills. This template has no suite; a wish for one is a `/project:graduate` signal and belongs in the report as such.

**External service signals → integration skills**

For each named external service in `architecture.md → ## External services`, check whether that service has project-specific integration patterns (auth flows, retry logic, webhook handling, SDK quirks). If yes, recommend a `<service>-impl` skill (e.g. `stripe-impl`, `sendgrid-impl`, `s3-impl`, `openai-impl`).

**Agent signals** (high bar — only recommend a new agent when a role is genuinely distinct from all existing agents)

| Signal                                                  | Agent to recommend                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Data pipeline / ML where output quality can't be eyeballed | `eval-agent` — runs evals and writes findings to `docs/raw/evals/`         |
| Research-heavy domain the `builder` keeps stalling on    | already covered — that's the shipped `researcher`; recommend nothing        |

Default: **recommend no agent.** Reviewing, planning, and auditing roles are deliberately absent from this template — proposing them back is a graduation signal, so write it in the report as "this prototype has outgrown the template" rather than as an agent recommendation.

### 4. Draft recommendations

Write a structured report with these sections:

```
## Agent Scout Report — <Project Name>
**Date:** YYYY-MM-DD

### New skills recommended (for the `builder` to auto-load)

For each skill, in priority order:

**Priority:** High | Medium | Low
**Skill:** `<skill-name>`
**Trigger:** <one sentence — what situation causes the `builder` to load this skill>
**Why this project:** <cite the specific requirement, entity, or architecture detail that drives the need>
**Procedure outline:** <3-5 bullet points of what the skill body should tell the `builder` to do>

---

### New agents recommended (if any)

For each agent (only if a genuine role gap exists):

**Agent:** `<agent-name>`
**Model:** sonnet | opus | haiku  (prefer haiku for cheap mechanical work; opus is rarely justified in a prototype)
**Role gap:** <why no existing agent covers this>
**Why this project:** <cite the wiki evidence>
**Mandate:** <what it does and what it does NOT do>

---

### Not recommended

List signal categories from Step 3 that do NOT apply to this project, with one-line reasons. Categories skipped because the argument narrowed the survey are listed separately as "out of scope this run" — never mixed in with analysed-and-rejected. This shows exactly how complete the analysis was.

---

### Suggested creation order

Number the recommendations in the order that will unblock the most /project:work cycles first.

### Graduation signals seen

Anything in this survey that pointed at tests, review, audit, or planning roles — listed plainly. Two or more of these means the honest recommendation is `/project:graduate`, not more toolkit.
```

### 4a. Branch before creating anything

Steps 1–4 are read-only, so branch here — right before the first tracked write. The skill/agent files and the log entry are tracked, and `main` takes no direct commits (`feature-branching`, `git-conventions.md`):

```bash
git fetch origin main
git checkout main && git merge --ff-only origin/main
git checkout -b chore/agent-scout-$(date -u +%Y-%m-%d)
```

No remote yet (`git remote` prints nothing)? Skip the fetch/merge and branch off local `main`. **Already on a `proto/*` branch?** Stay there. Branch only when standing on `main`; in that case step 7 ends by offering the merge back to `main` (`feature-branching`).

### 5. Offer to create

After presenting the report, ask the human which recommendations to act on. For each approved item:

- **Skill:** invoke the `update-toolkit` skill (Skills section) with the name, trigger description, and procedure outline from the report.
- **Agent:** invoke the `update-toolkit` skill (Agents section) with the name, model, tools list (derive from mandate — be conservative; only grant tools the agent genuinely needs), and mandate.

Do not create anything that the human has not explicitly approved.

### 6. Log it

Append to `docs/wiki/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] agent-scout

- Skills recommended: <N> (<names>)
- Agents recommended: <N> (<names>)
- Skills created: <names or "none">
- Agents created: <names or "none">
```

### 7. Commit and push

Stage every skill/agent file created this session plus the log entry, then push immediately (behavioral rule 19):

```bash
git add .claude/ docs/wiki/log.md
git commit -m "chore(agents): scout — <N skills, M agents created>"
git push -u origin "$(git branch --show-current)"
```

If the human approved no new skills or agents, the log entry alone is still committed and pushed — the survey is a recorded action.

## What you do NOT do

- **No auto-creation.** Present findings; wait for approval.
- **No speculative recommendations.** Every recommendation must be backed by a concrete wiki signal. No "you might need this someday."
- **No domain-specialized agents for things skills can handle.** The template's design principle: domain knowledge lives in skills, not agents — and this template's second principle is that a prototype needs almost no toolkit at all.
- **No running before init.** If requirements and architecture are still `<TBD>`, refuse and explain why.
- **No test-framework skills.** There is no suite here (`architecture.md § Assumed defaults`).
- **No re-recommending existing coverage.** If `backend-impl` already exists, do not suggest creating it again.
