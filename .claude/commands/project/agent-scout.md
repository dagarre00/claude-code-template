---
name: agent-scout
description: Post-init survey that reads the wiki and recommends specific agents and skills tailored to this project's stack, domain, and external services. Run once after /project:init fills requirements and architecture. Re-run after /project:interview adds a major feature.
type: command
---

# /project:agent-scout

You read the initialized wiki and produce a prioritized list of agents and skills this project needs — ones not already present in `.claude/`. You do **not** create anything automatically; you present recommendations and let the human decide what to build.

## When to use

- Right after `/project:init` fills in real requirements and architecture (not `<TBD>`).
- After `/project:interview` adds a major feature that changes the stack or domain.
- When the developer is repeatedly improvising the same procedure that should be a skill.

## Preconditions

Check these before proceeding. If any fails, stop and run `human-checkpoint`:

1. `docs/wiki/requirements.md` — `## Stack` and `## Vision` must have real content (not `<TBD>`).
2. `docs/wiki/architecture.md` — `## Stack` must name a real language and framework.
3. `.claude/agents/` and `.claude/skills/` must exist.

If the project hasn't been initialized yet, tell the human to run `/project:init` first.

## Steps

### 1. Read the wiki

Read all of these — do not skip any:

- `docs/wiki/requirements.md` — users, stories, functional requirements, non-functionals, out of scope
- `docs/wiki/architecture.md` — stack, layout, data, external services, testing strategy, deployment
- `docs/wiki/todos.md` — upcoming work (signals what patterns will recur)
- All files under `docs/wiki/entities/` — entity behavior cases reveal domain complexity
- `docs/wiki/gotchas.md` — known failure points that suggest where skills would prevent regressions

### 2. Inventory what already exists

```bash
ls .claude/agents/
ls .claude/skills/
```

Only recommend what is genuinely missing. Do not re-recommend agents or skills that already exist, even under a different name that covers the same ground.

### 3. Analyze signals

For each category below, check whether the wiki provides a positive signal. A positive signal means: "the developer will encounter this repeatedly and needs a project-specific procedure."

**Stack signals → developer skills**

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

**Testing signals → test framework skills**

| Signal in wiki                                     | Skill to recommend           |
| -------------------------------------------------- | ---------------------------- |
| Named test framework (pytest, Jest, RSpec, JUnit…) | `<framework>-fixtures` skill |
| E2E testing (Playwright, Cypress, Selenium)        | `e2e-impl`                   |
| Contract / API testing                             | `contract-testing`           |
| Snapshot testing                                   | `snapshot-testing`           |

**External service signals → integration skills**

For each named external service in `architecture.md → ## External services`, check whether that service has project-specific integration patterns (auth flows, retry logic, webhook handling, SDK quirks). If yes, recommend a `<service>-impl` skill (e.g. `stripe-impl`, `sendgrid-impl`, `s3-impl`, `openai-impl`).

**Agent signals** (high bar — only recommend a new agent when a role is genuinely distinct from all existing agents)

| Signal                                                     | Agent to recommend                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Security-critical project (fintech, health, auth provider) | `security-reviewer` — runs SAST and checks trust boundaries; separate from the general reviewer |
| Microservices / multi-repo with API contracts              | `contract-reviewer` — checks API surface drift across services                                  |
| Data pipeline / ML — requires evaluating model outputs     | `eval-agent` — runs evals and writes findings to `docs/raw/evals/`                              |
| Heavy migration work (DB schema, API versioning)           | `migration-planner` — plans and validates migrations before developer touches schema            |

Default: if no agent signal is strong, do **not** recommend a new agent. Skills are almost always the right answer.

### 4. Draft recommendations

Write a structured report with these sections:

```
## Agent Scout Report — <Project Name>
**Date:** YYYY-MM-DD

### New skills recommended (for the developer to auto-load)

For each skill, in priority order:

**Priority:** High | Medium | Low
**Skill:** `<skill-name>`
**Trigger:** <one sentence — what situation causes the developer to load this skill>
**Why this project:** <cite the specific requirement, entity, or architecture detail that drives the need>
**Procedure outline:** <3-5 bullet points of what the skill body should tell the developer to do>

---

### New agents recommended (if any)

For each agent (only if a genuine role gap exists):

**Agent:** `<agent-name>`
**Model:** sonnet | opus | haiku  (choose based on task complexity; prefer haiku for cheap tasks, opus only for planning)
**Role gap:** <why no existing agent covers this>
**Why this project:** <cite the wiki evidence>
**Mandate:** <what it does and what it does NOT do>

---

### Not recommended

List signal categories from Step 3 that do NOT apply to this project, with one-line reasons. This shows the analysis was complete, not partial.

---

### Suggested creation order

Number the recommendations in the order that will unblock the most /project:work cycles first.
```

### 5. Offer to create

After presenting the report, ask the human which recommendations to act on. For each approved item:

- **Skill:** invoke the `update-skill` meta skill with the name, trigger description, and procedure outline from the report.
- **Agent:** invoke the `update-agent` meta skill with the name, model, tools list (derive from mandate — be conservative; only grant tools the agent genuinely needs), and mandate.

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

Stage every skill/agent file created this session plus the log entry, then push immediately — an unpushed commit is lost when the container recycles (see `.claude/rules/behavioral.md` #19):

```bash
git add .claude/ docs/wiki/log.md
git commit -m "chore(agents): scout — <N skills, M agents created>"
git push -u origin "$(git branch --show-current)"
```

If the human approved no new skills or agents, the log entry alone is still committed and pushed — the survey is a recorded action.

## What you do NOT do

- **No auto-creation.** Present findings; wait for approval.
- **No speculative recommendations.** Every recommendation must be backed by a concrete wiki signal. No "you might need this someday."
- **No domain-specialized agents for things skills can handle.** The template's design principle: domain knowledge lives in skills, not agents.
- **No running before init.** If requirements and architecture are still `<TBD>`, refuse and explain why.
- **No re-recommending existing coverage.** If `backend-impl` already exists, do not suggest creating it again.
