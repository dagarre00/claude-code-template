// Engine registry. Everything CLI-specific lives in one module per engine; the
// control plane (manager, server, settings validation) derives its engine list
// from here and contains no engine names of its own.
//
// This is an explicit registry rather than a directory scan on purpose. Importing
// whatever .mjs happened to sit in this folder would turn a dropped file into
// executable code inside the process that spawns workers with write access.
//
// To add an engine: write ./<name>.mjs exporting { name, efforts, buildArgs },
// add it to the two lines below, and add an `engines.<name>` block to
// .harness/settings.json. The conformance suite in test/engines.test.mjs then
// holds it to the same contract as the others.
import claude from './claude.mjs';
import codex from './codex.mjs';
import antigravity from './antigravity.mjs';

const registered = [claude, codex, antigravity];

for (const engine of registered) {
  if (!engine?.name || typeof engine.buildArgs !== 'function' || !Array.isArray(engine.efforts) || !engine.efforts.length) {
    throw new Error(`Malformed engine adapter: ${engine?.name ?? 'unnamed'}`);
  }
}

export const engines = Object.freeze(Object.fromEntries(registered.map(engine => [engine.name, engine])));
export const engineNames = Object.freeze(registered.map(engine => engine.name));
