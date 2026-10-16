import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// A refusal reads as { deny } on the engine's own $.tool.call, and as an
// errored result once a session's chain has turned it into one.
const refusal = (r: { deny?: string; isError?: true; text?: string }) => r.deny ?? (r.isError ? r.text : undefined)

const OK = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

// The world beneath the plugin: git answers by its subcommand, files by path,
// and every tool that gets through records that it ran.
// A workflow project unless `workflow` is false: the rules file is what marks one.
function world(
  on: On,
  {
    porcelain = '',
    files: own = {} as Record<string, string>,
    head = '',
    branch = 'develop',
    workflow = true,
    inProgress = [] as string[],
  } = {},
) {
  const files: Record<string, string> = workflow ? { '.claude/rules/behavioral.md': '# Rules', ...own } : own
  const ran: string[] = []
  const toasts: string[] = []
  // Paths reach the hooks resolved against the session's directory.
  const file = (path: string) =>
    Object.keys(files).find(name => path.replaceAll('\\', '/').endsWith(`/${name}`) || path === name)
  on('process.run', ($, e) => {
    const sub = e.argv.slice(1).join(' ')
    if (sub.startsWith('status --porcelain')) return { value: { ...OK, stdout: porcelain } }
    if (sub.startsWith('show --name-only')) return { value: { ...OK, stdout: head } }
    if (sub.startsWith('rev-parse --abbrev-ref HEAD')) return { value: { ...OK, stdout: `${branch}\n` } }
    // A merge, rebase or cherry-pick stopped on a conflict leaves its ref.
    const ref = /^rev-parse -q --verify (\w+)$/.exec(sub)?.[1]
    if (ref !== undefined && inProgress.includes(ref)) return { value: { ...OK, stdout: 'abc123\n' } }
    return { value: { ...OK, exitCode: 1, stdout: '' } }
  })
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.exists', ($, e) => ({ value: file(e.path) !== undefined }))
  on('fs.read', ($, e) => {
    const name = file(e.path)
    if (name === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: files[name]! }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', ($, e) => {
    ran.push(String(e.tool))
    return { result: 'ok' }
  })
  return { ran, toasts }
}

test('rule 11: an existing raw source cannot be edited or overwritten', async ($, on) => {
  const w = world(on, { files: { 'docs/raw/a.md': 'x' } })

  const edit = await $.tool.call({ tool: 'Edit', file_path: 'docs/raw/a.md', old_string: 'x', new_string: 'y' })
  const write = await $.tool.call({ tool: 'Write', file_path: 'docs/raw/a.md', content: 'y' })

  expect(refusal(edit)).toBeDefined()
  expect(refusal(edit)).toMatch(/rule 11/)
  expect(refusal(write)).toBeDefined()
  expect(w.ran).toEqual([])
})

test('rule 11: a new raw source can be written', async ($, on) => {
  const w = world(on)

  await $.tool.call({ tool: 'Write', file_path: 'docs/raw/new.md', content: 'y' })

  expect(w.ran).toEqual(['Write'])
})

test('rule 21: destructive git is refused over a dirty tree, naming the paths', async ($, on) => {
  const w = world(on, { porcelain: ' M src/a.ts\n?? notes.md\n' })

  const r = await $.tool.call({ tool: 'Bash', command: 'git stash' })

  expect(refusal(r)).toBeDefined()
  expect(refusal(r)).toMatch(/rule 21/)
  expect(refusal(r)).toMatch(/src\/a\.ts/)
  expect(refusal(r)).toMatch(/notes\.md/)
  expect(w.ran).toEqual([])
})

test('rule 21: destructive git runs over a clean tree, and PowerShell is checked too', async ($, on) => {
  const w = world(on)

  await $.tool.call({ tool: 'PowerShell', command: 'git reset --hard' })

  expect(w.ran).toEqual(['PowerShell'])
})

test('rule 10: a role is never dispatched as a fork or through general-purpose', async ($, on) => {
  const w = world(on)

  const fork = await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p', subagent_type: 'fork' })
  await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p', subagent_type: 'developer' })

  expect(refusal(fork)).toBeDefined()
  expect(refusal(fork)).toMatch(/rule 10/)
  expect(w.ran).toEqual(['Agent'])
})

const INITIALISED = { 'CLAUDE.md': '- Name: linkshelf', 'docs/wiki/log.md': '# Log' }

