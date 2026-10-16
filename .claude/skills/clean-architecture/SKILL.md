---
name: clean-architecture
description: Subagent-side, preloaded into the developer. How to place and wire code under this project's clean-architecture layers — which layer a file belongs to, reaching the outside through a port, wiring adapters, and handling architecture check failures.
user-invocable: false
---

# Clean Architecture — placing and wiring code

## Read first

- `docs/wiki/architecture.md § Layers` — layer table, composition root, and exceptions.
- `docs/wiki/commands.md § Architecture` — the enforcement command.

## Place every new file

Choose the layer before creating a file by what the code **knows about**:

| If the code… | Layer |
| --- | --- |
| states a business rule true with no database, UI, or network | `domain` |
| orchestrates one user-meaningful operation (use case) and declares external needs as ports | `application` |
| converts between external shapes and application shapes (HTTP ↔ use-case input, rows ↔ entities, SDK ↔ port) | `adapters` |
| configures or wraps a framework, driver, client, or runtime | `infrastructure` |

Place files in the directories named in `§ Layers`. A file spanning two layers must be split into two files.

## Reach the outside through a port

When `domain` or `application` needs external I/O (persistence, time, randomness, network):

1. **Declare the port in `application`** using domain types (`OrderRepository.save(order)`, `Clock.now()`), never driver/framework types.
2. **Test the use case against an in-memory fake** of the port (no database needed for use-case Red/Green).
3. **Implement the port in `adapters`** (or `infrastructure` for a thin wrapper) as its own Behavior case with an integration test against the real boundary.
4. **Wire concrete adapters in the composition root only.** Use cases receive ports via injection.

Never import framework types, ORM models, HTTP objects, or SDK types into `domain` or `application`.

## When the architecture check fails

- **Your change caused it** → move the code to the right layer or invert the dependency via a port, then re-run check + tests.
- **Requires more than a small port** → stop and report which case, import, and port are needed.
- **The rule itself seems wrong** → stop and report; rule files are protected and require human approval + an ADR (rule 23).
- **Never** silence the check with ignore comments, dynamic imports, or widened allowlists.

## Anti-patterns

- **Anemic use case:** business rules in a controller while the use case merely forwards to a repo.
- **Leaky port:** returning ORM rows, HTTP responses, or SDK objects across a port.
- **Service locator:** pulling dependencies from a global container inside a use case.
- **Cross-layer `utils`:** shared helpers that quietly import framework/infrastructure packages.
- **Mocking owned domain/port types** instead of writing a simple fake.
