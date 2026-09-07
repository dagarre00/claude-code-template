# Log entry, commit and push — canonical block

Every command that mutates tracked files ends here (behavioral rule 19). This is
the one copy; commands reference it and supply only the three things that vary —
the **kind**, the **paths**, and the **commit subject**.

## 1. Append the log entry

`docs/wiki/log.md`, append-only, newest at the bottom:

```markdown
## [YYYY-MM-DD HH:MM] <kind> — <slug>

- <field>: <value>
```

Get the stamp from `date -u +'%Y-%m-%d %H:%M'` rather than guessing it. Drop the
`— <slug>` when the mutation has no slug (`init`, `review`).

**The kind names the mutation, not the command** (rule 19). A command with two
modes writes two different kinds; a bare chat instruction that changed tracked
files writes one too. The vocabulary is fixed — `docs/wiki/log.md` lists it, and
an entry whose kind is not in that list is a lint failure, not a new kind:

| kind | written by |
| --- | --- |
| `init` | `/project:init` |
| `interview` | `/project:interview` |
| `work` | `/project:work` |
| `pr` | the `pr-create` skill |
| `adversary` | `/project:adversary`, and `/project:work` step 7a |
| `review` | `/project:review` |
| `wiki-ingest` | `/project:wiki` in ingest mode |
| `wiki-maintenance` | `/project:wiki` in health-pass mode |
| `chore` | anything else that touched tracked files |

Keep entries to the fields that a later reader cannot recover from `git log`.
Counts are an index, not the record — the per-item detail belongs in the commit
that made the change.

## 2. Commit and push

```bash
git add <paths>
git commit -m "<subject>"
git push -u origin "$(git branch --show-current)"
```

The log entry ships **in the same commit as the work it describes**, not in a
commit of its own — except in `/project:work`, where the implementation was
already committed case by case and the log is genuinely all that is left.

Which branch this lands on is not decided here: living documentation commits
directly on `develop` or rides the active `feat/*`/`fix/*`/`chore/*` branch,
while code goes through a PR. That table is in [`SKILL.md`](SKILL.md), and the
naming and commit-subject vocabulary is in
[`docs/wiki/git-conventions.md`](../../../docs/wiki/git-conventions.md).

## Stop conditions

- **No remote.** `git remote get-url origin` fails → skip the push and say so in
  the report. Not an error; a fresh local repo is a supported state.
- **Push rejected.** Someone else pushed to this branch. Never force-push and
  never rebase over it (rule 19) — stop and run `human-checkpoint`.
- **Network failure.** Retry with backoff. Still failing → say so prominently in
  the report. An unpushed commit is lost work once the container recycles, so
  this is reported, never silently swallowed.
- **`git add` would stage a path you did not touch.** Rule 21: a dirty path you
  cannot account for is another session's live work. Stage your own paths
  explicitly — never `git add -A` — and `human-checkpoint` if something
  unexplained is in the way.
