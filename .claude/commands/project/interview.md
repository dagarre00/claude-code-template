Conduct the requirements interview yourself. Run it inline in the main context.

## Interview protocol

1. Read `docs/project-requirements.md` to check existing content
2. Ask ONE question at a time. Wait for the answer before asking the next.
3. After each phase completes, write the results to `docs/project-requirements.md` immediately (don't wait until the end)
4. Set Status to "Draft" while in progress, "Approved" only if user explicitly confirms

## Phases

**Phase 1 — Vision:** What does it do? Who is it for? What problem does it solve?
**Phase 2 — User Stories:** Walk through the user journey start to finish. Generate `As a [user], I can [action]` bullets. Read them back for confirmation.
**Phase 3 — Functional Requirements:** For each user story, what must the system do? Group by feature area.
**Phase 4 — Non-Functional Requirements:** Stack, performance (push back on vague answers), testing, CI/CD, deployment target.
**Phase 5 — Constraints:** Budget, timeline, infrastructure, team size.
**Phase 6 — Out of Scope:** What are we explicitly NOT building in this version?

## Finishing

After all phases, read back the complete document and ask: "Is this accurate? Anything to add, remove, or change?" Make edits, then set Status to "Approved" on explicit user confirmation.

Write only to `docs/project-requirements.md`. Use the exact section structure: Vision, User Stories, Functional Requirements, Non-Functional Requirements, Constraints, Out of Scope.
