---
name: gotchas
description: Known failure points, edge cases, and recurring mistakes. Highest-signal page in the wiki — consult BEFORE writing or debugging code.
type: wiki-spec
updated: 2026-04-15
---

# Gotchas

> **Read before any task.** This page grows organically as the project matures.
> Format: `- **[area]**: what goes wrong + how to avoid it`

## Examples (delete once real gotchas arrive)

- **[auth]**: JWT refresh tokens can expire silently — always check expiry before the call, don't assume validity
- **[db]**: ORM lazy-loads relations by default — use eager loading in list endpoints or you'll get N+1 queries
- **[tests]**: Mock the Redis client in unit tests — the suite hangs on a real connection attempt

## Project gotchas

<!-- Agents and humans append real project gotchas below -->
