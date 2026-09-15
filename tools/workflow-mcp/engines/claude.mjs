// Claude Code adapter.
//
// --safe-mode is what makes a Claude worker context-free, and it is the reason
// this engine needs no special case anywhere else. It disables CLAUDE.md
// discovery, skills, plugins, hooks, custom commands and agents, and MCP
// servers, while leaving authentication alone — verified by asking a worker
// whether it had project instructions, a project:tdd-loop skill, or a
// /project:work command, and getting NO three times in this repository.
//
// --bare would also work and was rejected: it forces ANTHROPIC_API_KEY or
// apiKeyHelper and never reads OAuth, so every dispatch would bill the API
// instead of the operator's subscription. Same context guarantee, worse
// default; --safe-mode is the one to keep.
export default {
  name: 'claude',
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  // It would read CLAUDE.md, so we stop it. Recorded as a measured property of
  // the CLI rather than an assumption baked into the argv.
  readsProjectDocs: true,
  promptFormat: 'text',
  writeMode: 'acceptEdits',
  // --disallowedTools Agent,Task removes the tools entirely. Measured: a worker
  // asked what agent-spawning tools it has answers NONE.
  enforcesLeafWorker: true,
  // A read-only worker here cannot write: with --permission-prompts none, Write
  // and Edit need an approval surface that does not exist and are denied.
  // Measured — a worker told to create a file reports the Write tool "was
  // automatically denied because it requires user approval and there's no
  // approval interface in this session type", and no file appears.
  enforcesReadOnly: true,
  // `--print` with no --output-format prints only the final assistant
  // message — no per-tool-call echo. Nothing to isolate, so no report_file.
  reportIsStdout: true,
  writesReportFile: false,
  buildArgs({ settings, readOnly, model, effort }) {
    const args = [
      '--print',
      // The context guarantee. Everything else here is hygiene.
      '--safe-mode',
      '--no-session-persistence',
      // `dontAsk`, not `plan`, for read-only roles. Plan mode refuses every Bash
      // call — including the project's own test command — so an adversary could
      // not verify the findings it reports and a planner could not confirm the
      // suite is green before planning against it. Measured: in plan mode a
      // worker answers "I'm currently in plan mode, which prevents me from
      // executing non-readonly actions like `npm test`". Read-only is enforced
      // by the missing approval surface instead (see enforcesReadOnly), which
      // denies edits while the allowlisted commands stay runnable.
      //
      // `dontAsk` replaces the earlier `default`, which `claude --help` (2.1.267)
      // no longer lists among `--permission-mode`'s documented choices (still
      // accepted when measured, but undocumented values are exactly the kind of
      // thing a future release drops without warning). `dontAsk` is a documented,
      // named value whose own denial message ("Claude Code is currently in
      // 'don't ask mode'") matches the property this line exists for.
      //
      // Neither value gives the strict allowlist the comment below describes.
      // Measured on 2.1.267 across every `--permission-mode` value tried
      // (`default`, `auto`, `manual`, `dontAsk`): a Bash command that is NOT in
      // `--allowedTools` below can still execute — proven with `sha256sum` on a
      // file whose hash could not be guessed. The CLI routes ungranted Bash
      // through its own semantic auto-mode classifier (`claude auto-mode
      // defaults`) rather than hard-denying everything outside `--allowedTools`.
      // A fuller sweep narrows what that actually costs, though: writes (Write
      // tool, and a Bash shell-redirect), deletes (`rm`), network calls (`curl`),
      // and reads outside the worktree were all denied in every mode tried. Only
      // local, in-scope, non-mutating reads slip through — and Read/Grep/Glob
      // already give every role that same access with no gating at all, so this
      // hands a worker nothing its own file tools didn't already have.
      // `enforcesReadOnly` (no mutation, no exfiltration, no scope escape) holds;
      // only the literal "workers may only run these exact commands" does not.
      // A custom `--settings` hard_deny rule and a blanket `--disallowedTools
      // Bash` were both tried against this and neither restored the literal
      // allowlist without also breaking the commands it's meant to grant. See
      // gotchas.md § Tooling.
      '--permission-mode', readOnly ? 'dontAsk' : this.writeMode,
      // Nobody is at the keyboard, so anything that would prompt must be denied
      // rather than hang until the conductor's timeout.
      '--permission-prompts', 'none',
      // A worker is a leaf: the contract forbids recursive dispatch, and this
      // makes that a property of the process rather than a promise in a prompt.
      '--disallowedTools', 'Agent,Task',
      // Each dispatch runs in a differently named worktree, and that path sits
      // in the system prompt as cwd — without this the cached prefix breaks on
      // every single dispatch, which defeats the stable-prefix ordering the
      // composer works to preserve.
      '--exclude-dynamic-system-prompt-sections'
    ];
    // Without this a worker can edit but never run anything: --permission-prompts
    // none denies every Bash call, so the developer cannot confirm Red or Green
    // and rule 4 becomes unsatisfiable. Each entry is granted narrowly, and the
    // match is on the command line as invoked — a worker that chains, redirects
    // or prefixes `cd` is denied with "this PowerShell command contains multiple
    // operations", which is why the worker contract says to run it verbatim.
    for (const command of settings.workerCommands ?? []) {
      args.push('--allowedTools', `Bash(${command}:*)`);
    }
    if (model && model !== 'inherit') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    return args;
  }
};
