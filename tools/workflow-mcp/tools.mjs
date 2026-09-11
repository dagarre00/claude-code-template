// The tool implementations, kept separate from MCP wiring so they can be tested
// as plain functions and so the transport stays a thin shell over them.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { engineAvailability } from './availability.mjs';
import { loadCanonical } from './canonical.mjs';
import { loadConfig, resolveEngineChain } from './config.mjs';
import { engineNames } from './engines/index.mjs';
import { prepareDispatch } from './dispatch.mjs';
import { generate, checkGenerated } from './generate.mjs';
import { listWorktrees, prepareWorktree, removeWorktree } from './worktree.mjs';

export function makeTools(root, conductorEngine) {
  return {
    list_roles() {
      const canonical = loadCanonical(root);
      const config = loadConfig(root);
      return canonical.roles.map(role => {
        const chain = resolveEngineChain(config, role.name, conductorEngine);
        return {
          name: role.name, description: role.description,
          profile: role.profile, access: role.access,
          engine: chain[0], engine_chain: chain
        };
      });
    },

    build_worker_prompt(input) {
      return prepareDispatch(root, { ...input, conductorEngine });
    },

    prepare_worktree(input = {}) {
      return prepareWorktree(root, input);
    },

    list_worktrees() {
      return listWorktrees(root);
    },

    remove_worktree({ task_id }) {
      return removeWorktree(root, task_id);
    },

    sync() {
      return { written: generate(root).map(file => file.path) };
    },

    // Drift and dispatchability, in one call. They are unrelated questions with
    // one thing in common: both are cheap to answer here and expensive to
    // discover later — drift from a worker reading a stale AGENTS.md, engine
    // availability from a 45 KB prompt that could never have run
    // (dispatch-findings F-C). `ok` stays about drift alone, so a missing CLI on
    // a machine that never dispatches to it does not read as a broken checkout.
    check() {
      const result = checkGenerated(root);
      const config = loadConfig(root);
      const chains = Object.fromEntries(loadCanonical(root).roles
        .map(role => [role.name, resolveEngineChain(config, role.name, conductorEngine)]));
      const engines = engineNames.map(name => ({
        ...engineAvailability(config, name),
        roles: Object.keys(chains).filter(role => chains[role].includes(name)).sort()
      }));
      const available = new Set(engines.filter(engine => engine.available).map(engine => engine.name));

      return {
        ...(result.ok
          ? { ok: true, message: 'Generated files match .agents/.' }
          : { ok: false, drifted: result.drifted,
              message: `Regenerate with sync(): ${result.drifted.join(', ')}` }),
        engines,
        // The actionable half: not "which CLI is missing" but "which roles can I
        // dispatch right now". A role is only undispatchable when its whole
        // chain is gone.
        roles_without_an_available_engine: Object.keys(chains)
          .filter(role => !chains[role].some(engine => available.has(engine))).sort()
      };
    },

    get_contract() {
      return readFileSync(resolve(root, '.agents/worker-contract.md'), 'utf8');
    }
  };
}
