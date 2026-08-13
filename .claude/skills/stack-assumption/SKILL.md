---
name: stack-assumption
description: How to choose the technical layer yourself — language, framework, storage, config, process model, deployment — without asking the human, inside this template's single-modest-machine envelope. Use at init, and whenever a slice needs a new dependency or a new piece of infrastructure. Trigger on "which framework", "which database", "add a dependency", "pip install", "npm install", "how should we store", "what stack", "deploy", "docker", "queue", "cache", "background job".
type: skill
---

# Assuming the Technical Layer

In this template the human is never interviewed about plumbing (behavioral rule 6). You pick, you record, you move on. This skill is how you pick, and the one case where you stop and ask anyway.

## The envelope (behavioral rule 20)

Everything runs on **one modest, always-on consumer machine**: low-power CPU (possibly ARM), a few GB of RAM, no GPU, ordinary home network, a single operator. Every technical choice is measured against that before anything else.

Concretely, prefer:

| Need | Default posture |
| --- | --- |
| Runtime | One long-lived process. A second only if the slice genuinely needs it. |
| Language | Whatever is already installed and starts fast; boring beats clever. |
| Storage | A file on disk — embedded DB or plain files. Nothing that runs its own server. |
| Web layer | The smallest framework that serves a route and a form. Server-rendered HTML over a JS build step. |
| Background work | An in-process loop or a scheduled invocation. Not a broker. |
| Config | A single `.env` or config file, read at startup. Secrets never committed. |
| Dependencies | Few, pure-language, no compile step, ARM wheels available. |
| Deployment | Start the process on the box (a service unit / a `make run`). No orchestration, no registry, no CI requirement. |
| Observability | Log lines to stdout. That's it. |

Avoid, unless the human has explicitly asked for it: containers-plus-orchestration, managed cloud services in the critical path, a message broker, a separate database server, a frontend build pipeline, anything needing a GPU or gigabytes of model weights, anything that only works while a paid API key is live.

**Networking and remote access are the operator's business, not the prototype's.** Bind to localhost (or all interfaces if the slice is about being reached), and let them put whatever they use in front of it. Don't build in a tunnelling, VPN, or hosting dependency, and don't assume a public hostname or a TLS certificate exists.

## Procedure

1. **Check what's already decided.** Read `docs/wiki/architecture.md § Stack` and `§ Prototype constraints`. An existing choice binds you — don't introduce a second way to do the same thing because you'd have picked differently.
2. **Check what's already installed.** Look at the machine and the repo (manifests, lockfiles, available interpreters). A dependency you don't have to install is worth a lot of elegance.
3. **Pick the boring option that fits the envelope.** If two options are close, take the one with fewer moving parts at runtime, then the one with fewer transitive dependencies.
4. **Record it in the same commit as the code that uses it:**
   - `docs/wiki/architecture.md § Stack` — the choice, in one line.
   - `docs/wiki/commands.md` — any new install/run command, **only after you have run it**.
   - `docs/wiki/decisions/<slug>.md` — an ADR *only* if you genuinely weighed alternatives that a future reader would otherwise re-litigate (`decision-recording`). Most prototype choices don't earn one; don't manufacture ADRs.
5. **Tell the human what you assumed** in your report — one line, e.g. "storing in SQLite at `data/app.db`; no server, single file, easy to delete". They can overrule it; they just don't have to be consulted first.

## When to stop and ask anyway

Three cases only, all via `human-checkpoint`:

- **The feature doesn't fit the envelope.** What they asked for genuinely needs a GPU, a cluster, or a paid service in the hot path. Say what breaks, what the cheapest in-envelope approximation would be, and let them choose.
- **The choice is irreversible or destructive.** It rewrites data they already have, it costs money, or it changes something outside this repo.
- **It's a product choice wearing technical clothes.** "Should uploads survive a restart?" sounds like storage but is a requirement — ask. "Which embedded database persists them?" is yours.

## Anti-patterns

- **Asking "which framework do you prefer?"** Workflow violation here. Pick one.
- **Choosing for a future that may not arrive.** No abstraction layer over the database "in case we swap it" — the prototype may not survive the week.
- **Reaching outside the envelope quietly.** Adding a cloud dependency because it was the fastest path, without a checkpoint, is the failure this skill exists to prevent.
- **A dependency per slice.** Every addition is weight on a small machine. Re-use what's in the manifest first.
- **Recording a choice you haven't run.** `commands.md` holds commands you have actually executed, not commands you believe work.
