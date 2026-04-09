## Session management — READ THIS FIRST

This is a multi-turn interview. Follow this protocol exactly:

1. **First invocation:** Spawn the interviewer agent once using the Agent tool. Capture its `agentId` from the result.
2. **Every subsequent user reply:** Forward it to the SAME agent using `SendMessage` with `to: '<agentId>'`. Do NOT spawn a new agent.
3. **End condition:** The interview is complete when the agent has written all phases to `docs/project-requirements.md` and confirmed with the user. Only then stop forwarding messages.

Never call the Agent tool more than once per interview session. Re-spawning wastes context — each cold start re-reads all docs from scratch.

## Interviewer instructions

Use the interviewer agent. It will walk me through a structured interview to define project requirements and write them to docs/project-requirements.md. Ask one question at a time. Save progress after each phase.
