---
name: gotcha-recording
description: How to capture a project-specific failure mode in docs/wiki/gotchas.md so future agents avoid it. Use when you just got burned by something non-obvious that other agents will hit. Trigger on "gotcha", "burned by", "footgun", "got bitten", "edge case", "surprising behavior".
type: skill
---

# Recording a Gotcha

A gotcha is project-specific failure that would burn the next agent. Generic discipline issues (TDD slips, branch hygiene) go in `.claude/rules/behavioral.md`. Project-specific traps go in `docs/wiki/gotchas.md`.

## When to record

Record when, in this session, you:

- Spent more than a few minutes on a problem with a surprising cause.
- Had a passing test that masked broken behavior.
- Hit a tool or library quirk specific to this project's setup.
- Found a config file or env var with non-obvious effects.
- Discovered that two pages of the wiki contradicted each other in production.

Do **not** record:

- General language/framework facts. (Those are knowledge, not gotchas — keep them out.)
- One-off typos or your own brain freezes.
- Anything that would be solved by reading existing docs.

## Procedure

1. Open `docs/wiki/gotchas.md`.
2. Append a new entry under the most relevant section heading (or create one). Format:

```markdown
### <Short, scannable title>

**When:** <the trigger — the exact situation that surfaces it>
**Symptom:** <what you saw>
**Cause:** <what was actually happening>
**Fix:** <what to do>
**Related:** [[entities/<slug>]], [[concepts/<pattern>]]
```

Example:

```markdown
### Pytest fixtures cached across test files in this project

**When:** Using `@pytest.fixture(scope="session")` and the fixture mutates global state.
**Symptom:** Tests pass alone, fail in suite — order-dependent.
**Cause:** This project's `conftest.py` has a session-scoped DB fixture that doesn't reset.
**Fix:** Use `scope="function"` for anything that writes, or call the reset helper in [[concepts/db-reset]].
**Related:** [[entities/test-fixtures]], [[concepts/db-reset]]
```

3. If the gotcha is severe (silent data corruption, security risk), also tag it `#critical` and add it to the top of `gotchas.md`, not the bottom.

4. If the gotcha implies a missing skill or hook (e.g. "add a hook that warns on fixture scope"), append to `docs/wiki/wiki-todos.md`.

5. **Size check.** After appending, count the non-blank, non-header content lines in `gotchas.md`:

   ```bash
   grep -c "^\*\*\(When\|Symptom\|Cause\|Fix\|Related\)\*\*" docs/wiki/gotchas.md
   ```

   If the result is **≥ 20** (roughly 4+ entries per field × 5 fields), append a wiki-todo:

   ```
   - [ ] YYYY-MM-DD agent: gotchas.md has N field-lines — compact it during the next /project:wiki-lint
   ```

   This keeps the file scannable before it degrades model attention. (`/project:wiki-lint` compacts `gotchas.md`; there is no standalone prune command.)

6. Commit with `docs: gotcha — <short title>`.

## Format rules

- **One paragraph per field max.** If you need more, you're recording a concept, not a gotcha.
- **Use the When/Symptom/Cause/Fix grid.** Future agents grep for "Symptom:".
- **Link to the entity that surfaces it.** Drift between gotcha and entity is fast.
- **No "I" voice.** Future agents reading this aren't you. "Pytest fixtures cache" is better than "I found that pytest fixtures cache".

## Anti-patterns

- **Gotcha as essay.** A scannable four-field entry beats a paragraph every time.
- **Gotcha without a Fix.** If you don't know the fix, the entry is half-cooked — note it as "Fix: TBD; see [[wiki-todos]]" and add a wiki-todo.
- **Gotcha that contradicts the wiki without flagging it.** If the gotcha shows the wiki is wrong, fix the wiki and append a `Why:` line in the gotcha.
