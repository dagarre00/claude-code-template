# Log entry, commit and push — canonical block

Every command that changes tracked files ends here (rule 19). Commands supply the three things that vary: the **kind**, the **paths** and the **commit subject**.

## 1. Append the log entry

To `docs/wiki/log.md`, newest at the bottom:

```markdown
## [YYYY-MM-DD HH:MM] <kind> — <slug>

- <field>: <value>
```

Take the stamp from `date -u +'%Y-%m-%d %H:%M'` — **UTC**, so entries stay in order whatever zone a session ran in (`verify.mjs` enforces oldest-first). Drop `— <slug>` when there is none (`init`, `review`).

**The kind names the mutation, not the command**, from a closed vocabulary — anything else fails lint:

| kind | written by |
| --- | --- |
| `init` | `/project:init` |
| `interview` | `/project:interview` |
| `work` | `/project:work` |
| `pr` | the `pr-create` skill |
| `adversary` | `/project:adversary`, and `/project:work` step 7a |
| `review` | `/project:review` |
| `wiki-ingest` | `/project:wiki`, ingest mode |
| `wiki-maintenance` | `/project:wiki`, health pass |
| `chore` | anything else that touched tracked files |

Keep to fields a later reader cannot recover from `git log`. Counts are an index; the per-item detail belongs in the commit that made the change.

## 2. Commit and push

```bash
git add <paths>
git commit -m "<subject>"
git push -u origin "$(git branch --show-current)"
```

The entry ships **in the same commit as the work it describes** — except in `/project:work` and `pr-create`, whose work was committed before the entry could exist. Which branch it lands on is the table in [`SKILL.md`](SKILL.md).

## Stop conditions

- **No remote** (`git remote get-url origin` fails) → skip the push and say so. A local-only repo is supported.
- **Push rejected** → someone else pushed here. Never force-push or rebase over it; `human-checkpoint`.
- **Network failure** → retry with backoff; still failing → say so prominently. An unpushed commit is lost when the container recycles.
- **`git add` would stage a path you did not touch** → another session's work (rule 21). Stage your own paths explicitly, never `git add -A`; `human-checkpoint` if something unexplained is in the way.
