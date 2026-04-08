Use the orchestrator agent. Read docs/agent-context/active-todos.md and pick the highest-priority unfinished TODO.

First dispatch the researcher agent to investigate and write a plan to `docs/plans/`. Present the plan to me for confirmation. Only after I confirm, dispatch the implementer to execute the plan. After completion, dispatch the reviewer.

Then update project-state.md (the sync-todos hook will auto-sync active-todos.md).

Finally, run the docs-maintainer agent to update the knowledge base.
