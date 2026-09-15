---
name: clean-architecture
description: How to place and wire code under this project's clean-architecture layers — which layer a new file belongs to, how an inner layer reaches the outside through a port, where concrete adapters are wired, how each layer is tested, and what to do when the architecture check fails. Use for any change that adds a file, an import between modules, or a dependency on a framework, database or external service. Trigger on "layers", "clean architecture", "hexagonal", "ports and adapters", "dependency rule", "use case", "repository", "architecture check failed", "where does this go".
type: skill
---

# Clean Architecture — placing and wiring code

## Read first

- `docs/wiki/architecture.md § Layers` — the layer table, the composition root, the exceptions. It is the contract; this skill is how to work inside it.
- `docs/wiki/commands.md § Architecture` — the check that enforces it.

## Place every new file

Decide the layer before writing the file, by what the code **knows about**:

| If the code… | Layer |
| --- | --- |
| states a business rule and would be true with no database, UI or network | `domain` |
| orchestrates one user-meaningful operation (a use case) and needs something from outside | `application` — and it declares that need as a port |
| converts between the outside world's shapes and the application's (HTTP ↔ use-case input, rows ↔ entities, SDK ↔ port) | `adapters` |
| configures or wraps a framework, driver, client or runtime | `infrastructure` |

Put it in the directory the layer table names. A file that seems to belong to two layers is two files.

## Reach the outside through a port

When application or domain code needs the outside world (persistence, time, randomness, email, another service):

1. **Declare the port in the application layer**, named for what the use case needs (`OrderRepository.save(order)`, `Clock.now()`), in domain types — never the driver's types.
2. **Test the use case against a fake** of the port that you write in the test. Red and Green for the use case need no database.
3. **Implement the port in `adapters`** (or `infrastructure` for a thin wrapper), as its own Behavior case with an integration test against the real boundary where the project's testing strategy asks for one.
4. **Wire it in the composition root** only. Nothing else constructs a concrete adapter — a use case receives its ports.

Never import a framework type, ORM model, HTTP request/response or SDK object into `domain` or `application`, not even "just the type".

## When the architecture check fails

The failure names the importing file and the forbidden target.

- **Your change introduced it** → move the code to the right layer, or invert the dependency with a port. Re-run the check and the tests.
- **The fix is more than a small port** → stop and report: which case, which import, and the port you would add.
- **The rule itself looks wrong** → stop and report. The rule file is protected; loosening it is a human decision recorded as an ADR.
- **Never** silence it: no ignore comment, no moving the import behind a dynamic load, no widening a layer's allowed list.

## Anti-patterns

- **Anemic use case:** a use case that only forwards to a repository while the rule lives in a controller. Rules go to `domain` or `application`.
- **Leaky port:** a port returning ORM rows, HTTP responses or SDK objects.
- **Service locator:** reaching for a global container inside a use case instead of receiving the port.
- **Shared "utils" imported by every layer** that quietly imports a framework. Utilities belong to a layer too.
- **Mocking what you own in domain tests** instead of writing a fake of the port — the test then asserts calls, not behavior.
