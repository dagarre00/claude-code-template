# Handoff template

Everything below the rule goes into `.handoff/<slug>-<role>-handoff.md`, every `<…>` filled. Where a line comes in a **Read-only role** and a **Write role** version, keep the one that matches the role and drop the label.

---

# Handoff — <role>: <the brief's Task line>

Written by the conductor of `/project:<command>` on `<branch>` at `<short sha>`, <YYYY-MM-DD HH:MM> UTC.

## For the human

1. **Start a fresh session** at the root of this checkout (`<absolute path>`) — never one that has seen the conductor's conversation or the work under review. The conductor is waiting, and touches nothing until you are back.
2. **Model: `<model>` at `<effort>` effort** — this role's pin — or the nearest your harness offers.
   - Claude Code, **Read-only role**: `claude -p --agent <role> --effort <effort> "Read .handoff/<slug>-<role>-handoff.md and follow it." > .handoff/<slug>-<role>-report.md` — the final message lands in the report file.
   - Claude Code, **Write role**: `claude --agent <role> --effort <effort> "Read .handoff/<slug>-<role>-handoff.md and follow it."` — interactive, so you can answer its permission prompts.
   - Antigravity: `agy --add-dir . --effort <low | medium | high> -i "Read .handoff/<slug>-<role>-handoff.md and follow it."` — add `--model <id>` from `agy models`.
   - Any other harness: start it in this directory with that same sentence.
3. **When it finishes**, tell the conductor "done" and which harness and model ran it — or paste the agent's final message if it is not in the report file.

## For the agent

You are the **`<role>`** in this repository's development workflow, dispatched for one bounded task by the conductor — the session running `/project:<command>`, which reads your report. You are not the conductor: you run no `/project:*` command and hand work to no one. Nobody can answer you mid-task; this file, the files below and the repository are your whole context.

### Read first, in full, in this order

1. `.claude/rules/behavioral.md` — rules marked *(Conductor)* are not yours.
2. `.claude/skills/subagent-contract/SKILL.md` — the terms you work under.
3. `.claude/agents/<role>.md` — your role: its body is your procedure, its frontmatter your limits.
4. `.claude/skills/<skill>/SKILL.md` — one line per other skill in the role's `skills:` list, in order.

Beyond these, load a skill under `.claude/skills/` only when your role says to load one that matches the work, and never follow one marked *Conductor-only* — those procedures are the conductor's. Where your role forbids reading `.handoff/`, this file is the exception — it is your brief — along with any `.handoff/` path the brief names; nothing else there.

### Limits your harness may not enforce

- **Read-only role** — **Access: read-only.** Create, edit, move and delete nothing, anywhere.
- **Write role** — **Access: write, inside the brief's Scope** — plus your report file.
- **Tools: `<the role's tools line>`** — Claude Code's names; use your harness's equivalents and nothing beyond them.
- No git that changes the repository, nothing that touches a remote, no sub-agents or delegation.
- A permission or sandbox refusal is reported, never routed around.

### Brief

```
Task: <…>
Inputs: <…>
Scope: <…>
Return: <…>
```

### Report

- **Read-only role** — Your report is your final message — what your role's Report section asks for, plus the brief's Return — and nothing follows it. You write no file for it: the human's launch line saves it, or they paste it to the conductor.
- **Write role** — Write your report — what your role's Report section asks for, plus the brief's Return — to `.handoff/<slug>-<role>-report.md`, the one file you may create outside your Scope. If that write is refused, make the report your final message instead. Either way, stop there.