for (const branch of ['develop', 'main']) {
  test(`rule 19: a commit on ${branch} without a log entry raises a toast once initialised`, async ($, on) => {
    const w = world(on, { files: INITIALISED, head: 'docs/wiki/todos.md\n', branch })

    await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(wiki): close a todo"' })

    expect(w.ran).toEqual(['Bash'])
    expect(w.toasts.join()).toMatch(/log\.md/)
  })
}

test('rule 19: a direct commit carrying its log entry is quiet', async ($, on) => {
  const w = world(on, { files: INITIALISED, head: 'docs/wiki/todos.md\ndocs/wiki/log.md\n' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(w.toasts).toEqual([])
})

test('rule 19: a code-branch commit is quiet — the cycle and pr entries cover the branch', async ($, on) => {
  const w = world(on, { files: INITIALISED, head: 'docs/wiki/entities/auth.md\n', branch: 'feat/auth' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(auth): specify B3 — reject empty token"' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat(auth): B3 reject an empty token"' })
  expect(w.toasts).toEqual([])
})

test('rule 19: an empty commit on develop is quiet', async ($, on) => {
  const empty = world(on, { files: INITIALISED, head: '' })
  await $.tool.call({ tool: 'Bash', command: 'git commit --allow-empty -m "docs(auth): adversary round 1"' })
  expect(empty.toasts).toEqual([])
})

test('rule 19: a raw-source arrival commit is quiet without a log entry', async ($, on) => {
  const rawOnly = world(on, { files: INITIALISED, head: 'docs/raw/interviews/2026-04-08.md\n' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(raw): add interview"' })
  expect(rawOnly.toasts).toEqual([])
})

test('rule 19: the uninitialised template is quiet', async ($, on) => {
  const w = world(on, {
    files: { 'CLAUDE.md': '- Name: `<set during project initialization>`', 'docs/wiki/log.md': '# Log' },
    head: 'README.md\n',
  })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(w.toasts).toEqual([])
})

test('rule 15: once initialised, the conductor cannot edit source or tests itself', async ($, on) => {
  const w = world(on, { files: INITIALISED })

  const edit = await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y' })
  const write = await $.tool.call({ tool: 'Write', file_path: '/repo/tests/a.test.ts', content: 'y' })

  expect(refusal(edit)).toMatch(/rule 15/)
  expect(refusal(edit)).toMatch(/developer/)
  expect(refusal(write)).toMatch(/rule 15/)
  expect(w.ran).toEqual([])
})

test('rule 15: the conductor still edits the wiki, the workflow and files outside the repository', async ($, on) => {
  const w = world(on, { files: INITIALISED })

  await $.tool.call({ tool: 'Edit', file_path: '/repo/docs/wiki/todos.md', old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'Write', file_path: '/repo/.handoff/auth-plan.md', content: 'y' })
  await $.tool.call({ tool: 'Write', file_path: '/tmp/scratch/notes.md', content: 'y' })

  expect(w.ran).toEqual(['Edit', 'Write', 'Write'])
})

test('rule 15: the uninitialised template lets the conductor write the init skeleton', async ($, on) => {
  const w = world(on, { files: { 'CLAUDE.md': '- Name: `<set during project initialization>`' } })
  await $.tool.call({ tool: 'Write', file_path: '/repo/src/index.ts', content: '' })
  expect(w.ran).toEqual(['Write'])
})

for (const ref of ['MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
  test(`rule 15: resolving a conflict (${ref}) is the conductor's own edit`, async ($, on) => {
    const w = world(on, { files: INITIALISED, inProgress: [ref] })
    await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y' })
    expect(w.ran).toEqual(['Edit'])
  })
}

test('rule 15: /allow-code-edits lets the conductor edit code for the rest of the session', async ($, on) => {
  const w = world(on, { files: INITIALISED })

  const answer = await $.command.run({ command: 'allow-code-edits', args: '' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y' })

  expect(JSON.stringify(answer)).toMatch(/rule 15/)
  expect(w.ran).toEqual(['Edit'])
})

test('outside a workflow project every guard lets the call through', async ($, on) => {
  const w = world(on, { workflow: false, porcelain: ' M src/a.ts\n', files: { 'docs/raw/a.md': 'x' } })

  await $.tool.call({ tool: 'Bash', command: 'git stash' })
  await $.tool.call({ tool: 'Edit', file_path: 'docs/raw/a.md', old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p', subagent_type: 'general-purpose' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y' })

  expect(w.ran).toEqual(['Bash', 'Edit', 'Agent', 'Edit'])
})

test('rule 15: a subagent edits code under its own scope', async ($, on) => {
  const w = world(on, { files: INITIALISED })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y', agentId: 'a1' } as never)
  expect(w.ran).toEqual(['Edit'])
})
