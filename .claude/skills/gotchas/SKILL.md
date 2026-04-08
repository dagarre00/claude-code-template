---
name: gotchas
description: Known failure points, edge cases, and recurring mistakes for this project. ALWAYS use this skill before writing or modifying code, before debugging, before implementing any feature, or whenever you encounter unexpected behavior. This is the highest-signal context in the project.
---

# Project Gotchas

Load and review `docs/agent-context/gotchas.md` before starting any implementation work.

## How to use this skill:
1. Read the full contents of `docs/agent-context/gotchas.md`
2. Check if any listed gotcha is relevant to your current task
3. If you encounter a new failure pattern, append it to the file using the format below

## Gotcha format:
```
- **[area]**: Description of what goes wrong and how to avoid it
```

## Examples:
- **[auth]**: JWT refresh tokens expire silently — always check expiry before API calls, don't assume the token is valid
- **[database]**: The ORM lazy-loads relations by default — use eager loading in list endpoints or you'll get N+1 queries
- **[tests]**: Mock the Redis client in unit tests — the test suite hangs if it tries to connect to a real Redis instance

## Rules:
- Never ignore a gotcha that matches your current task
- If you discover a new gotcha during implementation, report it so the reviewer can add it
- Gotchas are project-specific — they grow organically as the project matures
