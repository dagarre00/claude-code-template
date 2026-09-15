# Workflow MCP resume report — 2026-09-10

Scope: resuming the interrupted PDF Cycle 1 installer rollback case (rpc-transport B22). Requested by the human during this session. Observations below come from this session's tool results, the tail of the prior conversation, retained dispatch logs, and the named repository files. This is a report and proposed work, not a workflow implementation change.

## Outcome

Recovered the existing worker checkout without discarding its three changed files. Completed the partial-copy regression evidence, independently verified 320 passing tests in 15.12 seconds, and committed B22 as `ff67506`. Merged both existing histories and pushed `feat/rpc-transport` at `6d5b819`. The application change stages an upgrade before replacing the installed addon and restores its backup if replacement fails.

The original pre-implementation review was already recorded in `docs/wiki/log.md`; it was not repeated. Runtime dependency packaging (rpc-transport B23), installed section resources (section-registry B18), and installed drawing configuration/template resolution (drawing-sheets B24) remain pending. B22's independent diff review is recorded separately in the adversary disposition commit; this report does not imply that the full PDF cycle is complete.

## Workflow use

- Used `list_worktrees` and `list_roles` to recover the configured roles and existing worker checkout. No native subagent delegation was used.
- Reused `pdf-install-rollback` for three developer dispatches via `build_worker_prompt`, with owned paths limited to the installer, its unit test, and the rpc-transport entity page.
- Used `prepare_worktree` and `build_worker_prompt` for an independent read-only adversary on the single B22 diff, using the configured Claude engine. The prompt included the actual diff and case identifiers, without the developer's reasoning.
- The conductor ran the returned CLI configuration, verified results, appended the log, committed, merged, and pushed. The workers left files and ran no Git mutations.
- Inspected only the recent conversation tail to recover state. Older session history was not loaded wholesale.

| Developer task suffix | Reported prompt size | Engine duration | Reported total tokens | Disposition |
| --- | ---: | ---: | ---: | --- |
| `b22-resume` | 43,419 | 146.05 s | 193,880 | Rejected claimed Red: the failure was caused by a monkeypatch not reaching `copytree`'s bound default. Full suite passed, but that did not establish the regression. |
| `b22-verify` | 27,082 | 8.56 s | 48,182 | Rejected empty `SUCCESS` with `denied_actions: read_file / ViewFile`. |
| `b22-contained` | 31,208 | 61.42 s | 142,888 | Accepted after independent verification. Baseline supplied inline; real partial copy caused loss of the old installed content on B21, then passed with rollback. |

Developer runs reported **384,950 total tokens** and **3,148,340 cache-read tokens** in aggregate. These are CLI usage counters, not a bill or normalized cross-provider cost. They exclude conductor work, prior-session runs and the independent adversary. The MCP calls the prompt metric `prompt_bytes`, but `dispatch.mjs` computes JavaScript string `.length`; these numbers are not verified UTF-8 byte counts.

The adversary dispatch reported prompt size 50,423. Its run/report is under `.worktrees/.dispatch/pdf-install-rollback-review/`; those files are ignored scratch, while findings/dispositions belong in committed records.

## What worked

- Worktree isolation preserved interrupted work and let the conductor recover it without reimplementing the case.
- Explicit owned paths made integration checkable; changes stayed within the assigned files, plus the conductor's log entry.
- Real Red evidence prevented acceptance of a passing suite backed by a misleading test fixture.
- Supplying the 4 KB baseline inline removed the external-read dependency without broadening permissions.
- Narrowing the corrective prompt to the TDD skill reduced reported prompt size from about 43 KB to 27 KB before adding the baseline. This is not a controlled performance comparison: task wording also changed.

## Optimization work, in priority order

1. **Validate worker results before accepting success.** Add a conductor-side result parser or workflow helper that rejects a nonzero exit, any denied action, an empty required report, unfinished verification, or a write outside owned paths. Preserve the raw engine status separately. Keep semantic acceptance with the conductor: parsing cannot prove that a test failed for the right reason. Acceptance example: exit 0 plus `SUCCESS` plus a denied read must produce a rejected/blocked workflow result.

