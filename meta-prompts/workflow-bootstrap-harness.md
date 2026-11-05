# Bootstrap prompt — write this harness's side prompt

> Run this inside the harness you want to support (a coding-agent CLI, IDE or app). It writes `workflow-harness-<harness>.md` next to `workflow-meta-prompt.md`, following the contract in that prompt's §3.4. You describe the harness you're running in, from evidence you gather here, not from memory.

## Rules

- **Evidence over memory.** Every fact in the side prompt is marked **(seen)** when a probe you ran showed it, cites the doc it came from, or is marked **(probe)** as not yet observed. Never present a remembered flag or path as fact.
- **Scope.** Write only the new side prompt and a scratch probe repo. Don't edit `workflow-meta-prompt.md` or any other side prompt. If the contract seems to be missing something this harness needs, list it under "Gaps in the meta prompt" in your report.
- **The human's config.** Don't change user-level or global harness settings (trust lists, allow rules, default model) without asking. If a probe needs a setting, name the exact rule or entry and ask for it.
- **Cost.** Run probes on the cheapest model the harness offers, with prompts that need no tools unless the probe is about tools.
- **Brevity.** Your final report is the table in step 6 and nothing else.

## Steps

1. **Identify.** Read `workflow-meta-prompt.md` §3 and §4, and one existing `workflow-harness-*.md` beside it as a format example only: its facts are about another harness. Record this harness's name, the command that prints its version, and the installed version.

2. **Gather sources**, most trusted first:
   1. The harness's own CLI help (`--help`, help subcommands) and any docs or skills it ships on disk;
   2. its official live documentation;
   3. its changelog.
   Note where each answer to the contract's eleven questions (meta-prompt §3.4) comes from.

3. **Build a probe repo** in a gitignored folder of a workspace the harness already trusts (or ask the human to trust one). Plant sentinel words, so each probe's answer proves what loaded:
   - `AGENTS.md`: `1. The probe word is TANGERINE.`
   - `workflow/skills/probe-skill/SKILL.md`: a quoted `name` and `description`, and the body `The skill word is BLUEBERRY.`
   - one read-only role and one write role, rendered in this harness's own agent format from neutral definitions (role words MANGO and KIWI), with the canonical `skills:` pointing at `probe-skill`;
   - whatever the harness needs so that it loads `AGENTS.md` and the skills (a pointer, a manifest or a generated copy). Try reference first, then generated, then pointer (meta-prompt §3.2).
   Commit it, so a probe's file changes show in `git status`.

4. **Run the probes.** For each one, record the command, what you expected, and what you saw:

   | # | Probe | Pass when |
   | --- | --- | --- |
   | 1 | Rules | A fresh conversation quotes TANGERINE |
   | 2 | Skills | `probe-skill` is listed or its word is known on demand |
   | 3 | Role, native | A natively dispatched role answers MANGO and knows BLUEBERRY; only its result returns to the parent |
   | 4 | Role, headless | The headless launch line with the role selected answers MANGO; note whether its skills loaded |
   | 5 | Read-only | The read-only role can read a file but can't create one |
   | 6 | Write + allowlisted command | The write role runs an allowlisted command and writes a file, unattended |
   | 7 | Denied command | A command that isn't allowlisted: record exactly how the run reports it (exit code, output fields, stderr) |
   | 8 | Bad model | An unknown model id fails fast with a non-zero exit |
   | 9 | Run record | The headless output's machine-readable fields that tell a finished run from a cut-off or denied one |
   | 10 | Flag order | The launch line works exactly as written, with the flags in that order |
   | 11 | Background wait | Whether a conductor is woken when a background command exits (interactive; ask the human if you can't observe it) |
   | 12 | Ask | How the harness asks the human a question with options, interactively, and what a headless run does instead |

   A probe you can't run (no native subagents, interactive only) is marked **(probe)** with the reason. Don't skip it silently.

5. **Write `workflow-harness-<harness>.md`** (≤ 200 lines), with the same twelve sections as the example: verified on, instructions, adapter map with key-by-key mappings from the canonical frontmatter, native dispatch, spawn, waiting and asking, permissions and read-only, tier map, token notes, gotchas, probes, harness note. Put every surprise from step 4 under gotchas: they're the most valuable part of the file. Include the rule `wf await` uses to call a run `partial` from this harness's run record.

6. **Clean up and report.** Delete the probe repo, or leave it and say where, if the human still has interactive probes to run. Then reply with:

   ```
   Side prompt: <path>
   | # | Probe | Result (pass / fail / probe) | Evidence (one line) |
   Needs the human: <settings to add, interactive probes left>
   Gaps in the meta prompt: <none, or one line each>
   ```
