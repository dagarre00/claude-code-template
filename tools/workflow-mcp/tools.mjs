// The tool implementations, kept separate from MCP wiring so they can be tested
// as plain functions and so the transport stays a thin shell over them.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCanonical } from './canonical.mjs';
import { loadConfig, resolveEngine } from './config.mjs';
import { prepareDispatch } from './dispatch.mjs';
import { generate, checkGenerated } from './generate.mjs';
import { listWorktrees, prepareWorktree, removeWorktree } from './worktree.mjs';

export function makeTools(root, conductorEngine) {
  return {
    list_roles() {
      const canonical = loadCanonical(root);
      const config = loadConfig(root);
      return canonical.roles.map(role => ({
        name: role.name, description: role.description,
        profile: role.profile, access: role.access,
        engine: resolveEngine(config, role.name, conductorEngine)
      }));
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

    check() {
      const result = checkGenerated(root);
      return result.ok
        ? { ok: true, message: 'Generated files match .agents/.' }
        : { ok: false, drifted: result.drifted,
            message: `Regenerate with sync(): ${result.drifted.join(', ')}` };
    },

    get_contract() {
      return readFileSync(resolve(root, '.agents/worker-contract.md'), 'utf8');
    }
  };
}
