import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// A refusal reads as { deny } on the engine's own $.tool.call, and as an
// errored result once a session's chain has turned it into one.
const refusal = (r: { deny?: string; isError?: true; text?: string }) => r.deny ?? (r.isError ? r.text : undefined)

const OK = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

// The world beneath the plugin: git answers by its subcommand, files by path,
// and every tool that gets through records that it ran.
function world(on: On, { porcelain = '', files = {} as Record<string, string>, head = '' } = {}) {
  const ran: string[] = []
  const toasts: string[] = []
  // Paths reach the hooks resolved against the session's directory.
  const file = (path: string) =>
    Object.keys(files).find(name => path.replaceAll('\\', '/').endsWith(`/${name}`) || path === name)
  on('process.run', ($, e) => {
    const sub = e.argv.slice(1).join(' ')
    if (sub.startsWith('status --porcelain')) return { value: { ...OK, stdout: porcelain } }
    if (sub.startsWith('show --name-only')) return { value: { ...OK, stdout: head } }
    return { value: { ...OK, exitCode: 1, stdout: '' } }
  })
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

test('rule 19: a commit without a log entry raises a toast once initialised', async ($, on) => {
  const w = world(on, { files: INITIALISED, head: 'src/a.ts\n' })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(w.ran).toEqual(['Bash'])
  expect(w.toasts.join()).toMatch(/log\.md/)
})

test('rule 19: a commit with its log entry, or in the uninitialised template, is quiet', async ($, on) => {
  const logged = world(on, { files: INITIALISED, head: 'src/a.ts\ndocs/wiki/log.md\n' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(logged.toasts).toEqual([])
})

test('rule 19: the uninitialised template is quiet', async ($, on) => {
  const w = world(on, {
    files: { 'CLAUDE.md': '- Name: `<set during project initialization>`', 'docs/wiki/log.md': '# Log' },
    head: 'README.md\n',
  })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(w.toasts).toEqual([])
})
