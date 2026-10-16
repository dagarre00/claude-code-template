---
name: clean-architecture
description: Subagent-side, preloaded into the developer; also read by the conductor in /project:init. How to place and wire code under the boundaries architecture.md § Layers declares — the four shapes (layered, core/shell, slices, flat) and when each fits, which boundary a file belongs to, reaching the outside through a port, wiring adapters, and handling architecture check failures.
user-invocable: false
---

# Clean Architecture — placing and wiring code

## Read first

- `docs/wiki/architecture.md § Layers` — the shape, its boundary table, composition root, and exceptions.
- `docs/wiki/commands.md § Architecture` — the enforcement command (none for `flat`).

## Shapes

`/project:init` picks one and records it as an ADR; the rest of this skill applies the one recorded.

| Shape | Fits | Boundaries |
| --- | --- | --- |
| `layered` | backend services, domain-rich apps | `domain` ← `application` ← `adapters` ← `infrastructure`, ports owned by `application` |
| `core/shell` | CLIs, parsers, compilers, small SDKs | `core` (pure logic, owns its ports) ← `shell` (I/O, entry points, adapters) |
| `slices` | frontends, feature-heavy apps | one slice per feature, importing only `shared` and other slices' public API |
| `flat` | scripts, tiny libraries | none; no check, `simplicity-ladder` alone decides structure |

Pick the smallest shape the project's I/O and domain justify: four layers on a CLI is indirection `simplicity-ladder` would reject, and `flat` on a service with a database lets I/O leak into every rule.

## Place every new file

Choose the boundary before creating a file by what the code **knows about**, using the row for the declared shape:

| If the code… | `layered` | `core/shell` | `slices` |
| --- | --- | --- | --- |
| states a rule true with no database, UI, or network | `domain` | `core` | its slice (or `shared` if two slices need it) |
| orchestrates one user-meaningful operation and declares external needs as ports | `application` | `core` | its slice |
| converts between external shapes and inner shapes (HTTP ↔ input, rows ↔ entities, SDK ↔ port) | `adapters` | `shell` | its slice |
| configures or wraps a framework, driver, client, or runtime | `infrastructure` | `shell` | `shared` |

Place files in the directories named in `§ Layers`. A file spanning two boundaries must be split into two files. Under `flat`, put the file where the existing layout puts its neighbours.

## Reach the outside through a port

`layered` and `core/shell` only. When an inner boundary (`domain`/`application`, or `core`) needs external I/O (persistence, time, randomness, network):

1. **Declare the port in the inner boundary** using its own types (`OrderRepository.save(order)`, `Clock.now()`), never driver/framework types.
2. **Test the inner code against an in-memory fake** of the port (no database needed for its Red/Green).
3. **Implement the port in the outer boundary** as its own Behavior case with an integration test against the real boundary.
4. **Wire concrete adapters in the composition root only.** Inner code receives ports via injection.

Never import framework types, ORM models, HTTP objects, or SDK types into an inner boundary.

## Cross a slice

`slices` only. A slice imports another slice only through the public API (`index` file or module root) that slice exports; code two slices need moves to `shared` in its own case. `shared` never imports a slice.

## When the architecture check fails

- **Your change caused it** → move the code to the right boundary, or invert the dependency via a port or public API, then re-run check + tests.
- **Requires more than a small port** → stop and report which case, import, and port are needed.
- **The rule itself seems wrong** → stop and report; the shape and rule files are protected and require human approval + an ADR (rule 23).
- **Never** silence the check with ignore comments, dynamic imports, or widened allowlists.

## Anti-patterns

- **Anemic use case:** business rules in a controller while the use case merely forwards to a repo.
- **Leaky port:** returning ORM rows, HTTP responses, or SDK objects across a port.
- **Service locator:** pulling dependencies from a global container inside inner code.
- **Cross-boundary `utils`:** shared helpers that quietly import framework/infrastructure packages.
- **Reaching into a slice:** importing another slice's internals instead of its public API.
- **Ceremony past the shape:** a port, factory, or layer the declared shape does not ask for.
- **Mocking owned domain/port types** instead of writing a simple fake.
