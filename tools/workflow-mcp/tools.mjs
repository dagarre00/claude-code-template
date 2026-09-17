// The tool implementations, kept separate from MCP wiring so they can be tested
// as plain functions and so the transport stays a thin shell over them.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { engineAvailability, engineSetup, grantAntigravitySetup } from './availability.mjs';
import { loadCanonical } from './canonical.mjs';
import { loadConfig, resolveEngineChain } from './config.mjs';
import { ENGINES, engineNames } from './engines/index.mjs';
import { prepareDispatch } from './dispatch.mjs';
import { generate, checkGenerated } from './generate.mjs';
import { dispatchStats, inspectDispatch, recordDecision } from './inspect.mjs';
import { listWorktrees, prepareWorktree, removeWorktree } from './worktree.mjs';

function architectureStatus(root, config) {
  const { command, rules } = config.architecture;
  const missing_rules = rules.filter(path => !existsSync(resolve(root, path)));
  const enforced = !!command && !missing_rules.length;
  return { enforced, command, rules, missing_rules, protected_paths: config.protectedPaths,
    message: !command
      ? 'No architecture check is configured: layer rules in docs/wiki/architecture.md are enforced by review only. '
        + 'Set architecture.command and architecture.rules in .agents/config.json (/project:init step 5b).'
      : missing_rules.length
        ? `The architecture rule files ${missing_rules.join(', ')} do not exist, so the check cannot be guarding what the wiki declares.`
        : 'The architecture check is granted to workers and its rule files are protected.' };
}

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

    // Loaded first, so a malformed worktreeSetup fails before a worktree exists.
    prepare_worktree(input = {}) {
      const setup_commands = loadConfig(root).worktreeSetup ?? [];
      return { ...prepareWorktree(root, input), setup_commands };
    },

    inspect_dispatch({ task_id } = {}) {
      return inspectDispatch(root, task_id);
    },

    record_decision(input = {}) {
      return recordDecision(root, input);
    },

    dispatch_stats() {
      return dispatchStats(root);
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
        roles: Object.keys(chains).filter(role => chains[role].includes(name)).sort(),
        setup: engineSetup(config, name)
      }));
      const available = new Set(engines.filter(engine => engine.available).map(engine => engine.name));
      const setupByEngine = Object.fromEntries(engines.map(engine => [engine.name, engine.setup]));

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
          .filter(role => !chains[role].some(engine => available.has(engine))).sort(),
        // Installed is not the same as usable: an available engine can still deny
        // a worker's first command (engineSetup, e.g. agy's missing command()
        // grants), and that failure is silent enough on two of three engines to
        // look like success (engine-setup.md). `ok` above stays about drift
        // alone — a missing grant is not a broken checkout — so this is the
        // separate, explicit signal: every role whose *first-choice* engine has
        // an unmet setup requirement, found before a dispatch is composed rather
        // than after it comes back empty.
        roles_with_unmet_setup: Object.keys(chains)
          .filter(role => setupByEngine[chains[role][0]]?.ok === false).sort(),
        // A role whose chain reaches an engine that cannot give it what it
        // declares it needs. Only measured gaps are listed.
        capability_gaps: loadCanonical(root).roles.flatMap(role => (chains[role.name] ?? []).map(engine => ({
          role: role.name, engine,
          missing: role.capabilities.filter(capability => capability === 'web' && ENGINES[engine].providesWeb === false)
        }))).filter(gap => gap.missing.length),
        // Whether the layers the wiki declares are enforced by anything a
        // worker runs. A missing rule file means the check guards nothing.
        architecture: architectureStatus(root, config)
      };
    },

    grant_antigravity_setup() {
      return grantAntigravitySetup(loadConfig(root));
    },

    get_contract() {
      return readFileSync(resolve(root, '.agents/worker-contract.md'), 'utf8');
    }
  };
}