2. **Launch from structured arguments, with an explicit Windows path.** `dispatch.mjs` already returns `executable`, `args`, `cwd`, and `stdin_file`; make these the supported execution contract. Provide tested PowerShell and POSIX renderings if human-readable commands remain. The current POSIX-style `cd ... && ... < 'C:\\...'` string led to a WSL launch that could not locate the Windows checkout. Preserve stdin bytes and argument boundaries, and cover spaces and apostrophes in path tests. No MCP process supervisor is required to make this improvement.

3. **Carry concrete Red evidence in the developer report.** Require the failing assertion, baseline identifier, injected failure actually reached, and restored Green result. The first resumed run altered production to accommodate a monkeypatch and called that Red. The accepted run instead showed `assert '# new version\\n' == '# old version\\n'` after the injected partial-copy error on B21. Do not accept test counts alone.

4. **Check required inputs against worker read scope before dispatch.** Name external dependencies and either supply compact text inline or verify a narrowly scoped existing read grant. The corrective task's request to read the baseline from the root checkout was a conductor prompt mistake. The final result reported a denied read but did not identify its path; do not infer a new permission grant from that alone.

5. **Persist a small resume record beside each dispatch.** Record task, role, base/integration SHA, owned paths, process/session identifier, terminal state, last valid test results and final report path. The prompt files survived, but recovery still required stitching together conversation-tail messages, Git state and event-log tails. A bounded status helper should return this record without dumping the prompt or full log.

6. **Avoid unnecessary model and tool traffic.** Keep only task-relevant skills and case-level plan excerpts; filter engine events to actionable progress plus final results while retaining full logs on disk. Both successful agy runs said they were waiting for the full suite after its completed output was already present. Make command completion unambiguous and suppress repeated tests unless files changed or a concern remains. Benchmark engines on accepted cases, retries and total elapsed time before changing role defaults; this session does not establish which alternative is best.

7. **Make resume-aware integration explicit.** The worker was based at B21 while the main branch had a later workflow-documentation commit. `merge --ff-only` therefore failed; a normal merge preserved both histories cleanly. Check ancestry before choosing an integration command. Keep the existing prohibition on force pushes and destructive cleanup of unknown changes.

8. **Tighten metrics and permission descriptions.** Report actual UTF-8 prompt bytes separately from characters, per-dispatch tokens, cache tokens, duration, retries and acceptance outcome. Reconcile prose claiming exact command allowlisting with each adapter's actual enforcement. Agy exposed many unrelated tools and cannot enforce the leaf-worker boundary below its prompt; retain this warning and verify output scope.

## Errors and recovery observed

- Git ownership inspection: `fatal: detected dubious ownership`; recovered with a per-command `safe.directory` exception. Sandbox reads also warned that the user's Git ignore file was inaccessible.
- Initial worker process launch: `CreateProcessAsUserW failed: 5 (Acceso denegado.)`; escalated the same launch. The shell then reported `cd: C:/Users/.../pdf-install-rollback: No such file or directory` under WSL; used PowerShell with the generated engine arguments instead.
- Fetch: `error: cannot open '.git/FETCH_HEAD': Permission denied`; escalated the fetch, which succeeded.
- Corrective worker: `SUCCESS`, empty response, `denied_actions: [{action: "read_file", display_name: "ViewFile"}]`; rejected and replaced the external baseline read with inline data.
- Diff check: `tests/unit/test_install_addon.py:299: new blank line at EOF.`; removed the trailing blank line and reran the check successfully.
- Integration: `fatal: Not possible to fast-forward, aborting.`; inspected the known documentation-only divergence and merged without rewriting history.
- Read-only discovery also encountered a missing `.handoff` directory and an `rg` Windows glob error (`os error 123`); used the existing `.worktrees/.dispatch` directory and `rg -g '*.mjs'` respectively.

## Recommended next workflow change

Start with result validation and the structured Windows launcher, each with its own tests and workflow specs through the repository's normal development process. Then add bounded resume/status output. Keep worktree isolation, case-level commits and independent reviews. No workflow source, engine default, user permission setting or generated instruction file was changed for this report.
